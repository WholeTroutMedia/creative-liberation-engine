// Creative Liberation Engine — Autonomous Agent Loop (WS-03)
// DREAM: Dispatch Routing for Emergent Autonomous Missions
//
// This module implements autonomous task pickup, idle scheduling,
// and self-directed agent execution loops. When the mesh detects
// idle agents and queued tasks, DREAM autonomously matches and
// dispatches without human intervention.
//
// Constitutional: Article XX — No human wait time in task sequences.

import { v4 as uuidv4 } from 'uuid';
import { dispatchEmitter } from './events.js';
import type { Task, Agent, TaskPriority } from './types.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DreamConfig {
    /** How often DREAM checks for idle agents + queued tasks (ms). Default: 15000 */
    pollIntervalMs: number;
    /** Maximum tasks a single DREAM cycle can dispatch. Default: 5 */
    maxDispatchPerCycle: number;
    /** Minimum idle duration before agent is eligible for DREAM pickup (ms). Default: 30000 */
    minIdleBeforePickupMs: number;
    /** Enable speculative task generation when queue is empty. Default: false */
    speculativeEnabled: boolean;
    /** Maximum recursion depth for spawned subtasks. Default: 3 */
    maxSpawnDepth: number;
}

export interface DreamCycleResult {
    cycleId: string;
    timestamp: string;
    idleAgents: string[];
    queuedTasks: string[];
    dispatched: Array<{ agentId: string; taskId: string; reason: string }>;
    skipped: Array<{ taskId: string; reason: string }>;
    speculativeGenerated: number;
    durationMs: number;
}

export interface DreamStats {
    totalCycles: number;
    totalDispatched: number;
    totalSpeculative: number;
    avgCycleDurationMs: number;
    lastCycleAt: string | null;
    uptimeMs: number;
}

// ── Capability Matching ──────────────────────────────────────────────────────

/**
 * Score how well an agent matches a task based on capabilities, workstream,
 * and current load. Higher score = better fit.
 */
export function scoreAgentForTask(agent: Agent, task: Task): number {
    let score = 0;

    // Workstream match: exact match is strong signal
    if (agent.workstream && agent.workstream === task.workstream) {
        score += 50;
    }

    // Capability match: check if agent has the required capability
    if (task.assigned_to_capability && agent.capabilities.includes(task.assigned_to_capability)) {
        score += 40;
    }

    // Agent-specific assignment: if task is assigned to this specific agent
    if (task.assigned_to_agent === agent.agent_id) {
        score += 100; // Override — explicit assignment always wins
    }

    // Prefer agents that have been idle longer (avoids starvation)
    const idleMs = Date.now() - new Date(agent.last_seen).getTime();
    if (idleMs > 60_000) score += 10;  // > 1 min idle
    if (idleMs > 300_000) score += 10; // > 5 min idle

    // Penalize agents with high notification backlog
    if (agent.notifications.length > 5) score -= 10;

    // Priority boost: higher priority tasks get dispatched more aggressively
    const priorityBoost: Record<TaskPriority, number> = {
        'P0': 30,
        'P1': 20,
        'P2': 10,
        'P3': 0,
    };
    score += priorityBoost[task.priority] ?? 0;

    return Math.max(0, score);
}

/**
 * Find the best agent for a task from a pool of idle agents.
 * Returns null if no suitable agent found (score threshold not met).
 */
export function findBestAgent(
    idleAgents: Agent[],
    task: Task,
    minScore: number = 10,
): Agent | null {
    let bestAgent: Agent | null = null;
    let bestScore = -1;

    for (const agent of idleAgents) {
        const score = scoreAgentForTask(agent, task);
        if (score >= minScore && score > bestScore) {
            bestAgent = agent;
            bestScore = score;
        }
    }

    return bestAgent;
}

// ── Dependency Resolution ────────────────────────────────────────────────────

