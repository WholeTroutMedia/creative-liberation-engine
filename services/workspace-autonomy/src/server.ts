import express, { Express } from 'express';
import pino from 'pino';
import { z } from 'zod';
import { SAMRuntime } from './sam-runtime.js';
import { SARRuntime } from './sar-runtime.js';
import { GoogleSparkEngine, TelemetryPayload } from './modules/google-spark-engine.js';
import { WorkspaceMcpClient } from './modules/mcp-client.js';
import { SenchoClient } from './modules/sencho.js';
import { MatterBridge } from './modules/matter-bridge.js';

const logger = pino({
  name: 'workspace-autonomy:server',
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined
});

const app: Express = express();
app.use(express.json());

const samRuntime = new SAMRuntime();
const sarRuntime = new SARRuntime();

// ─── ZOD SCHEMAS ─────────────────────────────────────────────────────────────

const samRequestSchema = z.object({
  schema: z.object({
    agentName: z.string().min(2).max(100),
    description: z.string().optional(),
    instruction: z.string(),
    foundationModel: z.string(),
    orchestrationType: z.enum(['default', 'custom_orchestration']).optional(),
    tools: z.array(
      z.object({
        type: z.enum(['code_interpreter', 'web_browser', 'custom_tool']),
        name: z.string().optional(),
        description: z.string().optional(),
        endpoint: z.string().optional()
      })
    ).optional()
  }),
  prompt: z.string().min(1),
  sessionId: z.string().optional()
});

const sarRenderSchema = z.object({
  artifactId: z.string().regex(/^art-[a-z0-9_\-]{3,64}$/, 'Invalid artifactId format'),
  type: z.enum(['ui_component', 'code_snippet', 'interactive_dashboard', 'document']),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  version: z.number().int().min(1).optional(),
  dependencies: z.array(z.string()).optional(),
  designTokens: z.record(z.any()).optional()
});

// ─── ENDPOINTS ───────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'workspace-autonomy',
    timestamp: new Date().toISOString()
  });
});

/**
 * Execute Amazon Bedrock AgentCore schema locally
 */
app.post('/api/v1/workspace/agentcore/execute', async (req, res) => {
  const result = samRequestSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation failed', details: result.error.format() });
  }

  try {
    const response = await samRuntime.execute(result.data);
    res.json(response);
  } catch (err: any) {
    logger.error({ err: err.message }, 'SAM execution failed');
    res.status(500).json({ error: err.message });
  }
});

/**
 * Render dynamic self-hosted artifact workspace
 */
app.post('/api/v1/workspace/artifact/render', async (req, res) => {
  const result = sarRenderSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation failed', details: result.error.format() });
  }

  try {
    const response = await sarRuntime.render(result.data);
    res.json(response);
  } catch (err: any) {
    logger.error({ err: err.message }, 'SAR rendering failed');
    res.status(500).json({ error: err.message });
  }
});

/**
 * Fetch dynamic artifact HTML workspace sandbox page
 */
