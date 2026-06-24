import express, { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export const app = express();
const PORT = process.env.PORT || 5052;
const DISPATCH_URL = process.env.DISPATCH_URL || 'http://dispatch:5150';
const SAGE_WELLNESS_URL = process.env.SAGE_WELLNESS_URL || 'http://sage-wellness:8080';

// Setup SQLite database for local transaction queueing and auditing
const DB_PATH = process.env.DATABASE_PATH || './mobile_gateway.db';
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Initialize database schemas
db.exec(`
  CREATE TABLE IF NOT EXISTS transaction_queue (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS client_telemetry (
    client_id TEXT PRIMARY KEY,
    battery_level REAL,
    ane_temp REAL,
    allocated_memory REAL,
    latency_ms REAL,
    timestamp INTEGER
  );
`);

app.use(cors());
app.use(express.json());

// Set up SSE client storage
const sseClients = new Map<string, Response>();

// ── HEALTH & AUDIT ENDPOINT ────────────────────────────────────────────────
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'operational',
    service: 'mobile-gateway',
    connections: sseClients.size,
    db_transactions: db.prepare('SELECT count(*) as count FROM transaction_queue').get() as any
  });
});

// ── HELIX D: mTLS ENFORCED mcp BRIDGE ──────────────────────────────────────────
// SSE endpoint for push notification / streaming capabilities to mobile nodes
app.get('/mcp/sse', (req: Request, res: Response) => {
  const clientId = (req.headers['x-ssl-client-s-dn'] as string) || `iphone-${uuidv4()}`;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.set(clientId, res);
  console.log(`[mTLS] Client ${clientId} connected to SSE mesh channel.`);

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: 'handshake', status: 'connected', clientId })}\n\n`);

  req.on('close', () => {
    sseClients.delete(clientId);
    console.log(`[mTLS] Client ${clientId} disconnected from SSE mesh channel.`);
  });
});

// JSON-RPC Router for MCP Tool Invocation from Mobile Client
app.post('/mcp/request', async (req: Request, res: Response) => {
  const clientCert = req.headers['x-ssl-client-s-dn'] as string;
  const clientVerify = req.headers['x-ssl-client-verify'] as string;
  
  // Strict mTLS logging for Helix D
  console.log(`[mTLS Request] Verify: ${clientVerify}, Client: ${clientCert}`);

  const { jsonrpc, method, params, id } = req.body;

  if (jsonrpc !== '2.0' || !method) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request structure' },
      id
    });
  }

  try {
    // Route tool invocations directly to the central dispatch node
    const dispatchResponse = await fetch(`${DISPATCH_URL}/api/skills/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DISPATCH_API_KEY || 'sovereign-token'}`
      },
      body: JSON.stringify({ name: method, params })
    });

    if (!dispatchResponse.ok) {
      const errText = await dispatchResponse.text();
      return res.status(dispatchResponse.status).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: `Dispatch Error: ${errText}` },
        id
      });
    }

    const data = await dispatchResponse.json();
    return res.json({
      jsonrpc: '2.0',
      result: data,
      id
    });

  } catch (error: any) {
    console.error(`[MCP Error] Tool ${method} execution failed:`, error);
    return res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: error.message || 'Internal error' },
      id
    });
  }
});

// ── HELIX A: HIGH-RELIABILITY OFFLINE SYNC ROUTER ────────────────────────────
// Ingests and plays back operations completed on the phone while offline
app.post('/api/mobile/sync', async (req: Request, res: Response) => {
  const { clientId, transactions } = req.body;

  if (!clientId || !Array.isArray(transactions)) {
    return res.status(400).json({ success: false, error: 'Missing client identifier or transactions list' });
  }

  console.log(`[Offline Sync] Received ${transactions.length} queued operations from ${clientId}`);

  const stmt = db.prepare(`
    INSERT INTO transaction_queue (id, client_id, action, payload, timestamp, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
    ON CONFLICT(id) DO UPDATE SET status='pending', error=NULL
  `);

  const insertTransaction = db.transaction((txs: any[]) => {
    for (const tx of txs) {
      stmt.run(tx.id || uuidv4(), clientId, tx.action, JSON.stringify(tx.payload), tx.timestamp || Date.now());
    }
  });

  try {
    insertTransaction(transactions);
    
    // Process pending queue asynchronously to avoid blocking the client response
    setImmediate(async () => {
      await processPendingQueue(clientId);
    });

    return res.json({ success: true, message: 'Queue buffered successfully. Processing started.' });
  } catch (e: any) {
    console.error('[Offline Sync] Failed to buffer queue:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Retry all failed sync operations in the queue
app.post('/api/mobile/sync/retry', async (req: Request, res: Response) => {
  const { clientId } = req.body;

  if (!clientId) {
    return res.status(400).json({ success: false, error: 'Missing client identifier' });
  }

  console.log(`[Offline Sync] Manual queue retry requested for client ${clientId}`);

  // Fetch count of failed items with attempts < 5
  const failedCount = db.prepare("SELECT count(*) as count FROM transaction_queue WHERE client_id = ? AND status = 'failed' AND attempts < 5").get(clientId) as any;

  if (failedCount.count === 0) {
    return res.json({ success: true, message: 'No retryable failed transactions in queue.', retrying: 0 });
  }

  // Set them back to pending to trigger re-evaluation
  db.prepare("UPDATE transaction_queue SET status = 'pending', error = NULL WHERE client_id = ? AND status = 'failed' AND attempts < 5").run(clientId);

  // Trigger non-blocking reprocessing
  setImmediate(async () => {
    await processPendingQueue(clientId);
  });

  return res.json({ 
    success: true, 
    message: `Manual retry queued for ${failedCount.count} transactions.`, 
    retrying: failedCount.count 
  });
});

// Process pending transactions and report progress via SSE if open
async function processPendingQueue(clientId: string) {
  const pending = db.prepare("SELECT * FROM transaction_queue WHERE client_id = ? AND (status = 'pending' OR (status = 'failed' AND attempts < 5)) ORDER BY timestamp ASC").all(clientId) as any[];
  
  if (pending.length === 0) return;

  const clientStream = sseClients.get(clientId);

  for (const tx of pending) {
    console.log(`[Queue Player] Playing back action ${tx.action} (${tx.id}) (attempt ${tx.attempts + 1})`);
    
    try {
      db.prepare("UPDATE transaction_queue SET status = 'processing', attempts = attempts + 1 WHERE id = ?").run(tx.id);

      let targetUrl = '';
      let body: any = {};

      if (tx.action === 'start_task') {
        targetUrl = `${DISPATCH_URL}/api/tasks`;
        body = JSON.parse(tx.payload);
      } else if (tx.action === 'log_sensory') {
        // Direct media pipeline trigger or Obsidian Memory Spine ingestion
        targetUrl = `${DISPATCH_URL}/api/skills/invoke`;
        body = { name: 'log_sensory_event', params: JSON.parse(tx.payload) };
      } else {
        // Fallback standard skill execution
        targetUrl = `${DISPATCH_URL}/api/skills/invoke`;
        body = { name: tx.action, params: JSON.parse(tx.payload) };
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DISPATCH_API_KEY || 'sovereign-token'}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        const isClientError = response.status >= 400 && response.status < 500;
        
        // Permanent rejection for client errors (e.g. 400 Bad Request, 422 Unprocessable Entity)
        if (isClientError) {
          db.prepare("UPDATE transaction_queue SET status = 'rejected', error = ? WHERE id = ?").run(`Client Error ${response.status}: ${errorText}`, tx.id);
          console.warn(`[Queue Player] Action ${tx.id} permanently rejected: ${errorText}`);
          if (clientStream) {
            clientStream.write(`data: ${JSON.stringify({ type: 'sync_rejected', transactionId: tx.id, error: errorText })}\n\n`);
          }
          continue;
        }
        
        throw new Error(`Server returned status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      db.prepare("UPDATE transaction_queue SET status = 'completed', error = NULL WHERE id = ?").run(tx.id);
      
      console.log(`[Queue Player] Action ${tx.id} executed successfully!`);

      if (clientStream) {
        clientStream.write(`data: ${JSON.stringify({ type: 'sync_success', transactionId: tx.id, result })}\n\n`);
      }

    } catch (err: any) {
      console.error(`[Queue Player] Action ${tx.id} failed:`, err);
      const errorMsg = err.message || 'Unknown error';
      db.prepare("UPDATE transaction_queue SET status = 'failed', error = ? WHERE id = ?").run(errorMsg, tx.id);
      
      if (clientStream) {
        clientStream.write(`data: ${JSON.stringify({ type: 'sync_failure', transactionId: tx.id, error: errorMsg, attempts: tx.attempts })}\n\n`);
      }
    }
  }
}