export async function areDependenciesMet(
    task: Task,
    getTaskById: (id: string) => Promise<Task | undefined>,
): Promise<boolean> {
    if (!task.dependencies || task.dependencies.length === 0) return true;

    for (const depId of task.dependencies) {
        const dep = await getTaskById(depId);
        if (!dep || dep.status !== 'done') {
            return false;
        }
    }
    return true;
}

// ── DREAM Autonomous Loop ────────────────────────────────────────────────────

export class DreamScheduler {
    private config: DreamConfig;
    private timer: ReturnType<typeof setInterval> | null = null;
    private stats: DreamStats;
    private startTime: number;

    // External hooks — injected from server.ts
    private getQueuedTasks: () => Promise<Task[]>;
    private getIdleAgents: () => Promise<Agent[]>;
    private getTaskById: (id: string) => Promise<Task | undefined>;
    private claimTask: (taskId: string, agentId: string) => Promise<void>;

    constructor(
        config: Partial<DreamConfig>,
        hooks: {
            getQueuedTasks: () => Promise<Task[]>;
            getIdleAgents: () => Promise<Agent[]>;
            getTaskById: (id: string) => Promise<Task | undefined>;
            claimTask: (taskId: string, agentId: string) => Promise<void>;
        },
    ) {
        this.config = {
            pollIntervalMs: config.pollIntervalMs ?? 15_000,
            maxDispatchPerCycle: config.maxDispatchPerCycle ?? 5,
            minIdleBeforePickupMs: config.minIdleBeforePickupMs ?? 30_000,
            speculativeEnabled: config.speculativeEnabled ?? false,
            maxSpawnDepth: config.maxSpawnDepth ?? 3,
        };
        this.getQueuedTasks = hooks.getQueuedTasks;
        this.getIdleAgents = hooks.getIdleAgents;
        this.getTaskById = hooks.getTaskById;
        this.claimTask = hooks.claimTask;
        this.startTime = Date.now();
        this.stats = {
            totalCycles: 0,
            totalDispatched: 0,
            totalSpeculative: 0,
            avgCycleDurationMs: 0,
            lastCycleAt: null,
            uptimeMs: 0,
        };
    }

    /**
     * Start the autonomous dispatch loop.
     */
    start(): void {
        if (this.timer) return;
        console.log(`[DREAM] Autonomous loop started (poll: ${this.config.pollIntervalMs}ms, max/cycle: ${this.config.maxDispatchPerCycle})`);

        this.timer = setInterval(async () => {
            try {
                await this.runCycle();
            } catch (err) {
                console.error('[DREAM] Cycle error:', err);
            }
        }, this.config.pollIntervalMs);

        // Also listen for idle events for immediate dispatch
        dispatchEmitter.on('dispatch:idle', async () => {
            try {
                await this.runCycle();
            } catch (err) {
                console.error('[DREAM] Idle-triggered cycle error:', err);
            }
        });
    }

