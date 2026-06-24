import express from 'express';
import { randomUUID } from 'crypto';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
app.use(express.json());

const PORT = process.env.WEBHOOK_PORT || 5080;
const DISPATCH_URL = process.env.DISPATCH_URL || 'http://dispatch:5050';

// Helper to save raw payload to NAS
async function saveRawPayload(source: string, payload: any): Promise<string | null> {
  try {
    const runtimeDir = process.env.RUNTIME_DIR || path.resolve(process.cwd(), '../../runtime');
    const ingestionDir = path.join(runtimeDir, 'ingestion', source);
    await fs.promises.mkdir(ingestionDir, { recursive: true });
    
    const filename = `${Date.now()}_${randomUUID()}.json`;
    const filepath = path.join(ingestionDir, filename);
    await fs.promises.writeFile(filepath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[sensor-mesh] Raw payload saved to ${filepath}`);
    return filepath;
  } catch (err) {
    console.error(`[sensor-mesh] Failed to save raw payload to NAS:`, err);
    return null;
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'sensor-mesh-webhook' });
});

app.post('/webhook/:source', async (req, res) => {
  const { source } = req.params;
  const payload = req.body;
  
  console.log(`[sensor-mesh] Received webhook from ${source}`);
  
  let priority = 'high';
  let capabilities = ['sensor-mesh'];
  let savedFilePath: string | null = null;

  // For tripleseat and prism, save raw payload directly to NAS
  if (source === 'tripleseat' || source === 'prism') {
    savedFilePath = await saveRawPayload(source, payload);
  }

  let formattedPayload: any = {
    source,
    raw: payload,
    filePath: savedFilePath,
    timestamp: new Date().toISOString(),
    eventId: randomUUID()
  };

  // Advanced Event Translation
  if (source === 'zigsim') {
    priority = 'critical'; // Sensor streaming is latency-sensitive
    capabilities = ['somatic-bridge']; // Needs routing to UE5
    formattedPayload = {
      source: 'zigsim',
      device: payload?.device || 'unknown',
      sensorData: payload?.sensordata || payload,
      timestamp: payload?.timestamp || new Date().toISOString(),
      eventId: randomUUID()
    };
  } else if (source === 'iot') {
    priority = 'medium';
    capabilities = ['iot-processor'];
    formattedPayload = {
      source: 'iot',
      sensorType: payload?.type || 'generic',
      value: payload?.value,
      location: payload?.location || 'unknown',
      timestamp: new Date().toISOString(),
      eventId: randomUUID()
    };
  } else if (source === 'tripleseat') {
    priority = 'high';
    capabilities = ['tripleseat-processor'];
  } else if (source === 'prism') {
    priority = 'high';
    capabilities = ['prism-processor'];
  }

  // Map priority to TaskPriority (P0 | P1 | P2 | P3)
  const taskPriority = priority === 'critical' ? 'P0' : priority === 'high' ? 'P1' : priority === 'medium' ? 'P2' : 'P3';

  // Proper Task Object mapping aligned with TaskQueue schema
  const task = {
    project: process.env.PROJECT || 'creative-liberation-engine',
    workstream: `webhook.${source}`,
    title: `Webhook Event: ${source}`,
    description: `Automated webhook event ingestion from source: ${source}`,
    priority: taskPriority,
    source: source,
    metadata: formattedPayload,
    created_by: 'sensor-mesh',
    assigned_to_capability: capabilities[0] || 'sensor-mesh'
  };

  try {
    const response = await fetch(`${DISPATCH_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    
    if (!response.ok) {
      console.error(`[sensor-mesh] Dispatch failed: ${response.status}`);
      return res.status(500).json({ error: 'Failed to dispatch task' });
    }
    
    const data = await response.json() as any;
    console.log(`[sensor-mesh] Successfully dispatched task ${data.task_id || data.id}`);
    res.json({ success: true, taskId: data.task_id || data.id });
  } catch (error) {
    console.error(`[sensor-mesh] Error communicating with dispatch:`, error);
    res.status(500).json({ error: 'Internal system error' });
  }
});

export function startWebhookServer() {
  app.listen(PORT, () => {
    console.log(`[sensor-mesh] Webhook receiver listening on port ${PORT}`);
    console.log(`[sensor-mesh] Dispatch target: ${DISPATCH_URL}`);
  });
}
