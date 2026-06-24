/**
 * packages/dispatch/src/worker.ts
 * Creative Liberation Engine — Autonomous Dispatch Worker
 *
 * Background agent loop that:
 *   1. Polls the dispatch task queue every POLL_INTERVAL ms
 *   2. Claims tasks up to WORKER_CONCURRENCY slots simultaneously
 *   3. AI-routes each task to the correct Genkit flow or HTTP endpoint
 *   4. Executes concurrently, marks done, refills slots — flows, not drips
 *
 * Env vars:
 *   WORKER_CONCURRENCY  — max parallel tasks (default: 4)
 *   WORKER_POLL_MS      — queue poll interval when idle (default: 5000)
 *   WORKER_ID           — identity prefix (default: dispatch-worker-<pid>)
 *   GENKIT_URL          — Genkit API base (default: http://localhost:4100)
 *   DISPATCH_URL        — Dispatch server (default: http://localhost:5160)
 *
 * Run standalone: node dist/worker.js
 * Or as a Docker service alongside the dispatch server.
 *
 * Constitutional: Article IX (Ship Complete), Article XX (No human wait time)
 */

import {
    getTasks,
    getTask,
    saveTask,
    getAgent,
    saveAgent,
    ensureStore,
    resolvePrediction,
    tryClaimTaskAtomic,
    reclaimStaleActiveTasks,
} from './store.js';
import type { Task } from './types.js';
import { normalizeSmsE164 } from './telnyx-sms-utils.js';
import { v4 as uuidv4 } from 'uuid';

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS  = parseInt(process.env.WORKER_POLL_MS    ?? '5000');
const CONCURRENCY       = parseInt(process.env.WORKER_CONCURRENCY ?? '4');
const GENKIT_URL        = process.env.GENKIT_URL    ?? 'http://localhost:4100';
const DISPATCH_URL      = process.env.DISPATCH_URL  ?? 'http://localhost:5160';
const WORKER_ID_PREFIX  = process.env.WORKER_ID     ?? `dispatch-worker-${process.pid}`;
const PROJECT           = process.env.PROJECT        ?? 'creative-liberation-engine';

function normalizeProject(project: string | null | undefined): string {
    return (project ?? '').trim().toLowerCase();
}

// ── Mesh Router (lazy) ────────────────────────────────────────────────────────

let _meshRouter: { routeTask(d: string, o?: Record<string, number>): { tier: string; tierReason: string; classificationMs: number } } | null = null;
let _modelScorecard: { applyPredictionFeedback(modelId: string, errorScore: number): void } | null = null;

async function getMeshRouter() {
    if (_meshRouter) return { meshRouter: _meshRouter, modelScorecard: _modelScorecard };
    try {
        // @ts-ignore — cross-package dynamic import
        const mod = await import('@creative-liberation-engine/model-arbitrage');
        _meshRouter = mod.meshRouter ?? null;
        _modelScorecard = mod.modelScorecard ?? null;
    } catch { /* model-arbitrage not built yet */ }
    return { meshRouter: _meshRouter, modelScorecard: _modelScorecard };
}

let _memoryTierManager: any = null;
async function getMemoryTierManager() {
    if (_memoryTierManager !== null) return _memoryTierManager;
    try {
        // @ts-ignore
        const mod = await import('@cle/memory');
        _memoryTierManager = mod.memoryBus ?? undefined;
    } catch { _memoryTierManager = undefined; }
    return _memoryTierManager;
}

// ── State ─────────────────────────────────────────────────────────────────────

let running        = true;
let tasksCompleted = 0;
let tasksFailed    = 0;

/** Currently active task IDs — guards against double-claim across concurrent slots */
const activeTaskIds = new Set<string>();

// ── Idle Tracking ─────────────────────────────────────────────────────────────
const IDLE_THRESHOLD_MS = parseInt(process.env.DREAM_IDLE_THRESHOLD_MS ?? '300000'); // 5min
let idleTimerMs = 0;
let lastIdleEmitMs = 0;

