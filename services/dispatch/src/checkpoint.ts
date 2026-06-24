// Creative Liberation Engine Dispatch — Checkpoint/Resume Protocol (WS-02)
// Persists long-horizon task state for failure recovery and multi-day execution.

import { v4 as uuidv4 } from 'uuid';
import { db } from './store.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Checkpoint {
    checkpoint_id: string;
    task_id: string;
    agent_id: string;
    step_index: number;
    total_steps: number | null;
    state: Record<string, unknown>;
    artifacts: string[];
    next_action: string | null;
    resources_consumed: ResourceUsage;
    trigger: CheckpointTrigger;
    created_at: string; // ISO8601
}

export interface ResourceUsage {
    gpu_minutes: number;
    api_calls: number;
    tokens_processed: number;
}

export interface ResourceBudget {
    gpu_minutes: number;       // default 1440 (24h)
    api_calls: number;         // default 10000
    tokens_processed: number;  // default 50_000_000
    wall_clock_hours: number;  // default 168 (7d)
    sub_agent_spawns: number;  // default 50
}

export type CheckpointTrigger = 'time' | 'step' | 'event' | 'preemptive' | 'manual';

export type PriorityLane = 'critical' | 'production' | 'background' | 'speculative';

export const LANE_LIMITS: Record<PriorityLane, { maxConcurrent: number; maxDurationHours: number | null }> = {
    critical:    { maxConcurrent: 2,  maxDurationHours: null },
    production:  { maxConcurrent: 5,  maxDurationHours: 48 },
    background:  { maxConcurrent: 10, maxDurationHours: 168 },
    speculative: { maxConcurrent: 3,  maxDurationHours: 24 },
};

export const DEFAULT_BUDGET: ResourceBudget = {
    gpu_minutes: 1440,
    api_calls: 10_000,
    tokens_processed: 50_000_000,
    wall_clock_hours: 168,
    sub_agent_spawns: 50,
};

// ── Schema Migration ─────────────────────────────────────────────────────────

const CHECKPOINT_SCHEMA = `
    CREATE TABLE IF NOT EXISTS task_checkpoints (
        checkpoint_id      TEXT PRIMARY KEY,
        task_id            TEXT NOT NULL,
        agent_id           TEXT NOT NULL,
        step_index         INTEGER NOT NULL DEFAULT 0,
        total_steps        INTEGER,
        state              JSONB NOT NULL DEFAULT '{}'::jsonb,
        artifacts          TEXT,    -- JSON array
        next_action        TEXT,
        resources_consumed JSONB NOT NULL DEFAULT '{"gpu_minutes":0,"api_calls":0,"tokens_processed":0}'::jsonb,
        trigger            TEXT NOT NULL DEFAULT 'manual',
        created_at         TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_checkpoints_task ON task_checkpoints(task_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_created ON task_checkpoints(created_at DESC);

    CREATE TABLE IF NOT EXISTS task_budgets (
        task_id             TEXT PRIMARY KEY,
        lane                TEXT NOT NULL DEFAULT 'background',
        gpu_minutes         INTEGER NOT NULL DEFAULT 1440,
        api_calls           INTEGER NOT NULL DEFAULT 10000,
        tokens_processed    BIGINT NOT NULL DEFAULT 50000000,
        wall_clock_hours    INTEGER NOT NULL DEFAULT 168,
        sub_agent_spawns    INTEGER NOT NULL DEFAULT 50,
        budget_warning_sent BOOLEAN NOT NULL DEFAULT FALSE,
        created_at          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dead_letter_queue (
        id          TEXT PRIMARY KEY,
        task_id     TEXT NOT NULL,
        agent_id    TEXT,
        reason      TEXT NOT NULL,
        checkpoint  JSONB,
        retries     INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        created_at  TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_dlq_task ON dead_letter_queue(task_id);
`;

export async function ensureCheckpointSchema(): Promise<void> {
    await db().query(CHECKPOINT_SCHEMA);
    console.log('[checkpoint] Schema ready.');
}

// ── Checkpoint CRUD ──────────────────────────────────────────────────────────

export async function saveCheckpoint(cp: Checkpoint): Promise<void> {
    await db().query(`
        INSERT INTO task_checkpoints (
            checkpoint_id, task_id, agent_id, step_index, total_steps,
            state, artifacts, next_action, resources_consumed, trigger, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [
        cp.checkpoint_id, cp.task_id, cp.agent_id, cp.step_index,
        cp.total_steps, JSON.stringify(cp.state),
        JSON.stringify(cp.artifacts), cp.next_action,
        JSON.stringify(cp.resources_consumed), cp.trigger, cp.created_at,
    ]);
}

export async function getLatestCheckpoint(taskId: string): Promise<Checkpoint | null> {
    const { rows } = await db().query(
        `SELECT * FROM task_checkpoints WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [taskId],
    );
    if (!rows.length) return null;
    return rowToCheckpoint(rows[0]);
}

export async function getCheckpoints(taskId: string): Promise<Checkpoint[]> {
    const { rows } = await db().query(
        `SELECT * FROM task_checkpoints WHERE task_id = $1 ORDER BY created_at ASC`,
        [taskId],
    );
    return rows.map(rowToCheckpoint);
}

