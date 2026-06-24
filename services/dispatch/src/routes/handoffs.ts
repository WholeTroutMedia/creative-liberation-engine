import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

// ── Types ─────────────────────────────────────────────────────────────────────

type HandoffFrom = 'NAVD' | 'NAVD-M' | 'PERPLEXITY' | 'ANTIGRAVITY' | 'CLAUDE-CODE' | 'CLAUDE-CURSOR';
type HandoffPhase = 'IDEATION' | 'DESIGN' | 'PLAN' | 'SHIP' | 'VALIDATION' | 'COMPLETE';

interface HandoffState {
  from: HandoffFrom;
  phase: HandoffPhase;
  task: string;
  taskId?: string;
  workstream?: string;
  agent_id?: string;
  outputs: string[];
  next: string;
  context: string;
  timestamp: string;
  veraMemoryRef?: string | null;
  qa_status?: string;
  network?: 'public' | 'lan';
}

// ── In-memory store + optional file persistence ────────────────────────────────

let latestHandoff: HandoffState | null = null;
const handoffHistory: HandoffState[] = [];

const HANDOFF_FILE = process.env.HANDOFF_STORE_FILE
  ? path.resolve(process.env.HANDOFF_STORE_FILE)
  : path.join(process.env.DISPATCH_STORE_DIR ?? '/data', 'handoffs.json');

function persistHandoff(h: HandoffState): void {
  try {
    const dir = path.dirname(HANDOFF_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(HANDOFF_FILE, JSON.stringify({ latest: h, history: handoffHistory.slice(-50) }, null, 2));
  } catch {
    // Non-fatal — in-memory store is the source of truth
  }
}

function loadPersistedHandoffs(): void {
  try {
    if (fs.existsSync(HANDOFF_FILE)) {
      const raw = JSON.parse(fs.readFileSync(HANDOFF_FILE, 'utf8')) as { latest: HandoffState; history: HandoffState[] };
      latestHandoff = raw.latest ?? null;
      handoffHistory.push(...(raw.history ?? []));
    }
  } catch {
    // Ignore — start fresh
  }
}

// Load on module init
loadPersistedHandoffs();

// ── Router ────────────────────────────────────────────────────────────────────

const router: Router = Router();

/** POST /api/handoffs — Write a new handoff state */
router.post('/api/handoffs', (req: Request, res: Response): void => {
  const body = req.body as HandoffState;
  if (!body.from || !body.phase || !body.task) {
    res.status(400).json({ error: 'Missing required fields: from, phase, task' });
    return;
  }
  const handoff: HandoffState = {
    ...body,
    timestamp: body.timestamp ?? new Date().toISOString(),
  };
  latestHandoff = handoff;
  handoffHistory.push(handoff);
  persistHandoff(handoff);

  // Broadcast via SSE so IDE agents can react immediately
  res.json({ ok: true, handoff });
});

/** GET /api/handoffs/latest — Read the latest handoff state */
router.get('/api/handoffs/latest', (_req: Request, res: Response): void => {
  if (!latestHandoff) {
    res.status(404).json({ error: 'No handoff on record' });
    return;
  }
  res.json(latestHandoff);
});

/** GET /api/handoffs — List recent handoff history */
router.get('/api/handoffs', (_req: Request, res: Response): void => {
  res.json({ handoffs: handoffHistory.slice(-20), total: handoffHistory.length });
});

export { router as handoffsRouter };
