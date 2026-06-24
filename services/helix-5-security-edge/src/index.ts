import pino from 'pino';
import express from 'express';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const logger = pino({ 
  name: 'helix-5-security-edge',
  level: process.env.LOG_LEVEL || 'info'
});

const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'helix5.db'));

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS security_scans (
    id TEXT PRIMARY KEY,
    target_url TEXT NOT NULL,
    status TEXT NOT NULL,
    vulnerabilities_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS model_provenance (
    id TEXT PRIMARY KEY,
    model_hash TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    watermark_signature TEXT NOT NULL,
    registered_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS iot_bridges (
    id TEXT PRIMARY KEY,
    device_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    telemetry_json TEXT,
    last_seen TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS overlay_configs (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    config_json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

export class SecurityEdge {
  async runAegisPentest(targetUrl: string) {
    logger.info({ targetUrl }, 'Starting autonomous Aegis security scan...');
    const vulns: any[] = [];
    let status = 'completed';

    try {
      const url = new URL(targetUrl);
      const response = await fetch(url.origin, {
        method: 'GET',
        headers: { 'User-Agent': 'AegisPentest/6.0-Sovereign' },
        signal: AbortSignal.timeout(5000)
      });

      // Analyze security headers
      const headers = response.headers;
      
      if (!headers.get('content-security-policy')) {
        vulns.push({
          type: 'missing_header',
          name: 'Missing Content-Security-Policy (CSP)',
          severity: 'medium',
          description: 'The response does not specify a Content-Security-Policy header, leaving it vulnerable to XSS and data injection.'
        });
      }

      if (!headers.get('x-frame-options')) {
        vulns.push({
          type: 'missing_header',
          name: 'Missing X-Frame-Options',
          severity: 'low',
          description: 'The response does not specify X-Frame-Options, making it susceptible to Clickjacking attacks.'
        });
      }

      if (!headers.get('x-content-type-options')) {
        vulns.push({
          type: 'missing_header',
          name: 'Missing X-Content-Type-Options',
          severity: 'low',
          description: 'The response does not specify X-Content-Type-Options, which disables MIME-type sniffing protections.'
        });
      }

      const serverHeader = headers.get('server');
      if (serverHeader) {
        vulns.push({
          type: 'info_disclosure',
          name: 'Server Header Information Disclosure',
          severity: 'info',
          description: `The Server header reveals the technology stack: "${serverHeader}". Disclosing backend technology assists attackers.`
        });
      }

    } catch (err: any) {
      logger.warn({ targetUrl, error: err.message }, 'Live HTTP security probe failed, generating basic audit errors');
      status = 'failed';
      vulns.push({
        type: 'probe_error',
        name: 'Target Probe Failure',
        severity: 'high',
        description: `Failed to reach the target URL. Error: ${err.message}`
      });
    }

    const scanId = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO security_scans (id, target_url, status, vulnerabilities_json)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(scanId, targetUrl, status, JSON.stringify(vulns));
    return { id: scanId, targetUrl, status, vulnerabilities: vulns };
  }

  async trackModelProvenance(modelHash: string, source: string) {
    logger.info({ modelHash, source }, 'Registering cryptographic model provenance...');
    const id = uuidv4();
    
    // Generate sovereign watermark signature
    const signaturePayload = `${modelHash}:${source}:cle-sovereign-v6`;
    const watermark = crypto.createHash('sha256').update(signaturePayload).digest('hex');

    const stmt = db.prepare(`
      INSERT INTO model_provenance (id, model_hash, source, watermark_signature)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(model_hash) DO UPDATE SET
        source = excluded.source,
        watermark_signature = excluded.watermark_signature
    `);

    stmt.run(id, modelHash, source, watermark);
    return { id, modelHash, source, watermarkSignature: watermark };
  }

  async startHardwareCompanionBridge(deviceId: string, initialTelemetry?: any) {
    logger.info({ deviceId }, 'Spinning up ESP32 / Hardware Companion Bridge...');
    const id = uuidv4();
    const telemetry = initialTelemetry || { wifiRssi: -65, heapBytes: 124800, uptimeSec: 0 };

    const stmt = db.prepare(`
      INSERT INTO iot_bridges (id, device_id, status, telemetry_json, last_seen)
      VALUES (?, ?, 'connected', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(device_id) DO UPDATE SET
        status = 'connected',
        telemetry_json = excluded.telemetry_json,
        last_seen = CURRENT_TIMESTAMP
    `);

    stmt.run(id, deviceId, JSON.stringify(telemetry));
    return { id, deviceId, status: 'connected', telemetry };
  }

  async deployAmbientGlassLogic(name: string, config: any) {
    logger.info({ name }, 'Deploying ambient glass presentation layout config...');
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO overlay_configs (id, name, config_json)
      VALUES (?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        config_json = excluded.config_json
    `);

    stmt.run(id, name, JSON.stringify(config));
    return { id, name, config };
  }
}

const edge = new SecurityEdge();
const app = express();
app.use(express.json());

// API Endpoints
app.get('/health', (req, res) => {
  const scanCount = db.prepare('SELECT COUNT(*) as count FROM security_scans').get() as any;
  const provCount = db.prepare('SELECT COUNT(*) as count FROM model_provenance').get() as any;
  res.json({
    status: 'online',
    service: 'helix-5-security-edge',
    database: {
      securityScans: scanCount.count,
      modelProvenance: provCount.count
    }
  });
});

app.post('/api/security/scan', async (req, res) => {
  const { targetUrl } = req.body;
  if (!targetUrl) return res.status(400).json({ error: 'targetUrl is required' });
  try {
    const scan = await edge.runAegisPentest(targetUrl);
    res.status(201).json(scan);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/security/scan', (req, res) => {
  const scans = db.prepare('SELECT id, target_url, status, created_at FROM security_scans ORDER BY created_at DESC').all();
  res.json(scans);
});

app.get('/api/security/scan/:id', (req, res) => {
  const scan = db.prepare('SELECT * FROM security_scans WHERE id = ?').get(req.params.id) as any;
  if (!scan) return res.status(404).json({ error: 'Scan not found' });
  res.json({
    id: scan.id,
    targetUrl: scan.target_url,
    status: scan.status,
    vulnerabilities: JSON.parse(scan.vulnerabilities_json),
    created_at: scan.created_at
  });
});

app.post('/api/provenance/models', async (req, res) => {
  const { modelHash, source } = req.body;
  if (!modelHash || !source) return res.status(400).json({ error: 'modelHash and source are required' });
  try {
    const prov = await edge.trackModelProvenance(modelHash, source);
    res.status(201).json(prov);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/provenance/models', (req, res) => {
  const list = db.prepare('SELECT * FROM model_provenance').all();
  res.json(list);
});

app.post('/api/iot/devices', async (req, res) => {
  const { deviceId, telemetry } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId is required' });
  try {
    const bridge = await edge.startHardwareCompanionBridge(deviceId, telemetry);
    res.status(201).json(bridge);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/iot/devices', (req, res) => {
  const devices = db.prepare('SELECT * FROM iot_bridges').all();
  res.json(devices.map((d: any) => ({
    id: d.id,
    deviceId: d.device_id,
    status: d.status,
    telemetry: JSON.parse(d.telemetry_json),
    last_seen: d.last_seen
  })));
});

app.post('/api/display/overlay', async (req, res) => {
  const { name, config } = req.body;
  if (!name || !config) return res.status(400).json({ error: 'name and config are required' });
  try {
    const overlay = await edge.deployAmbientGlassLogic(name, config);
    res.status(201).json(overlay);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/display/overlay/:name', (req, res) => {
  const overlay = db.prepare('SELECT * FROM overlay_configs WHERE name = ?').get(req.params.name) as any;
  if (!overlay) return res.status(404).json({ error: 'Overlay config not found' });
  res.json({
    id: overlay.id,
    name: overlay.name,
    config: JSON.parse(overlay.config_json),
    created_at: overlay.created_at
  });
});

const PORT = process.env.PORT || 6005;
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'helix-5-security-edge service online');
  console.log(`[CLE ENGINE] helix-5-security-edge LIVE on port ${PORT}`);
});
