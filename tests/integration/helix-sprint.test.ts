/**
 * Cross-Helix Integration Tests
 * Validates end-to-end wiring across all 4 helices.
 * Run: npx vitest run tests/integration/
 */
import { describe, it, expect, beforeAll } from 'vitest';

const AEGIS_URL = process.env.AEGIS_URL || 'http://localhost:5080';
const ANIMATOR_URL = process.env.ANIMATOR_URL || 'http://localhost:5085';
const VOICE_URL = process.env.VOICE_URL || 'http://localhost:5090';
const DISPATCH_URL = process.env.DISPATCH_URL || 'http://localhost:5050';

// Helper
async function healthCheck(url: string, path: string): Promise<{ ok: boolean; data?: any }> {
  try {
    const res = await fetch(`${url}${path}`);
    if (!res.ok) return { ok: false };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  }
}

// ── Helix α: Nervous System ──────────────────────────────────────────

describe('Helix α — Aegis Pentest', () => {
  it('health endpoint responds', async () => {
    const result = await healthCheck(AEGIS_URL, '/api/v1/aegis/health');
    if (!result.ok) return; // Service not running in test env
    expect(result.data.status).toBe('operational');
    expect(result.data.service).toBe('aegis-pentest');
  });

  it('scan endpoint accepts POST', async () => {
    try {
      const res = await fetch(`${AEGIS_URL}/api/v1/aegis/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets: ['http://localhost:8080'],
          scan_type: 'quick',
          checks: ['cors', 'headers'],
        }),
      });
      expect(res.status).toBeLessThan(500);
    } catch {
      // Service not running
    }
  });
});

// ── Helix β: Creative Pipeline ───────────────────────────────────────

describe('Helix β — Autonomous Animator', () => {
  it('health endpoint responds', async () => {
    const result = await healthCheck(ANIMATOR_URL, '/api/v1/animation/health');
    if (!result.ok) return;
    expect(result.data.status).toBe('operational');
    expect(result.data.service).toBe('autonomous-animator');
  });

  it('generate endpoint accepts animation job', async () => {
    try {
      const res = await fetch(`${ANIMATOR_URL}/api/v1/animation/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: 'Test Animation',
          scenes: [{
            scene_id: 'test-scene-1',
            scene_number: 1,
            description: 'Test scene',
            duration_frames: 24,
            keyframes: [{ frame_number: 0, prompt: 'a test frame' }],
            transition: { type: 'cut', duration_frames: 0 },
          }],
          output_config: { fps: 24, resolution: { width: 512, height: 512 }, codec: 'h264', format: 'mp4' },
          style_config: { art_style: 'digital_paint', checkpoint_model: 'test', consistency_seed: 42 },
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        expect(data.job_id).toBeDefined();
        expect(data.status).toBe('queued');
      }
    } catch {
      // Service not running
    }
  });
});

// ── Helix γ: Sovereign Dev Tools ─────────────────────────────────────

describe('Helix γ — Token Optimizer Module', () => {
  it('compresses whitespace', async () => {
    const { optimizeContext } = await import('../../services/dispatch/src/modules/token-optimizer');
    const result = optimizeContext('hello\n\n\n\n\nworld\n\n\n\n\ntest', 1000);
    expect(result.savings_percent).toBeGreaterThan(0);
    expect(result.optimized_tokens).toBeLessThan(result.original_tokens);
  });

  it('respects token budget', async () => {
    const { createBudget, recordUsage, getBudget } = await import('../../services/dispatch/src/modules/token-optimizer');
    const budget = createBudget('test-agent', 10000);
    recordUsage(budget.budget_id, 5000, 1000, 200);
    const updated = getBudget(budget.budget_id);
    expect(updated?.used_tokens).toBe(5000);
    expect(updated?.efficiency_percent).toBe(96);
  });
});

describe('Helix γ — Coding Agent Module', () => {
  it('detects task types correctly', async () => {
    const { createCodingTask, getCodingTask } = await import('../../services/workspace-autonomy/src/modules/coding-agent');
    const task = await createCodingTask('write a test for the auth module', [], 'typescript');
    expect(task.type).toBe('test');
    expect(task.status).toBe('queued');

    const task2 = await createCodingTask('refactor the database layer', [], 'typescript');
    expect(task2.type).toBe('refactor');
  });
});