// ── HELIX B: MODELOPS & ROUTING (SPLIT-COMPUTE) ──────────────────────────────
// Serves on-device dynamic model thresholds and offloading configuration
app.get('/api/mobile/routing', (req: Request, res: Response) => {
  const modelRegistryPath = path.resolve('/app/creative-liberation-engine/runtime/registry/models.mobile.json');
  
  if (fs.existsSync(modelRegistryPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(modelRegistryPath, 'utf8'));
      return res.json({
        client_model: typeof raw.client_model === 'object' ? raw.client_model.name : (raw.client_model || "gemma-2b-it"),
        fallback_vllm_host: raw.remote_model?.vllm_endpoint || "http://127.0.0.1:11434",
        thresholds: {
          ane_thermal_limit: raw.runtime_thresholds?.ane_thermal_limit_celsius ?? (raw.thresholds?.ane_thermal_limit ?? 85.0),
          token_speed_min: raw.runtime_thresholds?.min_token_speed_tps ?? (raw.thresholds?.token_speed_min ?? 8.5),
          max_prompt_length: raw.runtime_thresholds?.max_prompt_length_chars ?? (raw.thresholds?.max_prompt_length ?? 2048)
        },
        routing_rules: (raw.intent_routing_rules || raw.routing_rules || []).map((r: any) => ({
          trigger: r.intent_domain || r.trigger,
          route: r.executor || r.route
        }))
      });
    } catch (e: any) {
      console.error('[ModelOps Routing] Failed to parse models.mobile.json:', e);
    }
  }

  // Fallback default registry configuration (Zero MVP rule enforcement)
  return res.json({
    client_model: "gemma-2b-it",
    fallback_vllm_host: "http://127.0.0.1:11434",
    thresholds: {
      ane_thermal_limit: 85.0,
      token_speed_min: 8.5,
      max_prompt_length: 2048
    },
    routing_rules: [
      { trigger: "coding", route: "remote" },
      { trigger: "media_render", route: "remote" },
      { trigger: "sensory_log", route: "local" },
      { trigger: "casual_chat", route: "local" }
    ]
  });
});