    /**
     * Stop the autonomous loop.
     */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            console.log('[DREAM] Autonomous loop stopped');
        }
    }

    /**
     * Execute one DREAM cycle: match idle agents to queued tasks.
     */
    async runCycle(): Promise<DreamCycleResult> {
        const cycleStart = Date.now();
        const cycleId = uuidv4().substring(0, 8);

        const [queuedTasks, allIdleAgents] = await Promise.all([
            this.getQueuedTasks(),
            this.getIdleAgents(),
        ]);

        // Filter to agents that have been idle long enough
        const idleAgents = allIdleAgents.filter(a => {
            const idleMs = Date.now() - new Date(a.last_seen).getTime();
            return idleMs >= this.config.minIdleBeforePickupMs;
        });

        const result: DreamCycleResult = {
            cycleId,
            timestamp: new Date().toISOString(),
            idleAgents: idleAgents.map(a => a.agent_id),
            queuedTasks: queuedTasks.map(t => t.id),
            dispatched: [],
            skipped: [],
            speculativeGenerated: 0,
            durationMs: 0,
        };

        if (idleAgents.length === 0 || queuedTasks.length === 0) {
            // Nothing to do — emit idle signal if both empty
            if (queuedTasks.length === 0 && idleAgents.length > 0) {
                dispatchEmitter.emitSafe('dispatch:idle', { timestamp: new Date().toISOString() });
            }
            result.durationMs = Date.now() - cycleStart;
            this.updateStats(result);
            return result;
        }

        // Sort tasks by priority (P0 first) then by creation date (oldest first)
        const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
        const sortedTasks = [...queuedTasks].sort((a, b) => {
            const pDiff = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
            if (pDiff !== 0) return pDiff;
            return new Date(a.created).getTime() - new Date(b.created).getTime();
        });

        // Track which agents have been assigned this cycle
        const assignedAgents = new Set<string>();
        let dispatched = 0;

        for (const task of sortedTasks) {
            if (dispatched >= this.config.maxDispatchPerCycle) break;

            // Check dependencies
            const depsMet = await areDependenciesMet(task, this.getTaskById);

            if (!depsMet) {
                result.skipped.push({ taskId: task.id, reason: 'dependencies_unmet' });
                continue;
            }

            // Spawn depth check
            if (task.spawn_depth > this.config.maxSpawnDepth) {
                result.skipped.push({ taskId: task.id, reason: `spawn_depth_exceeded (${task.spawn_depth})` });
                continue;
            }

            // Find available agents (not already assigned this cycle)
            const available = idleAgents.filter(a => !assignedAgents.has(a.agent_id));
            if (available.length === 0) break;

            const bestAgent = findBestAgent(available, task);
            if (!bestAgent) {
                result.skipped.push({ taskId: task.id, reason: 'no_capable_agent' });
                continue;
            }

            // Dispatch!
            try {
                await this.claimTask(task.id, bestAgent.agent_id);
                assignedAgents.add(bestAgent.agent_id);
                dispatched++;

                const reason = task.assigned_to_agent === bestAgent.agent_id
                    ? 'explicit_assignment'
                    : `capability_match (score: ${scoreAgentForTask(bestAgent, task)})`;

                result.dispatched.push({
                    agentId: bestAgent.agent_id,
                    taskId: task.id,
                    reason,
                });

                console.log(`[DREAM] Dispatched ${task.id} → ${bestAgent.agent_id} (${reason})`);

                dispatchEmitter.emitSafe('task:claimed', {
                    id: task.id,
                    title: task.title,
                    workstream: task.workstream,
                    priority: task.priority,
                    status: 'active',
                    claimed_by: bestAgent.agent_id,
                });
            } catch (err) {
                console.error(`[DREAM] Failed to dispatch ${task.id} → ${bestAgent.agent_id}:`, err);
                result.skipped.push({ taskId: task.id, reason: `dispatch_error: ${err}` });
            }
        }

        result.durationMs = Date.now() - cycleStart;
        this.updateStats(result);

        if (result.dispatched.length > 0) {
            dispatchEmitter.emitSafe('dispatch:dream-complete', { stats: result });
            console.log(`[DREAM] Cycle ${cycleId} complete: ${result.dispatched.length} dispatched, ${result.skipped.length} skipped (${result.durationMs}ms)`);
        }

        return result;
    }

    private updateStats(result: DreamCycleResult): void {
        this.stats.totalCycles++;
        this.stats.totalDispatched += result.dispatched.length;
        this.stats.totalSpeculative += result.speculativeGenerated;
        this.stats.lastCycleAt = result.timestamp;
        this.stats.uptimeMs = Date.now() - this.startTime;

        // Running average
        const alpha = 0.1;
        this.stats.avgCycleDurationMs =
            this.stats.avgCycleDurationMs * (1 - alpha) + result.durationMs * alpha;
    }

    /**
     * Get current DREAM statistics.
     */
    getStats(): DreamStats {
        return {
            ...this.stats,
            uptimeMs: Date.now() - this.startTime,
        };
    }

    /**
     * Manually trigger a DREAM cycle (e.g. from REST API).
     */
    async triggerCycle(): Promise<DreamCycleResult> {
        return this.runCycle();
    }
}