async function handleIdleState(slotId: string) {
    if (activeTaskIds.size > 0) {
        idleTimerMs = 0;
        return;
    }
    
    // Only slot-0 coordinates the emit so we don't spam 4 identical events
    if (slotId !== 'slot-0') return;

    idleTimerMs += POLL_INTERVAL_MS;

    if (idleTimerMs >= IDLE_THRESHOLD_MS) {
        const now = Date.now();
        // Debounce: only emit once per hour max
        if (now - lastIdleEmitMs > 3600_000) {
            console.log(`[WORKER] 💤 System idle for ${idleTimerMs/1000}s. Emitting DISPATCH_IDLE. | threshold: ${IDLE_THRESHOLD_MS/1000}s`);
            try {
                // Trigger the dispatch server loop
                await fetch(`${DISPATCH_URL}/api/dream/trigger`, { method: 'POST' });
                lastIdleEmitMs = now;
            } catch (err: any) {
                console.warn(`[WORKER] Failed to emit DISPATCH_IDLE trigger: ${err.message}`);
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER — maps task workstream/keywords → execution handler
// ─────────────────────────────────────────────────────────────────────────────

type TaskResult = { success: boolean; output?: string; artifacts?: string[]; error?: string };

async function routeAndExecute(task: Task): Promise<TaskResult> {
    const ws    = task.workstream.toLowerCase();
    const title = task.title.toLowerCase();

    // Anticipatory Context Injection
    let anticipatoryContext = '';
    const mm = await getMemoryTierManager();
    if (mm) {
        try {
            const memories = await mm.recall({ tier: 'long-term', query: `${task.title} ${task.description ?? ''}`.trim(), limit: 3 });
            if (memories?.length > 0) {
                anticipatoryContext = `\n\n[ANTICIPATORY MEMORY CONTEXT — Lessons from the past]\n` +
                    memories.map((m: any) => `- Task: ${m.task}\n  Outcome: ${m.outcome}`).join('\n\n');
                console.log(`[WORKER] 🧠 Injected ${memories.length} anticipatory memories into task payload`);
            }
        } catch (err) {
            console.warn(`[WORKER] Failed to inject anticipatory context:`, err);
        }
    }

    // ── Communications: Telnyx SMS ────────────────────────────────────────────
    if (ws === 'communications' && task.source === 'telnyx-sms') {
        const rawFrom = task.metadata?.from;
        /** Inbound sender → outbound recipient */
        const replyTo =
            typeof rawFrom === 'string'
                ? normalizeSmsE164(rawFrom)
                : null;
        if (!replyTo) {
            return { success: false, error: 'Missing or invalid "from" number in task.metadata (expected E.164)' };
        }

        const genkitRes = await callGenkit(
            '/generate',
            {
                model: process.env.GENKIT_DEFAULT_MODEL || 'ollama/qwen2.5-coder:32b',
                prompt: `You are replying to an SMS text message. Keep it brief, helpful, and natural.\n\nUser Message: ${task.description}\n\nRespond with plain text only, no markdown.`,
            },
            { requirePlainText: true },
        );

        if (!genkitRes.success || !genkitRes.output) {
            return { success: false, error: 'Failed to generate SMS reply via Genkit' };
        }

        const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
        const TELNYX_FROM_NUMBER = process.env.TELNYX_FROM_NUMBER ?? '+12198001070';
        const fromNumber = normalizeSmsE164(TELNYX_FROM_NUMBER);
        if (!TELNYX_API_KEY) {
            return { success: false, error: 'TELNYX_API_KEY is not configured' };
        }
        if (!fromNumber) {
            return { success: false, error: 'TELNYX_FROM_NUMBER is missing or not valid E.164' };
        }

        const mpid = process.env.TELNYX_MESSAGING_PROFILE_ID?.trim();
        const sendBody: Record<string, unknown> = {
            from: fromNumber,
            to: replyTo,
            text: genkitRes.output,
        };
        if (mpid) {
            sendBody.messaging_profile_id = mpid;
        }

        try {
            const res = await fetch('https://api.telnyx.com/v2/messages', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${TELNYX_API_KEY}`, 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(sendBody),
            });
            const raw = await res.text();
            if (!res.ok) {
                throw new Error(`Telnyx API error: ${res.status} ${raw.slice(0, 500)}`);
            }
            let telnyxMessageId: string | undefined;
            try {
                const parsed = JSON.parse(raw) as {
                    data?: { id?: string };
                    errors?: Array<{ detail?: string; title?: string }>;
                };
                telnyxMessageId = typeof parsed.data?.id === 'string' ? parsed.data.id : undefined;
                if (parsed.errors?.length) {
                    console.warn('[WORKER] Telnyx response included errors:', JSON.stringify(parsed.errors));
                }
                if (parsed.errors?.length && !telnyxMessageId) {
                    throw new Error(`Telnyx rejected send: ${JSON.stringify(parsed.errors).slice(0, 400)}`);
                }
            } catch (e) {
                if (e instanceof Error && e.message.startsWith('Telnyx rejected')) throw e;
                /* non-JSON success body */
            }
            const preview = genkitRes.output.length > 80 ? `${genkitRes.output.slice(0, 80)}…` : genkitRes.output;
            console.log(
                `[WORKER] Telnyx outbound SMS api_ok message_id=${telnyxMessageId ?? 'n/a'} to=${replyTo} chars=${genkitRes.output.length} preview="${preview.replace(/"/g, "'")}"`,
            );
            return { success: true, output: `SMS replied to ${replyTo}` };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    // ── Webhook Ingestion: Tripleseat & Prism.fm ──────────────────────────────
    if (ws === 'webhook.tripleseat') {
        const payload = task.metadata?.raw || task.metadata || {};
        return await callGenkit('/tripleseat/ingest', payload);
    }

    if (ws === 'webhook.prism') {
        const payload = task.metadata?.raw || task.metadata || {};
        return await callGenkit('/prism/ingest', payload);
    }

    // ── IECR Creative Runtime ─────────────────────────────────────────────────
    if (ws === 'iecr' || ws === 'creative' || ws === 'creative-runtime' ||
        title.includes('task graph') || title.includes('creative runtime') || title.includes('iecr')) {
        return await callGenkit('/api/iecr/decompose', {
            prompt: `${task.title}. ${task.description ?? ''}`.trim(),
            sessionId: task.id,
        });
    }

    // ── Campaign DAG ──────────────────────────────────────────────────────────
    if (ws === 'campaign' || title.includes('campaign') || title.includes('brief')) {
        return await runCampaignTask(task);
    }

    // ── AVERI Ideate/Plan ─────────────────────────────────────────────────────
    if (title.includes('ideate') || title.includes('brainstorm') || title.includes('explore')) {
        return await callGenkit('/averi/ideate', { topic: task.title, context: task.description ?? '', depth: 'deep', sessionId: task.id });
    }

    if (title.includes('plan') || title.includes('spec') || title.includes('architecture')) {
        return await callGenkit('/averi/plan', { topic: task.title, context: task.description ?? '', depth: 'deep', sessionId: task.id });
    }

    // ── Research ──────────────────────────────────────────────────────────────
    if (title.includes('research') || title.includes('search') || ws.includes('research')) {
        return await callGenkit('/search', { query: `${task.title}. ${task.description ?? ''}`.trim() });
    }

    // ── Generate (any media/copy) ─────────────────────────────────────────────
    if (title.includes('generate') || title.includes('create') || title.includes('write')) {
        return await callGenkit('/generate', {
            model: process.env.GENKIT_DEFAULT_MODEL || 'ollama/qwen2.5-coder:32b',
            prompt: `You are an autonomous Creative Liberation Engine agent completing this task:\n\nTitle: ${task.title}\nDescription: ${task.description ?? 'No additional description'}\nAcceptance Criteria: ${task.acceptance_criteria?.join(', ') || 'Complete the task as described'}${anticipatoryContext}\n\n[TOOL ABSTENTION PROTOCOL (Metis)]\nBefore using any external tools, determine if you already possess the knowledge to complete the request. DO NOT invoke tools redundantly. If tools are necessary, BATCH your requests to minimize latency and token overhead.\n\nProduce a detailed, complete output. Be specific and actionable.`,
        });
    }

    // ── Default: ATHENA strategic routing ────────────────────────────────────
    return await callGenkit('/generate', {
        model: process.env.GENKIT_DEFAULT_MODEL || 'ollama/deepseek-r1:32b',
        system: `You are ATHENA, the strategic director of the Creative Liberation Engine. You are executing tasks autonomously from the dispatch queue.\n\n[TOOL ABSTENTION PROTOCOL (Metis)]\nOptimize execution by heavily penalizing redundant tool calls. Rely on internal knowledge where sufficient. If external data or actions are required, combine them into the minimum number of tool invocations possible. Avoid loop spamming.`,
        prompt: `Complete this task and produce a concrete, actionable output:\n\nTask ID: ${task.id}\nWorkstream: ${task.workstream}\nTitle: ${task.title}\nDescription: ${task.description ?? 'No additional description'}\nPriority: ${task.priority}\nAcceptance Criteria: ${task.acceptance_criteria?.join('\n- ') || 'Complete the task'}${anticipatoryContext}\n\nProduce complete output that satisfies the acceptance criteria.`,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN TASK HANDLER
// ─────────────────────────────────────────────────────────────────────────────

async function runCampaignTask(task: Task): Promise<TaskResult> {
    try {
        const campaignIdMatch = task.description?.match(/campaign[_-]?id[:\s]+([a-zA-Z0-9-]+)/i);
        if (campaignIdMatch) {
            const campaignId = campaignIdMatch[1];
            const res = await fetch(`http://campaign:3002/execute/${campaignId}`, { method: 'POST' });
            if (!res.ok) throw new Error(`Campaign execute returned ${res.status}`);
            const data = await res.json() as { id: string; status: string };
            return { success: true, output: `Campaign ${campaignId} executed — status: ${data.status}` };
        }
        return await callGenkit('/averi/plan', { topic: `Campaign execution: ${task.title}`, context: task.description ?? '', sessionId: task.id });
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENKIT HTTP HELPER
// ─────────────────────────────────────────────────────────────────────────────

const GENKIT_API_KEY = process.env.GENKIT_API_KEY?.trim();

type CallGenkitOptions = { requirePlainText?: boolean };

async function callGenkit(
    endpoint: string,
    body: Record<string, unknown>,
    opts?: CallGenkitOptions,
): Promise<TaskResult> {
    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (GENKIT_API_KEY) {
            headers['x-api-key'] = GENKIT_API_KEY;
            headers['Authorization'] = `Bearer ${GENKIT_API_KEY}`;
        }
        const execute = async () => fetch(`${GENKIT_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(600_000),
        });

        let res = await execute();
        if (res.status === 401 || res.status === 403) {
            // One retry helps with occasional auth middleware races during restarts.
            await sleep(350);
            res = await execute();
        }
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(`Genkit ${endpoint} returned ${res.status}${txt ? `: ${txt.slice(0, 220)}` : ''}`);
        }
        const data = await res.json() as Record<string, unknown>;
        if (opts?.requirePlainText) {
            const t = data.text;
            if (typeof t !== 'string' || !t.trim()) {
                return {
                    success: false,
                    error: `Genkit ${endpoint} did not return non-empty text (got ${typeof t})`,
                };
            }
            return { success: true, output: t.trim() };
        }
        const output = typeof data.text === 'string' ? data.text
            : typeof data.directive === 'string' ? data.directive
            : JSON.stringify(data, null, 2);
        return { success: true, output };
    } catch (err: any) {
        return { success: false, error: `Genkit call failed: ${err.message}` };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM + EXECUTE (per-slot)
// ─────────────────────────────────────────────────────────────────────────────

const STALE_ACTIVE_MS = parseInt(process.env.WORKER_STALE_ACTIVE_MS ?? `${10 * 60 * 1000}`, 10);
const RECLAIM_INTERVAL_MS = parseInt(process.env.WORKER_RECLAIM_INTERVAL_MS ?? '60000', 10);
let lastStaleReclaimMs = 0;

async function claimNextTask(slotId: string): Promise<Task | null> {
    const nowMs = Date.now();
    const shouldReclaim = lastStaleReclaimMs === 0 || nowMs - lastStaleReclaimMs >= RECLAIM_INTERVAL_MS;
    if (shouldReclaim) {
        lastStaleReclaimMs = nowMs;
        await reclaimStaleActiveTasks(STALE_ACTIVE_MS);
    }
    const tasks = await getTasks();
    const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

    const eligible = tasks
        .filter(t =>
            t.status === 'queued' &&
            normalizeProject(t.project) === normalizeProject(PROJECT) &&
            !activeTaskIds.has(t.id) &&                          // not already running in another slot
            !t.assigned_to_agent?.toLowerCase().includes('window') &&
            t.dependencies.every(dep => {
                const depTask = tasks.find(x => x.id === dep);
                return !depTask || depTask.status === 'done';
            })
        )
        .sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

    if (eligible.length === 0) return null;

    const now = new Date().toISOString();
    const agentId = `${WORKER_ID_PREFIX}:${slotId}`;

    for (const candidate of eligible) {
        if (activeTaskIds.has(candidate.id)) continue;

        const claimed = await tryClaimTaskAtomic(candidate.id, agentId, now);
        if (!claimed) {
            continue;
        }

        const task = claimed;
        activeTaskIds.add(task.id);

        // Register slot agent
        let agent = await getAgent(agentId);
        if (!agent) {
            agent = {
                agent_id: agentId,
                tool: 'script',
                capabilities: ['genkit', 'campaign', 'research', 'plan', 'ideate'],
                session_id: uuidv4(),
                connected_at: now,
                last_seen: now,
                active_task_id: task.id,
                notifications: [],
            };
        } else {
            agent.active_task_id = task.id;
            agent.last_seen = now;
        }
        await saveAgent(agent);

        // Mesh-tier classification — non-blocking
        getMeshRouter().then(({ meshRouter }) => {
            if (meshRouter) {
                const desc = `${task.title}. ${task.description ?? ''}`.trim();
                const decision = meshRouter.routeTask(desc);
                console.log(`[WORKER:${slotId}] 🗺️  Mesh tier=${decision.tier} ms=${decision.classificationMs} — ${decision.tierReason}`);
            }
        }).catch(() => {});

        return task;
    }

    return null;
}

async function markTaskDone(task: Task, result: TaskResult, slotId: string): Promise<void> {
    const now = new Date().toISOString();
    task.status       = result.success ? 'done' : 'failed';
    task.completed_at = now;
    task.updated      = now;
    if (result.artifacts) task.artifacts = result.artifacts;
    if (result.output) {
        task.handoff_note = result.output.slice(0, 500);
    } else if (!result.success && result.error) {
        task.handoff_note = result.error.slice(0, 500);
    }
    await saveTask(task);

    activeTaskIds.delete(task.id);

    const agentId = `${WORKER_ID_PREFIX}:${slotId}`;
    const agent = await getAgent(agentId);
    if (agent) { agent.active_task_id = null; agent.last_seen = now; await saveAgent(agent); }

    if (result.success && result.output && task.prediction) {
        try {
            const errorScore = await resolvePrediction(task.id, result.output);
            const { modelScorecard } = await getMeshRouter();
            if (modelScorecard && typeof errorScore === 'number') {
                const executorModel = task.assigned_to_capability || 'local_worker';
                modelScorecard.applyPredictionFeedback(executorModel, errorScore);
            }
        } catch (err) {
            console.warn(`[WORKER:${slotId}] Prediction resolution failed:`, err);
        }
    }

    if (result.success) {
        tasksCompleted++;
        console.log(`[WORKER:${slotId}] ✅ ${task.id} — ${task.title.slice(0, 60)}`);
    } else {
        tasksFailed++;
        console.warn(`[WORKER:${slotId}] ❌ ${task.id} — ${result.error}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT RUNNER — each slot is an independent async loop
// ─────────────────────────────────────────────────────────────────────────────

async function runSlot(slotId: string): Promise<void> {
    console.log(`[WORKER:${slotId}] 🟢 Slot started`);

    while (running) {
        try {
            const task = await claimNextTask(slotId);

            if (!task) {
                // No work available — this slot backs off and waits
                await handleIdleState(slotId);
                await sleep(POLL_INTERVAL_MS);
                continue;
            }

            idleTimerMs = 0; // Reset idle tracker when we get a task
            console.log(`[WORKER:${slotId}] 🎯 Claimed: ${task.id} [${task.priority}] — ${task.workstream}`);
            console.log(`[WORKER:${slotId}]    "${task.title.slice(0, 80)}"`);

            const start  = Date.now();
            const result = await routeAndExecute(task);
            const elapsed = ((Date.now() - start) / 1000).toFixed(1);

            await markTaskDone(task, result, slotId);
            console.log(`[WORKER:${slotId}] ⏱️  ${elapsed}s | 🏁 total: ✅ ${tasksCompleted} done | ❌ ${tasksFailed} failed | 🔄 active: ${activeTaskIds.size}/${CONCURRENCY}`);

            // Brief pause between tasks to avoid hammering the store
            await sleep(500);

        } catch (err: any) {
            console.error(`[WORKER:${slotId}] Loop error:`, err.message);
            await sleep(POLL_INTERVAL_MS);
        }
    }

    console.log(`[WORKER:${slotId}] 🔴 Slot stopped`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — spawn N concurrent slots
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    await ensureStore();
    const n = await reclaimStaleActiveTasks(STALE_ACTIVE_MS);
    if (n > 0) {
        console.log(`[WORKER] Startup reclaim: ${n} stale active task(s) returned to queue`);
    }
    lastStaleReclaimMs = Date.now();

    console.log(`[WORKER] 🤖 CLE Dispatch Worker — ${WORKER_ID_PREFIX}`);
    console.log(`[WORKER] 📡 Genkit: ${GENKIT_URL} | Dispatch: ${DISPATCH_URL}`);
    console.log(`[WORKER] ⚡ Concurrency: ${CONCURRENCY} slots | Poll: ${POLL_INTERVAL_MS}ms`);
    console.log(`[WORKER] 🚀 Spawning ${CONCURRENCY} concurrent task slots...`);

    const slots = Array.from({ length: CONCURRENCY }, (_, i) => runSlot(`slot-${i}`));

    // Drain: wait for all slots to finish before exiting on SIGTERM/SIGINT
    await Promise.all(slots);
    console.log('[WORKER] All slots drained. Shutdown complete.');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNALS
// ─────────────────────────────────────────────────────────────────────────────

process.on('SIGTERM', () => {
    running = false;
    console.log(`[WORKER] SIGTERM — draining ${activeTaskIds.size} active tasks, then shutting down...`);
});
process.on('SIGINT', () => {
    running = false;
    console.log(`[WORKER] SIGINT — draining ${activeTaskIds.size} active tasks, then shutting down...`);
});

main().catch(err => {
    console.error('[WORKER] Fatal:', err);
    process.exit(1);
});
