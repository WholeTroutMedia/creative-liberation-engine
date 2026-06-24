// Creative Liberation Engine Dispatch — Heartbeat Monitor (WS-02)
// Detects stalled agents via periodic heartbeat polling.
// STALLED agents trigger checkpoint-based failure recovery.

import { db } from './store.js';
import { getAgent, saveAgent, getAgents } from './store.js';
import { getLatestCheckpoint, sendToDeadLetter } from './checkpoint.js';
import type { Task } from './types.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Heartbeat {
    agent_id: string;
    task_id: string;
    status: 'healthy' | 'degraded' | 'stalled';
    current_step: string;
    resource_usage: {
        gpu_utilization: number;
        memory_mb: number;
        cpu_percent: number;
    };
    heartbeat_at: string; // ISO8601
}

// ── Schema ───────────────────────────────────────────────────────────────────

const HEARTBEAT_SCHEMA = `
    CREATE TABLE IF NOT EXISTS agent_heartbeats (
        id           SERIAL PRIMARY KEY,
        agent_id     TEXT NOT NULL,
        task_id      TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'healthy',
        current_step TEXT,
        gpu_util     REAL DEFAULT 0,
        memory_mb    INTEGER DEFAULT 0,
        cpu_percent  REAL DEFAULT 0,
        heartbeat_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_heartbeat_agent ON agent_heartbeats(agent_id);
    CREATE INDEX IF NOT EXISTS idx_heartbeat_time ON agent_heartbeats(heartbeat_at DESC);
`;

export async function ensureHeartbeatSchema(): Promise<void> {
    await db().query(HEARTBEAT_SCHEMA);
    console.log('[heartbeat] Schema ready.');
}

// ── Record Heartbeat ─────────────────────────────────────────────────────────

export async function recordHeartbeat(hb: Heartbeat): Promise<void> {
    await db().query(`
        INSERT INTO agent_heartbeats (agent_id, task_id, status, current_step, gpu_util, memory_mb, cpu_percent, heartbeat_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [
        hb.agent_id, hb.task_id, hb.status, hb.current_step,
        hb.resource_usage.gpu_utilization, hb.resource_usage.memory_mb,
        hb.resource_usage.cpu_percent, hb.heartbeat_at,
    ]);

    // Update agent last_seen
    const agent = await getAgent(hb.agent_id);
    if (agent) {
        agent.last_seen = hb.heartbeat_at;
        agent.status = hb.status === 'healthy' ? 'active' : 'stale';
        await saveAgent(agent);
    }
}

// ── Stale Detection ──────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 60_000;       // 60s expected
const STALE_THRESHOLD = 5;                  // 5 missed = stalled
const STALE_TO_FAILED_MS = 15 * 60_000;    // 15 min → FAILED
const MAX_RETRIES = 3;

export interface StaleAgent {
    agent_id: string;
    task_id: string | null;
    last_heartbeat: string;
    missed_count: number;
    action: 'warning' | 'stalled' | 'failed';
}

export async function detectStaleAgents(): Promise<StaleAgent[]> {
    const agents = await getAgents();
    const now = Date.now();
    const stale: StaleAgent[] = [];

    for (const agent of agents) {
        if (!agent.active_task_id) continue;

        const lastSeen = new Date(agent.last_seen).getTime();
        const elapsed = now - lastSeen;
        const missedCount = Math.floor(elapsed / HEARTBEAT_INTERVAL_MS);

        if (missedCount >= STALE_THRESHOLD) {
            const action = elapsed >= STALE_TO_FAILED_MS ? 'failed' : 'stalled';
            stale.push({
                agent_id: agent.agent_id,
                task_id: agent.active_task_id,
                last_heartbeat: agent.last_seen,
                missed_count: missedCount,
                action,
            });
        } else if (missedCount >= 3) {
            stale.push({
                agent_id: agent.agent_id,
                task_id: agent.active_task_id,
                last_heartbeat: agent.last_seen,
                missed_count: missedCount,
                action: 'warning',
            });
        }
    }

    return stale;
}

// ── Failure Recovery ─────────────────────────────────────────────────────────

/**
 * L1: Self-heal — agent retries from checkpoint (agent-side, not dispatch)
 * L2: Dispatch reassignment — dispatch recovers task from stalled agent
 * L3: Dead letter — exceeded max retries, human escalation
 */
export async function recoverStalledTask(
    taskId: string,
    stalledAgentId: string,
    getTask: (id: string) => Promise<Task | undefined>,
    saveTask: (t: Task) => Promise<void>,
): Promise<{ level: 'L2' | 'L3'; action: string }> {
    const task = await getTask(taskId);
    if (!task) return { level: 'L3', action: 'task_not_found' };

    // Count previous retries
    const { rows } = await db().query(
        `SELECT COUNT(*) as n FROM dead_letter_queue WHERE task_id = $1`,
        [taskId],
    );
    const priorRetries = parseInt(rows[0].n, 10);

    if (priorRetries >= MAX_RETRIES) {
        // L3: Dead letter
        task.status = 'failed';
        task.handoff_note = `[DEAD_LETTER] Exceeded ${MAX_RETRIES} retries. Last agent: ${stalledAgentId}`;
        task.updated = new Date().toISOString();
        await saveTask(task);
        await sendToDeadLetter(taskId, stalledAgentId, 'max_retries_exceeded', priorRetries);
        console.warn(`[heartbeat] Task ${taskId} → DEAD_LETTER (${priorRetries} retries)`);
        return { level: 'L3', action: 'dead_letter' };
    }

    // L2: Reassign — release back to queue with checkpoint data
    const checkpoint = await getLatestCheckpoint(taskId);
    task.status = 'queued';
    task.claimed_by = null;
    task.claimed_at = null;
    task.handoff_note = checkpoint
        ? `[L2_RECOVERY] Stalled agent ${stalledAgentId}. Resume from step ${checkpoint.step_index}. Checkpoint: ${checkpoint.checkpoint_id}`
        : `[L2_RECOVERY] Stalled agent ${stalledAgentId}. No checkpoint — restart from scratch.`;
    task.updated = new Date().toISOString();
    await saveTask(task);

    console.log(`[heartbeat] Task ${taskId} recovered (L2) → re-queued. Prior retries: ${priorRetries}`);
    return { level: 'L2', action: 'requeued' };
}

// ── Monitor Daemon ───────────────────────────────────────────────────────────

let _monitorInterval: ReturnType<typeof setInterval> | null = null;

export function startHeartbeatMonitor(
    getTask: (id: string) => Promise<Task | undefined>,
    saveTask: (t: Task) => Promise<void>,
    intervalMs = 30_000,
): void {
    if (_monitorInterval) return;

    _monitorInterval = setInterval(async () => {
        try {
            const staleAgents = await detectStaleAgents();
            for (const s of staleAgents) {
                if (s.action === 'failed' && s.task_id) {
                    await recoverStalledTask(s.task_id, s.agent_id, getTask, saveTask);
                } else if (s.action === 'stalled') {
                    console.warn(`[heartbeat] Agent ${s.agent_id} STALLED (${s.missed_count} missed heartbeats)`);
                }
            }
        } catch (err) {
            console.error('[heartbeat] Monitor error:', err);
        }
    }, intervalMs);

    console.log(`[heartbeat] Monitor started (interval: ${intervalMs}ms)`);
}

export function stopHeartbeatMonitor(): void {
    if (_monitorInterval) {
        clearInterval(_monitorInterval);
        _monitorInterval = null;
        console.log('[heartbeat] Monitor stopped.');
    }
}