// ── HELIX F: OBSERVABILITY (SAGE WELLNESS DAEMON PROXY) ────────────────────────
// Receives battery, thermal, network metrics and registers them with the mesh
app.post('/api/wellness/report', async (req: Request, res: Response) => {
  const { clientId, batteryLevel, aneTemp, allocatedMemory, latencyMs } = req.body;

  if (!clientId) {
    return res.status(400).json({ success: false, error: 'Missing client identifier' });
  }

  const timestamp = Date.now();

  try {
    // Audit telemetry locally
    db.prepare(`
      INSERT INTO client_telemetry (client_id, battery_level, ane_temp, allocated_memory, latency_ms, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET 
        battery_level=excluded.battery_level,
        ane_temp=excluded.ane_temp,
        allocated_memory=excluded.allocated_memory,
        latency_ms=excluded.latency_ms,
        timestamp=excluded.timestamp
    `).run(clientId, batteryLevel || 1.0, aneTemp || 35.0, allocatedMemory || 0.0, latencyMs || 0.0, timestamp);

    // Forward telemetric diagnostics to SAGE wellness daemon
    const sageResponse = await fetch(`${SAGE_WELLNESS_URL}/api/wellness/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_id: clientId,
        node_type: 'mobile_node',
        metrics: {
          battery: batteryLevel,
          ane_thermal: aneTemp,
          memory: allocatedMemory,
          latency: latencyMs
        },
        timestamp
      })
    });

    console.log(`[SAGE Telemetry Proxy] Registered report from ${clientId} in central wellness hub.`);
    return res.json({ success: true, cached: true });

  } catch (error: any) {
    // SAGE could be starting or offline; cache report locally but don't fail client
    console.warn(`[SAGE Telemetry Proxy] Local caching only, SAGE Wellness downstream is unreachable:`, error.message);
    return res.json({ success: true, cached: true, warning: 'SAGE Offline' });
  }
});

// ── VENZA TELEMETRY INGESTION ENDPOINT ──────────────────────────────────────
app.post('/api/mobile/venza', (req: Request, res: Response) => {
  const { latitude, longitude, speed_kph, heading, battery_state, ssid, battery_level, event } = req.body;
  
  console.log(`[Venza Gateway] Telemetry update received. Event: ${event || 'None'}, Wifi SSID: ${ssid || 'None'}`);

  // Resolve Venza state file path dynamically across different deployment contexts
  const possiblePaths = [
    process.env.VENZA_STATE_PATH || '',
    path.resolve(process.cwd(), 'runtime/session/venza-state.json'),
    path.resolve(__dirname, '../../runtime/session/venza-state.json'),
    '/app/creative-liberation-engine/runtime/session/venza-state.json'
  ];
  
  let venzaStatePath = '';
  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      venzaStatePath = p;
      break;
    }
  }

  if (!venzaStatePath) {
    console.error('[Venza Gateway] venza-state.json path not found.');
    return res.status(500).json({ success: false, error: 'State store unavailable' });
  }

  try {
    const rawData = fs.readFileSync(venzaStatePath, 'utf8');
    const state = JSON.parse(rawData);

    // Update location details if provided
    if (latitude !== undefined && longitude !== undefined) {
      state.location.latitude = latitude;
      state.location.longitude = longitude;
      state.location.speed_kph = speed_kph !== undefined ? speed_kph : state.location.speed_kph;
      state.location.heading = heading !== undefined ? heading : state.location.heading;
    }

    // Map battery/charging state to vehicle running status
    if (battery_state) {
      state.vehicle.status = battery_state === 'charging' ? 'DRIVING' : 'PARKED';
    }

    // Set last updated timestamp
    state.last_updated = new Date().toISOString();

    // Map WiFi connection to network state
    const currentNetworkState = ssid === 'Home-WiFi' ? 'home' : 'away';

    // Handle historical telemetry entry
    const historyEntry = {
      timestamp: new Date().toISOString(),
      state: currentNetworkState,
      event: event || (battery_state === 'charging' ? 'IGNITION_START' : battery_state === 'discharging' ? 'IGNITION_STOP' : 'TELEMETRY_PING'),
      ip: req.ip || null
    };

    state.history = state.history || [];
    state.history.unshift(historyEntry);
    
    // Keep history array compact (limit to last 20 events)
    if (state.history.length > 20) {
      state.history = state.history.slice(0, 20);
    }

    // Save updated state file
    fs.writeFileSync(venzaStatePath, JSON.stringify(state, null, 2), 'utf8');
    console.log(`[Venza Gateway] Saved telemetry update successfully. Status: ${state.vehicle.status}`);

    // If an action-triggering event occurred, dispatch to central gateway
    if (event === 'ARRIVED_HOME' || event === 'LEFT_HOME' || event === 'IGNITION_START' || event === 'IGNITION_STOP') {
      fetch(`${DISPATCH_URL}/api/skills/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'venza_automation_dispatcher',
          params: { event, timestamp: new Date().toISOString() }
        })
      }).catch(err => console.warn('[Venza Gateway] Failed to trigger dispatch automation:', err.message));
    }

    return res.json({ success: true, vehicle_status: state.vehicle.status });

  } catch (error: any) {
    console.error('[Venza Gateway] Failed to process telemetric payload:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


// Initialize server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`CLE ENGINE: SOVEREIGN MOBILE GATEWAY`);
    console.log(`Listening on internal port: ${PORT}`);
    console.log(`mTLS Forward Target:        ${DISPATCH_URL}`);
    console.log(`SAGE Wellness Proxy:       ${SAGE_WELLNESS_URL}`);
    console.log(`Database Queue Storage:     ${DB_PATH}`);
    console.log(`==================================================`);
  });
}
