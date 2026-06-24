/**
 * Google Spark System-Wide Routes — Creative Liberation Engine
 * Exposes endpoints for Spark email triage, telemetry dashboards, task sync, docs, and calendar focus.
 */

import { Router, Express } from 'express';
import { GoogleSparkEngine } from '../core/google-spark-engine.js';


const BRIDGE_URL = process.env.GOOGLE_WORKSPACE_BRIDGE_URL || 'http://127.0.0.1:3090';

class WorkspaceMcpClient {
  private bridgeUrl: string;

  constructor(bridgeUrl: string) {
    this.bridgeUrl = bridgeUrl;
  }

  public async execute(serverName: string, toolName: string, args: Record<string, any>): Promise<any> {
    const url = `${this.bridgeUrl}/tools/call`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolName, arguments: args })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json() as any;
      if (result.content && Array.isArray(result.content)) {
        const txt = result.content.find((c: any) => c.type === 'text');
        if (txt && txt.text) {
          try { return JSON.parse(txt.text); } catch { return txt.text; }
        }
      }
      return result.result || result;
    } catch (e: any) {
      console.warn(`[Spark Route Client] Fallback mock for ${toolName}`);
      return { success: true, mocked: true, tool: toolName };
    }
  }
}

export function registerSparkRoutes(app: Express): void {
  const router = Router();
  const mcpClient = new WorkspaceMcpClient(BRIDGE_URL);

  const getEngine = () => {
    return new GoogleSparkEngine({
      workspaceDir: process.cwd(),
      senderEmail: process.env.GMAIL_SENDER_EMAIL || 'inquiries@creativeliberationengine.org',
      recipientEmail: process.env.GMAIL_RECIPIENT_EMAIL || 'inquiries@creativeliberationengine.org',
      telemetrySheetId: process.env.TELEMETRY_SHEET_ID || '1_AIzaSyDJIwtD-WLPp-rexDkdA_uQPnOi2BGNSfw',
      mcpClient: mcpClient,
      ollamaUrl: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
    });
  };

  // POST /api/spark/triage — Trigger always-on email triage loop
  router.post('/triage', async (req, res) => {
    try {
      const engine = getEngine();
      const result = await engine.executeTriageLoop();
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/spark/telemetry — Append metrics to Google Sheets dashboard
  router.post('/telemetry', async (req, res) => {
    try {
      const { source, metrics } = req.body;
      if (!source || !metrics) {
        return res.status(400).json({ error: '"source" and "metrics" are required' });
      }
      const engine = getEngine();
      const success = await engine.logTelemetryToSheets({
        source,
        metrics,
        timestamp: new Date().toISOString()
      });
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/spark/focus — Dynamically schedule Calendar Focus Time
  router.post('/focus', async (req, res) => {
    try {
      const engine = getEngine();
      const success = await engine.scheduleFocusPlanner();
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/spark/sync-tasks — Sync active internal task queue to Google Tasks
  router.post('/sync-tasks', async (req, res) => {
    try {
      const engine = getEngine();
      const success = await engine.syncTasksToGoogleTasks();
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/spark/compile — Assemble Google Doc and export to PDF
  router.post('/compile', async (req, res) => {
    try {
      const { title, content } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: '"title" and "content" are required' });
      }
      const engine = getEngine();
      const docId = await engine.compileProjectDoc(title, content);
      res.json({ success: !!docId, docId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use('/api/spark', router);
  console.log('[SPARK ROUTES] ✓ Exposed /api/spark/* endpoints system-wide');
}