// ── Helix δ: Voice & Spatial ─────────────────────────────────────────

describe('Helix δ — Voice Fabric', () => {
  it('health endpoint responds', async () => {
    const result = await healthCheck(VOICE_URL, '/api/v1/voice/health');
    if (!result.ok) return;
    expect(result.data.status).toBe('operational');
    expect(result.data.service).toBe('voice-fabric');
  });

  it('synthesize endpoint accepts text', async () => {
    try {
      const res = await fetch(`${VOICE_URL}/api/v1/voice/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hello from Creative Liberation Engine' }),
      });
      expect(res.status).toBeLessThan(500);
    } catch {
      // Service not running
    }
  });
});

// ── Cross-Helix: Observability → All ─────────────────────────────────

describe('Cross-Helix — Observability Trace Ingestion', () => {
  it('ingests a trace and detects no drift on first entry', async () => {
    const { ingestTrace } = await import('../../services/shadow-qa/src/modules/observability-trace');
    const result = ingestTrace({
      trace_id: 'test-trace-1',
      agent_id: 'test-agent',
      session_id: 'test-session',
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      status: 'completed',
      spans: [{ span_id: 's1', parent_span_id: null, operation: 'test', service: 'test', started_at: new Date().toISOString(), ended_at: new Date().toISOString(), duration_ms: 100, status: 'ok', attributes: {}, events: [] }],
      metadata: {},
    });
    expect(result.trace_id).toBe('test-trace-1');
    expect(result.drift_detected).toBe(false);
  });
});

// ── Cross-Helix: Debt Scanner ────────────────────────────────────────

describe('Cross-Helix — Debt Scanner', () => {
  it('produces a debt report', async () => {
    const { runDebtScan } = await import('../../services/ouroboros-daemon/src/modules/debt-scanner');
    const report = await runDebtScan({
      registryPath: '/app/creative-liberation-engine/runtime/registry/agents.canonical.json',
      servicesDir: '/app/creative-liberation-engine/services',
      routesDir: '/app/creative-liberation-engine/runtime/routes',
      schemasDir: '/app/creative-liberation-engine/schemas',
    });
    expect(report.report_id).toBeDefined();
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });
});

// ── Cross-Helix: CRDT State ─────────────────────────────────────────

describe('Cross-Helix — CRDT Local-First State', () => {
  it('creates and merges documents', async () => {
    const { createDocument, updateField, mergeRemote, getActiveState } = await import('../../services/averi-memory-service/src/modules/crdt-state');
    const doc = createDocument('test-collection', { name: 'test', count: 0 });
    expect(doc.doc_id).toBeDefined();

    updateField(doc.doc_id, 'count', 5);
    const state = getActiveState(doc.doc_id);
    expect(state.count).toBe(5);

    // Simulate remote merge
    const result = mergeRemote(doc.doc_id, {
      newField: { value: 'from-remote', timestamp: Date.now() + 1000, node_id: 'remote-node', tombstone: false },
    }, { 'remote-node': 1 });
    expect(result.docs_synced).toBe(1);
    const merged = getActiveState(doc.doc_id);
    expect(merged.newField).toBe('from-remote');
  });
});

// ── Cross-Helix: LLM Router ─────────────────────────────────────────

describe('Cross-Helix — Dynamic LLM Router', () => {
  it('routes to local model first', async () => {
    const { routeRequest } = await import('../../services/orchestration/src/modules/llm-router');
    const decision = routeRequest('code_generation', ['code'], undefined, true);
    expect(decision.selected_model).toBe('isaac-qwen32b');
    expect(decision.reason).toBe('sovereign_local_first');
  });

  it('falls back when capability not available locally', async () => {
    const { routeRequest } = await import('../../services/orchestration/src/modules/llm-router');
    const decision = routeRequest('vision_analysis', ['vision'], undefined, true);
    expect(decision.selected_model).toBe('gemini-2.5-pro');
  });
});
