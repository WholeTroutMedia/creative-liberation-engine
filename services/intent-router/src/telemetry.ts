import fs from 'fs';
import path from 'path';

export interface TelemetryEvent {
  event: string;
  timestamp: string;
  input: string;
  category: string;
  matchedSkills: string[];
  matchedTemplate: string | null;
  matchedWorkflow: string | null;
  leadAgents: string[];
  confidence: number;
  fallbackLevel: number;
  resolutionMs: number;
  source: 'deterministic' | 'semantic' | 'fallback';
}

const shadowQaUrl = process.env.SHADOW_QA_URL || 'http://shadow-qa:5090/api/traces';
const logDir = process.env.INTENT_ROUTER_LOG_DIR || '../../runtime/logs';

export async function emitTelemetry(event: TelemetryEvent) {
  console.log(`[Telemetry] Intent Routed: "${event.input}" -> Skills: [${event.matchedSkills.join(', ')}] (Confidence: ${event.confidence}, Source: ${event.source})`);

  // 1. Log to console & write to unroutable file if confidence is 0
  if (event.confidence === 0 || event.matchedSkills.length === 0) {
    try {
      const logPath = path.resolve(logDir, 'unroutable-intents.jsonl');
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.appendFileSync(logPath, JSON.stringify(event) + '\n', 'utf8');
    } catch (err) {
      console.error('[Telemetry] Failed to write to unroutable-intents.jsonl:', err);
    }
  }

  // 2. Post to shadow-qa
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1s timeout
    const response = await fetch(shadowQaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        traceId: crypto.randomUUID?.() || Math.random().toString(36).substring(2),
        service: 'intent-router',
        name: 'intent.routed',
        timestamp: event.timestamp,
        attributes: event
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.warn(`[Telemetry] shadow-qa response not OK: ${response.status}`);
    }
  } catch (err) {
    // Silent fail so we don't disrupt the critical routing path
    console.debug('[Telemetry] shadow-qa POST failed (expected if local or container not up):', (err as Error).message);
  }
}