app.get('/api/v1/workspace/artifact/:artifactId', (req, res) => {
  try {
    const html = sarRuntime.getArtifactHTML(req.params.artifactId);
    if (!html) {
      return res.status(404).send(`Workspace Artifact '${req.params.artifactId}' not found`);
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to fetch workspace artifact');
    res.status(500).json({ error: err.message });
  }
});

// ─── GOOGLE SPARK ENGINE INTEGRATION ──────────────────────────────────────────

const BRIDGE_URL = process.env.GOOGLE_WORKSPACE_BRIDGE_URL || 'http://127.0.0.1:3090';
const mcpClient = new WorkspaceMcpClient(BRIDGE_URL);

const sparkEngine = new GoogleSparkEngine({
  workspaceDir: process.cwd(),
  senderEmail: process.env.GMAIL_SENDER_EMAIL || 'inquiries@creativeliberationengine.org',
  recipientEmail: process.env.GMAIL_RECIPIENT_EMAIL || 'inquiries@creativeliberationengine.org',
  telemetrySheetId: process.env.TELEMETRY_SHEET_ID || '1_AIzaSyDJIwtD-WLPp-rexDkdA_uQPnOi2BGNSfw',
  mcpClient: mcpClient,
  ollamaUrl: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
});

async function executeSparkSweep() {
  logger.info('[Spark Server Sweep] Starting full operational sweep...');
  try {
    const triageResult = await sparkEngine.executeTriageLoop();
    logger.info({ count: triageResult.triagedCount }, '[Spark Server Sweep] Triage completed');

    const syncTasksResult = await sparkEngine.syncTasksToGoogleTasks();
    logger.info({ success: syncTasksResult }, '[Spark Server Sweep] Tasks sync completed');

    const focusResult = await sparkEngine.scheduleFocusPlanner();
    logger.info({ success: focusResult }, '[Spark Server Sweep] Focus planner completed');

    const espTelemetry: TelemetryPayload = {
      source: 'ESP32_GARDEN',
      metrics: {
        soilMoisture: 42.5,
        airTemp: 24.8,
        humidity: 58.2,
        batteryPct: 88.0
      },
      timestamp: new Date().toISOString()
    };
    const telemetryResult = await sparkEngine.logTelemetryToSheets(espTelemetry);
    logger.info({ success: telemetryResult }, '[Spark Server Sweep] Telemetry sheet logging completed');

    return {
      triage: triageResult,
      tasksSync: syncTasksResult,
      focusPlanner: focusResult,
      telemetry: telemetryResult
    };
  } catch (err: any) {
    logger.error({ err: err.message }, '[Spark Server Sweep] Operational sweep failed');
    throw err;
  }
}

/**
 * Trigger manual Google Spark sweep
 */
app.post('/api/v1/workspace/spark/sweep', async (req, res) => {
  try {
    const summary = await executeSparkSweep();
    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SWARM STACK & AMBIENT TWIN ENDPOINTS ──────────────────────────────────────

const senchoClient = new SenchoClient();
const matterBridge = new MatterBridge();

matterBridge.connect().then((connected) => {
  if (connected) {
    logger.info('[Matter Bridge] Pre-connected and active.');
    matterBridge.registerPanicCallback(() => {
      logger.warn('[Matter Bridge] Emergency Panic Event Triggered! Halting swarm tasks...');
    });
  } else {
    logger.warn('[Matter Bridge] Pre-connection failed. Reconnecting in background.');
  }
}).catch(err => {
  logger.error({ err: err.message }, '[Matter Bridge] Connection error during startup');
});

/**
 * Deploy Docker Compose stacks via Sencho with hardener validation
 */
app.post('/api/v1/workspace/swarm/deploy', async (req, res) => {
  const { stackName, composeYaml, envVars } = req.body;
  if (!stackName || !composeYaml) {
    return res.status(400).json({ error: 'Missing stackName or composeYaml' });
  }

  try {
    const result = await senchoClient.deployStack(stackName, composeYaml, envVars);
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (err: any) {
    logger.error({ err: err.message }, 'Sencho deployment route error');
    res.status(500).json({ error: err.message });
  }
});

/**
 * Control ambient lighting twin state via HASS
 */
app.post('/api/v1/workspace/swarm/ambient', async (req, res) => {
  const { rgb, brightness } = req.body;
  if (!Array.isArray(rgb) || rgb.length !== 3 || typeof brightness !== 'number') {
    return res.status(400).json({ error: 'Invalid rgb (array of 3 numbers) or brightness (number)' });
  }

  try {
    const result = await matterBridge.setLightState(rgb as [number, number, number], brightness);
    res.json({ success: true, result });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Matter ambient route error');
    res.status(500).json({ error: err.message });
  }
});

export { app };

const PORT = process.env.PORT || 5091;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Sovereign workspace-autonomy service online');
    console.log(`[CLE ENGINE] workspace-autonomy LIVE on port ${PORT}`);

    // Register 5-minute background sweep loop
    logger.info('[Spark Server Sweep] Registering 5-minute background sweep loop...');
    setInterval(() => {
      executeSparkSweep().catch(err => {
        logger.error({ err: err.message }, '[Spark Server Sweep] Background sweep loop error');
      });
    }, 300000);

    // Initial boot sweep after 10 seconds
    setTimeout(() => {
      executeSparkSweep().catch(err => {
        logger.error({ err: err.message }, '[Spark Server Sweep] Initial boot sweep error');
      });
    }, 10000);
  });
}
