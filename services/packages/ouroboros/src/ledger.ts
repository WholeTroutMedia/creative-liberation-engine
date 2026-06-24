/**
 * Ouroboros Inference Ledger
 *
 * Appends every LLM inference I/O to a rolling JSONL corpus at:
 *   .agents/ouroboros/inference-ledger.jsonl
 *
 * This is the primary data source for ARCHAEON distillation.
 * Records are written synchronously (appendFileSync) to guarantee
 * no I/O is lost if the process crashes mid-execution.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Resolved relative to the repo root regardless of CWD
const LEDGER_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '../../../../.agents/ouroboros'
);
const LEDGER_FILE = path.join(LEDGER_DIR, 'inference-ledger.jsonl');

export interface InferenceSample {
  /** ISO-8601 timestamp of the inference */
  timestamp: string;
  /** Name of the Genkit flow / agent that made this call */
  agent: string;
  /** The model that handled this request */
  model: string;
  /** Whether it was routed to cloud or a local LoRA */
  route: 'cloud' | 'local';
  /** Abbreviated system prompt — first 200 chars */
  system_prefix: string;
  /** The user-facing input */
  input: unknown;
  /** The model's output */
  output: unknown;
  /** Total wall-clock duration in milliseconds */
  duration_ms: number;
  /** True if the output was accepted / used downstream */
  success: boolean;
  /** Token usage if available */
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
}

/**
 * Append a single inference sample to the ledger.
 * Non-blocking for the caller — errors are logged but never thrown.
 */
export function appendInference(sample: InferenceSample): void {
  try {
    if (!fs.existsSync(LEDGER_DIR)) {
      fs.mkdirSync(LEDGER_DIR, { recursive: true });
    }
    const line = JSON.stringify({ ...sample, host: os.hostname() }) + '\n';
    fs.appendFileSync(LEDGER_FILE, line, 'utf8');
  } catch (err) {
    console.error('[ouroboros:ledger] Failed to write inference sample:', err);
  }
}

/**
 * Read recent inference samples from the ledger (most recent N lines).
 * Efficient tail-read — does not load the entire file into memory.
 */
export function readRecentInferences(count: number = 100): InferenceSample[] {
  try {
    if (!fs.existsSync(LEDGER_FILE)) return [];
    const raw = fs.readFileSync(LEDGER_FILE, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    const tail = lines.slice(-count);
    return tail.map((l: string) => JSON.parse(l) as InferenceSample);
  } catch (err) {
    console.error('[ouroboros:ledger] Failed to read ledger:', err);
    return [];
  }
}

/**
 * Summarize the ledger for the telemetry endpoint.
 */
export interface LedgerSummary {
  total_samples: number;
  cloud_samples: number;
  local_samples: number;
  local_percent: number;
  avg_duration_ms: number;
  agents: Record<string, number>;
  models: Record<string, number>;
}

export function summarizeLedger(): LedgerSummary {
  const samples = readRecentInferences(10_000);
  const cloud = samples.filter(s => s.route === 'cloud').length;
  const local = samples.filter(s => s.route === 'local').length;
  const total = samples.length;
  const agents: Record<string, number> = {};
  const models: Record<string, number> = {};

  let durationSum = 0;
  for (const s of samples) {
    agents[s.agent] = (agents[s.agent] ?? 0) + 1;
    models[s.model] = (models[s.model] ?? 0) + 1;
    durationSum += s.duration_ms;
  }

  return {
    total_samples: total,
    cloud_samples: cloud,
    local_samples: local,
    local_percent: total > 0 ? Math.round((local / total) * 100) : 0,
    avg_duration_ms: total > 0 ? Math.round(durationSum / total) : 0,
    agents,
    models,
  };
}