function rowToCheckpoint(row: Record<string, unknown>): Checkpoint {
    return {
        checkpoint_id: row.checkpoint_id as string,
        task_id: row.task_id as string,
        agent_id: row.agent_id as string,
        step_index: row.step_index as number,
        total_steps: row.total_steps as number | null,
        state: typeof row.state === 'string' ? JSON.parse(row.state) : (row.state as Record<string, unknown>),
        artifacts: row.artifacts ? (typeof row.artifacts === 'string' ? JSON.parse(row.artifacts) : row.artifacts) as string[] : [],
        next_action: row.next_action as string | null,
        resources_consumed: typeof row.resources_consumed === 'string'
            ? JSON.parse(row.resources_consumed)
            : (row.resources_consumed as ResourceUsage),
        trigger: row.trigger as CheckpointTrigger,
        created_at: row.created_at as string,
    };
}

// ── Budget Management ────────────────────────────────────────────────────────

export async function setBudget(taskId: string, lane: PriorityLane, overrides?: Partial<ResourceBudget>): Promise<void> {
    const budget = { ...DEFAULT_BUDGET, ...overrides };
    await db().query(`
        INSERT INTO task_budgets (task_id, lane, gpu_minutes, api_calls, tokens_processed, wall_clock_hours, sub_agent_spawns, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT(task_id) DO UPDATE SET
            lane=EXCLUDED.lane, gpu_minutes=EXCLUDED.gpu_minutes,
            api_calls=EXCLUDED.api_calls, tokens_processed=EXCLUDED.tokens_processed,
            wall_clock_hours=EXCLUDED.wall_clock_hours, sub_agent_spawns=EXCLUDED.sub_agent_spawns
    `, [taskId, lane, budget.gpu_minutes, budget.api_calls, budget.tokens_processed, budget.wall_clock_hours, budget.sub_agent_spawns, new Date().toISOString()]);
}

export interface BudgetStatus {
    lane: PriorityLane;
    budget: ResourceBudget;
    consumed: ResourceUsage;
    percentages: { gpu: number; api: number; tokens: number };
    warning: boolean;
    exceeded: boolean;
}

export async function checkBudget(taskId: string): Promise<BudgetStatus | null> {
    const { rows: budgetRows } = await db().query('SELECT * FROM task_budgets WHERE task_id = $1', [taskId]);
    if (!budgetRows.length) return null;

    const b = budgetRows[0];
    const cp = await getLatestCheckpoint(taskId);
    const consumed = cp?.resources_consumed ?? { gpu_minutes: 0, api_calls: 0, tokens_processed: 0 };

    const pGpu = (consumed.gpu_minutes / (b.gpu_minutes as number)) * 100;
    const pApi = (consumed.api_calls / (b.api_calls as number)) * 100;
    const pTokens = (consumed.tokens_processed / (b.tokens_processed as number)) * 100;

    const warning = pGpu >= 80 || pApi >= 80 || pTokens >= 80;
    const exceeded = pGpu >= 100 || pApi >= 100 || pTokens >= 100;

    return {
        lane: b.lane as PriorityLane,
        budget: {
            gpu_minutes: b.gpu_minutes as number,
            api_calls: b.api_calls as number,
            tokens_processed: Number(b.tokens_processed),
            wall_clock_hours: b.wall_clock_hours as number,
            sub_agent_spawns: b.sub_agent_spawns as number,
        },
        consumed,
        percentages: { gpu: pGpu, api: pApi, tokens: pTokens },
        warning,
        exceeded,
    };
}

// ── Dead Letter Queue ────────────────────────────────────────────────────────

export async function sendToDeadLetter(taskId: string, agentId: string | null, reason: string, retries: number): Promise<void> {
    const cp = await getLatestCheckpoint(taskId);
    await db().query(`
        INSERT INTO dead_letter_queue (id, task_id, agent_id, reason, checkpoint, retries, max_retries, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [uuidv4(), taskId, agentId, reason, cp ? JSON.stringify(cp) : null, retries, 3, new Date().toISOString()]);
}

export async function getDeadLetterItems(): Promise<any[]> {
    const { rows } = await db().query(
        `SELECT * FROM dead_letter_queue WHERE resolved_at IS NULL ORDER BY created_at DESC`,
    );
    return rows;
}

export async function resolveDeadLetter(id: string, resolvedBy: string): Promise<boolean> {
    const { rowCount } = await db().query(
        `UPDATE dead_letter_queue SET resolved_at = $1, resolved_by = $2 WHERE id = $3`,
        [new Date().toISOString(), resolvedBy, id],
    );
    return (rowCount ?? 0) > 0;
}

// ── Helper: Create checkpoint from agent heartbeat ───────────────────────────

export function createCheckpoint(
    taskId: string,
    agentId: string,
    stepIndex: number,
    trigger: CheckpointTrigger,
    state: Record<string, unknown> = {},
    resources: Partial<ResourceUsage> = {},
): Checkpoint {
    return {
        checkpoint_id: uuidv4(),
        task_id: taskId,
        agent_id: agentId,
        step_index: stepIndex,
        total_steps: null,
        state,
        artifacts: [],
        next_action: null,
        resources_consumed: {
            gpu_minutes: resources.gpu_minutes ?? 0,
            api_calls: resources.api_calls ?? 0,
            tokens_processed: resources.tokens_processed ?? 0,
        },
        trigger,
        created_at: new Date().toISOString(),
    };
}
