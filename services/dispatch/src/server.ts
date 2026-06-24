// Creative Liberation Engine Dispatch Server â€” Main Entry Point
// Express HTTP + MCP over SSE transport
// Runs on NAS at 127.0.0.1:5050
// Any MCP-compatible agent connects here â€” no workspace, no config needed

import express, { type Express, type Request, type Response } from 'express';
import { A2AProtocol, A2APacketType, A2ASchemaValidator } from '@creative-liberation-engine/a2a-protocol';
import { WebSocketServer } from 'ws';
import type { KeyObject } from 'node:crypto';
import crypto from 'node:crypto';
import { createTelnyxPublicKey, verifyTelnyxWebhookSignature } from './telnyx-webhook-verify.js';
import {
    inboundDescriptionFromTelnyxPayload,
    normalizeSmsE164,
    normalizeTaskMetadataPhoneFields,
    normalizeTaskPriority,
    type TelnyxInboundMessagePayload,
} from './telnyx-sms-utils.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { v4 as uuidv4 } from 'uuid';
import {
    ensureStore, getTasks, getTask, saveTask, getQueuedTasks,
    getAgents, getAgent, saveAgent, removeAgent, getProjects, saveSession,
    getSecret, setSecret, listSecrets, deleteSecret,
    getBlockers, getBlocker, saveBlocker, runArchiveSweep, getArchivedTasks,
    getUserIntegration, setUserIntegration, deleteUserIntegration,
} from './store.js';
import type { Task, Agent, AgentNotification } from './types.js';
import { migrateFromMarkdown } from './migrate.js';
import * as net from 'net';
import { apiKeyAuth } from './middleware/api-key-auth.js';
import { handoffsRouter } from './routes/handoffs.js';
import { designIngestRouter } from './routes/design-ingest.js';
import { logArchaeonTrainingSample } from './trainingLogger.js';
import { SkillInvoker } from './skill-invoke.js';

const PORT = parseInt(process.env.PORT ?? '5050');
const app = express();

type RequestWithRawBody = Request & { rawBody?: Buffer };

const DISPATCH_TELNYX_ALLOW_UNVERIFIED =
    process.env['DISPATCH_ALLOW_UNVERIFIED_TELNYX'] === 'true' ||
    process.env['DISPATCH_ALLOW_UNVERIFIED_TELNYX'] === '1';

let telnyxPublicKeyCache: KeyObject | undefined;
let telnyxPublicKeyParseFailed = false;

function getDispatchTelnyxPublicKey(): KeyObject | null {
    const raw = process.env['TELNYX_PUBLIC_KEY']?.trim();
    if (!raw) return null;
    if (telnyxPublicKeyParseFailed) return null;
    if (telnyxPublicKeyCache) return telnyxPublicKeyCache;
    try {
        telnyxPublicKeyCache = createTelnyxPublicKey(raw);
        return telnyxPublicKeyCache;
    } catch (e) {
        telnyxPublicKeyParseFailed = true;
        console.error('[dispatch:telnyx] TELNYX_PUBLIC_KEY parse failed:', (e as Error).message);
        return null;
    }
}

function createTaskId(): string {
    // UUID-backed IDs remove same-day collision risk from 3-digit random IDs.
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = uuidv4().replace(/-/g, '').slice(0, 12);
    return `T${day}-${suffix}`;
}

app.use(
    express.json({
        limit: '50mb',
        verify: (req, _res, buf: Buffer) => {
            (req as RequestWithRawBody).rawBody = buf;
        },
    }),
);

app.post('/api/webhooks/telnyx', async (req: Request, res: Response) => {
    const rawBuf = (req as RequestWithRawBody).rawBody;
    if (!rawBuf?.length) {
        res.status(400).send('Missing body');
        return;
    }
    const rawString = rawBuf.toString('utf8');

    let parsed: unknown;
    try {
        parsed = JSON.parse(rawString) as unknown;
    } catch {
        res.status(400).send('Invalid JSON');
        return;
    }

    const signature = req.headers['telnyx-signature-ed25519'] as string | undefined;
    const timestamp = req.headers['telnyx-timestamp'] as string | undefined;
    const pub = getDispatchTelnyxPublicKey();

    if (pub) {
        const v = verifyTelnyxWebhookSignature({
            rawBodyUtf8: rawString,
            signatureHeader: signature,
            timestampHeader: timestamp,
            publicKey: pub,
        });
        if (!v.ok) {
            console.warn(`[dispatch:telnyx] Invalid signature (${v.reason})`);
            res.status(403).json({ error: 'Invalid webhook signature', reason: v.reason });
            return;
        }
    } else if (DISPATCH_TELNYX_ALLOW_UNVERIFIED) {
        console.warn('[dispatch:telnyx] DISPATCH_ALLOW_UNVERIFIED_TELNYX — skipping Ed25519 verification (dev only)');
    } else {
        console.warn('[dispatch:telnyx] Rejecting: TELNYX_PUBLIC_KEY not set');
        res.status(503).json({
            error: 'Telnyx webhook verification not configured',
            detail: 'Set TELNYX_PUBLIC_KEY (Telnyx portal) or DISPATCH_ALLOW_UNVERIFIED_TELNYX=true for local testing.',
        });
        return;
    }

    try {
        const body = parsed as {
            data?: {
                event_type?: string;
                id?: string;
                payload?: TelnyxInboundMessagePayload;
            };
        };
        const event = body?.data;
        if (event?.event_type === 'message.received') {
            const payload = event.payload;
            const fromNumber = normalizeSmsE164(payload?.from?.phone_number);
            const description = inboundDescriptionFromTelnyxPayload(payload ?? {});

            if (fromNumber) {
                console.log(`[dispatch:telnyx] Received SMS from ${fromNumber}: ${description.slice(0, 120)}`);

                const taskId = uuidv4();
                const now = new Date().toISOString();
                // Must match worker PROJECT filter (worker.ts claimNextTask) or tasks are never claimed.
                const dispatchProject = process.env.PROJECT ?? 'creative-liberation-engine-v5';
                const toNumber = normalizeSmsE164(payload?.to?.[0]?.phone_number);
                const task: Task = {
                    id: taskId,
                    org: 'CLE',
                    project: dispatchProject,
                    workstream: 'communications',
                    title: `Incoming SMS from ${fromNumber}`,
                    description,
                    priority: 'P1',
                    status: 'queued',
                    dependencies: [],
                    parent_task_id: null,
                    spawn_depth: 0,
                    spawned_by: 'telnyx',
                    assigned_to_agent: null,
                    assigned_to_capability: null,
                    claimed_by: null,
                    claimed_at: null,
                    completed_at: null,
                    handoff_note: null,
                    artifacts: [],
                    created: now,
                    created_by: 'telnyx',
                    updated: now,
                    source: 'telnyx-sms',
                    metadata: {
                        from: fromNumber,
                        ...(toNumber ? { to: toNumber } : {}),
                        telnyx_event_id: event.id,
                        ...(payload?.id ? { telnyx_message_id: payload.id } : {}),
                        ...(payload?.messaging_profile_id
                            ? { telnyx_messaging_profile_id: payload.messaging_profile_id }
                            : {}),
                    },
                };

                await saveTask(task);
                console.log(`[dispatch:telnyx] Task ${taskId} created for communications worker.`);
            } else {
                console.warn('[dispatch:telnyx] message.received: missing or invalid from.phone_number');
            }
        }
        res.status(200).send('OK');
    } catch (err) {
        console.error('[dispatch:telnyx] Webhook processing error:', err);
        res.status(500).send('Error');
    }
});

app.post('/api/ingress/spark', async (req: Request, res: Response) => {
    try {
        const rawBuf = (req as RequestWithRawBody).rawBody;
        if (!rawBuf?.length) {
            res.status(400).send('Missing request body');
            return;
        }

        const signature = req.headers['x-spark-signature'] as string | undefined;
        if (!signature) {
            console.warn('[dispatch:spark] Rejecting: Missing x-spark-signature header');
            res.status(400).send('Missing signature header');
            return;
        }

        // Retrieve secret key from secure Vault
        const secret = await getSecret('GOOGLE_SPARK_WEBHOOK_SECRET');
        if (!secret) {
            console.warn('[dispatch:spark] Rejecting: GOOGLE_SPARK_WEBHOOK_SECRET is not set in the Vault');
            res.status(503).json({ error: 'Webhook signature verification not configured' });
            return;
        }

        // Verify HMAC SHA256 signature
        const computedSignature = crypto
            .createHmac('sha256', secret)
            .update(rawBuf)
            .digest('hex');

        if (signature !== computedSignature) {
            console.warn('[dispatch:spark] Rejecting: Signature mismatch');
            res.status(403).send('Invalid signature');
            return;
        }

        const body = req.body;
        const { source, event, payload } = body;

        if (!event || !payload) {
            res.status(400).send('Invalid payload schema: missing event or payload');
            return;
        }

        console.log(`[dispatch:spark] Ingested event "${event}" from ${source || 'unknown'}`);

        let taskDescription = payload.description || `Ingested from Google Workspace Spark gateway.\nEvent: ${event}\nDetails: ${JSON.stringify(payload)}`;
        let docMarkdown: string | undefined;

        if (event === 'docs.document_edited' && payload.docId) {
            try {
                const bridgeUrl = process.env.GOOGLE_WORKSPACE_BRIDGE_URL || 'http://127.0.0.1:3090';
                console.log(`[dispatch:spark] docs.document_edited detected. Fetching doc markdown for ID: ${payload.docId} from bridge: ${bridgeUrl}`);
                const bridgeRes = await fetch(`${bridgeUrl}/tools/call`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.GENKIT_API_KEY || 'v6-local-key'}`
                    },
                    body: JSON.stringify({
                        name: 'get_doc_as_markdown',
                        arguments: {
                            documentId: payload.docId
                        }
                    })
                });

                if (bridgeRes.ok) {
                    const result = await bridgeRes.json() as any;
                    // Extract text content from MCP format
                    if (result.content && Array.isArray(result.content)) {
                        const textContent = result.content.find((c: any) => c.type === 'text');
                        if (textContent && textContent.text) {
                            docMarkdown = textContent.text;
                        }
                    } else if (result.result) {
                        docMarkdown = typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
                    }

                    if (docMarkdown) {
                        taskDescription += `\n\n--- Document Content (Markdown) ---\n${docMarkdown}`;
                        console.log(`[dispatch:spark] Successfully fetched document markdown (${docMarkdown.length} characters)`);
                    }
                } else {
                    console.warn(`[dispatch:spark] Bridge failed to fetch doc markdown. Status: ${bridgeRes.status}`);
                }
            } catch (err: any) {
                console.error(`[dispatch:spark] Error calling Workspace bridge: ${err.message}`);
            }
        }

        const taskId = createTaskId();
        const now = new Date().toISOString();
        const dispatchProject = process.env.PROJECT ?? 'creative-liberation-engine';

        const task: Task = {
            id: taskId,
            org: 'WholeTroutMedia',
            project: dispatchProject,
            workstream: payload.workstream || 'general',
            title: payload.title || `Spark Event: ${event}`,
            description: taskDescription,
            priority: normalizeTaskPriority(payload.priority, 'P2'),
            status: 'queued',
            dependencies: [],
            parent_task_id: null,
            spawn_depth: 0,
            spawned_by: 'google-spark-mesh',
            assigned_to_agent: payload.assigned_to_agent || null,
            assigned_to_capability: payload.assigned_to_capability || null,
            claimed_by: null,
            claimed_at: null,
            completed_at: null,
            handoff_note: null,
            artifacts: [],
            created: now,
            created_by: 'google-spark-mesh',
            updated: now,
            source: 'google-spark-mesh',
            metadata: {
                spark_event: event,
                spark_source: source || 'google-spark',
                original_payload: payload,
                ...(docMarkdown ? { doc_markdown: docMarkdown } : {})
            },
        };

        await saveTask(task);
        console.log(`[dispatch:spark] Task ${taskId} created and queued successfully.`);

        // Broadcast status update to all connected SSE clients
        try {
            const snap = JSON.parse(await handleTool('get_status', {}));
            broadcastEvent('status', snap);
        } catch (err) {
            console.error('[dispatch:spark] SSE broadcast failed:', err);
        }

        res.status(200).json({ success: true, task_id: taskId });
    } catch (err) {
        console.error('[dispatch:spark] Webhook execution error:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.use('/api', apiKeyAuth);
app.use(handoffsRouter);
app.use(designIngestRouter);

// Track active SSE transports per session
const activeTransports = new Map<string, SSEServerTransport>();

// â”€â”€ Blocker Store (in-memory + broadcast) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Blockers are filed by browser/COMET agents and resolved by IDE agents.
// Blockers are now persisted to SQLite via getBlockers/getBlocker/saveBlocker in store.ts.
// The in-memory Map has been replaced with durable WAL-mode SQLite storage.

export type BlockerSeverity = 'P0' | 'P1' | 'P2';
export type BlockerType = 'terminal' | 'password' | 'sudo' | 'human' | 'blocking-deploy';
export type BlockerStatus = 'OPEN' | 'CLAIMED' | 'RESOLVED';

export interface Blocker {
    id: string;
    severity: BlockerSeverity;
    type: BlockerType;
    filed_by: string;          // agent_id that created it
    task_id?: string;          // related dispatch task (optional)
    description: string;       // exactly what is needed
    claimed_by?: string;       // agent_id that claimed it
    resolved_by?: string;
    resolution_note?: string;
    status: BlockerStatus;
    filed_at: string;          // ISO8601
    updated_at: string;
}

// â”€â”€ Tool Definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TOOLS = [
    // Task Management
    {
        name: 'list_tasks',
        description: 'List tasks from the dispatch queue. Filterable by project, workstream, priority, status, or assigned agent.',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['queued', 'active', 'blocked', 'done', 'failed', 'handoff'], description: 'Filter by status (default: queued)' },
                project: { type: 'string', description: 'Filter by project ID (e.g. creative-liberation-engine-v5)' },
                workstream: { type: 'string', description: 'Filter by workstream (e.g. genkit-flows)' },
                priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
                assigned_to_agent: { type: 'string', description: 'Filter tasks assigned to a specific agent ID' },
                assigned_to_capability: { type: 'string', description: 'Filter tasks assigned to a capability type' },
            },
        },
    },
    {
        name: 'claim_task',
        description: 'Atomically claim a queued task for this agent. Fails if task is already claimed.',
        inputSchema: {
            type: 'object',
            properties: {
                task_id: { type: 'string', description: 'Task ID to claim (e.g. T20260305-001)' },
                agent_id: { type: 'string', description: 'Your agent ID (e.g. cle-window-a)' },
                capabilities: { type: 'array', items: { type: 'string' }, description: 'Your capabilities' },
                tool: { type: 'string', description: 'Tool name (e.g. cle, cursor)' },
            },
            required: ['task_id', 'agent_id'],
        },
    },
    {
        name: 'complete_task',
        description: 'Mark a task as done and optionally attach artifact paths or URLs.',
        inputSchema: {
            type: 'object',
            properties: {
                task_id: { type: 'string' },
                agent_id: { type: 'string' },
                artifacts: { type: 'array', items: { type: 'string' }, description: 'Files or URLs produced' },
                note: { type: 'string', description: 'Completion summary' },
                artifact_payload: { type: 'string', description: 'Large generated artifact payload attached on completion' },
            },
            required: ['task_id', 'agent_id'],
        },
    },
    {
        name: 'force_complete',
        description: 'Force-complete any task regardless of claim status. Use when work was done outside the claim flow (e.g. async agents, pre-claimed work). Requires a handoff note explaining what was done.',
        inputSchema: {
            type: 'object',
            properties: {
                task_id: { type: 'string', description: 'Task ID to force-complete' },
                agent_id: { type: 'string', description: 'Agent ID completing the task' },
                note: { type: 'string', description: 'What was done â€” commit hash, file paths, summary' },
                artifacts: { type: 'array', items: { type: 'string' }, description: 'Produced file paths or URLs' },
                artifact_payload: { type: 'string', description: 'Large generated artifact payload attached on completion' },
            },
            required: ['task_id', 'agent_id', 'note'],
        },
    },
    {
        name: 'add_task',
        description: 'Add a new task to the dispatch queue. Any agent or the user can queue work.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                project: { type: 'string', description: 'Project ID (e.g. creative-liberation-engine-v5)' },
                workstream: { type: 'string' },
                priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'], default: 'P2' },
                description: { type: 'string' },
                acceptance_criteria: { type: 'array', items: { type: 'string' } },
                assigned_to_agent: { type: 'string', description: 'Assign directly to a specific agent ID' },
                assigned_to_capability: { type: 'string', description: 'Assign to any agent with this capability' },
                parent_task_id: { type: 'string', description: 'Parent task ID for subtasks' },
                created_by: { type: 'string', description: 'Your agent_id or "user"' },
                dependencies: { type: 'array', items: { type: 'string' }, description: 'Task IDs that must complete first' },
                spec_payload: { type: 'string', description: 'Large spec data (e.g. Perplexity research HTML/Markdown output)' },
                artifact_payload: { type: 'string', description: 'Large generated artifact or code payload' },
                source: { type: 'string', description: 'Task provenance e.g. telnyx-sms' },
                metadata: { type: 'object', description: 'Opaque JSON; for SMS include { from: E.164 }' },
            },
            required: ['title', 'project', 'workstream', 'created_by'],
        },
    },
    {
        name: 'handoff_task',
        description: 'Release a task back to the queue with a note for the next agent.',
        inputSchema: {
            type: 'object',
            properties: {
                task_id: { type: 'string' },
                agent_id: { type: 'string' },
                note: { type: 'string', description: 'What the next agent needs to know to continue' },
            },
            required: ['task_id', 'agent_id', 'note'],
        },
    },
    {
        name: 'get_status',
        description: 'Get the full dispatch board â€” all active agents, queued/active tasks, sessions.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'list_projects',
        description: 'List all WholeTrout org projects registered in the dispatch server.',
        inputSchema: {
            type: 'object',
            properties: {
                active_only: { type: 'boolean', description: 'Only show active projects (default: true)' },
            },
        },
    },
    // Agent-to-Agent (First-Class)
    {
        name: 'delegate_task',
        description: 'Create a task and assign it directly to a specific agent or capability type. The target agent will receive it as their next pickup.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                project: { type: 'string' },
                workstream: { type: 'string' },
                priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'], default: 'P1' },
                description: { type: 'string' },
                assigned_to_agent: { type: 'string', description: 'Specific agent ID to assign to' },
                assigned_to_capability: { type: 'string', description: 'Any agent with this capability' },
                delegated_by: { type: 'string', description: 'Your agent_id (the delegating agent)' },
                parent_task_id: { type: 'string' },
            },
            required: ['title', 'project', 'workstream', 'delegated_by'],
        },
    },
    {
        name: 'notify_agent',
        description: 'Send a message or signal to a specific connected agent. Use for coordination, reviews, escalations.',
        inputSchema: {
            type: 'object',
            properties: {
                from_agent_id: { type: 'string', description: 'Your agent ID' },
                to_agent_id: { type: 'string', description: 'Target agent ID' },
                message: { type: 'string', description: 'Message or instruction' },
                task_id: { type: 'string', description: 'Related task ID (optional)' },
            },
            required: ['from_agent_id', 'to_agent_id', 'message'],
        },
    },
    {
        name: 'spawn_subtask',
        description: 'Create a child task under a parent. The parent task only completes when all subtasks are done.',
        inputSchema: {
            type: 'object',
            properties: {
                parent_task_id: { type: 'string', description: 'Parent task ID' },
                title: { type: 'string' },
                workstream: { type: 'string' },
                priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'], default: 'P1' },
                description: { type: 'string' },
                assigned_to_capability: { type: 'string' },
                assigned_to_agent: { type: 'string' },
                spawned_by: { type: 'string', description: 'Your agent_id' },
            },
            required: ['parent_task_id', 'title', 'workstream', 'spawned_by'],
        },
    },
    // Vault Operations
    {
        name: 'get_secret',
        description: 'Securely retrieve a decrypted secret/credential from the Vault by its title.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Title of the secret (e.g., OPENAI_API_KEY, github-token)' },
            },
            required: ['title']
        }
    },
    {
        name: 'set_secret',
        description: 'Securely encrypt and store a new secret/credential in the Vault.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Unique title for the secret' },
                value: { type: 'string', description: 'The plain-text secret to encrypt and store' },
            },
            required: ['title', 'value']
        }
    },
    {
        name: 'list_secrets',
        description: 'List all available secret titles stored in the Vault. Does not reveal their values.',
        inputSchema: { type: 'object', properties: {} }
    }
];

// â”€â”€ Tool Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function handleTool(name: string, args: Record<string, unknown>): Promise<string> {
    const now = () => new Date().toISOString();

    switch (name) {

        case 'list_tasks': {
            const status = (args.status as string) ?? 'queued';
            const all = await getTasks();
            let results = all.filter(t => t.status === status);
            if (args.project) results = results.filter(t => t.project === args.project);
            if (args.workstream) results = results.filter(t => t.workstream === args.workstream);
            if (args.priority) results = results.filter(t => t.priority === args.priority);
            if (args.assigned_to_agent) results = results.filter(t => t.assigned_to_agent === args.assigned_to_agent);
            if (args.assigned_to_capability) results = results.filter(t => t.assigned_to_capability === args.assigned_to_capability);
            const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
            results.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));
            return JSON.stringify({ count: results.length, tasks: results }, null, 2);
        }

        case 'claim_task': {
            const task = await getTask(args.task_id as string);
            if (!task) return JSON.stringify({ error: `Task ${args.task_id} not found` });
            if (task.status !== 'queued' && task.status !== 'handoff')
                return JSON.stringify({ error: `Task ${args.task_id} is already ${task.status} by ${task.claimed_by}` });
            task.status = 'active';
            task.claimed_by = args.agent_id as string;
            task.claimed_at = now();
            task.updated = now();
            await saveTask(task);
            // Register agent if not already known
            let agent = await getAgent(args.agent_id as string);
            if (!agent) {
                agent = {
                    agent_id: args.agent_id as string,
                    tool: (args.tool as any) ?? 'unknown',
                    capabilities: (args.capabilities as string[]) ?? [],
                    session_id: uuidv4(),
                    connected_at: now(),
                    last_seen: now(),
                    active_task_id: task.id,
                    notifications: [],
                };
            } else {
                agent.active_task_id = task.id;
                agent.last_seen = now();
            }
            await saveAgent(agent);
            return JSON.stringify({ success: true, task, agent_registered: true });
        }

        case 'complete_task': {
            const task = await getTask(args.task_id as string);
            if (!task) return JSON.stringify({ error: `Task ${args.task_id} not found` });
            if (task.claimed_by !== args.agent_id)
                return JSON.stringify({ error: `Task ${args.task_id} is claimed by ${task.claimed_by}, not ${args.agent_id}` });
            task.status = 'done';
            task.completed_at = now();
            task.updated = now();
            if (args.artifacts) task.artifacts = args.artifacts as string[];
            if (args.note) task.handoff_note = args.note as string;
            if (args.artifact_payload) task.artifact_payload = args.artifact_payload as string;
            await saveTask(task);

            // ARCHAEON: Asynchronously capture this resolution as a training triple
            // Note: We don't await this because we don't want to block the dispatch response
            logArchaeonTrainingSample(task, true, 0).catch(err => console.error('[archaeon]', err));

            // Update agent
            const agent = await getAgent(args.agent_id as string);
            if (agent) { agent.active_task_id = null; agent.last_seen = now(); await saveAgent(agent); }
            // If this is a subtask, check if parent can now complete
            let parentStatus = null;
            if (task.parent_task_id) {
                const allTasks = await getTasks();
                const siblings = allTasks.filter(t => t.parent_task_id === task.parent_task_id && t.id !== task.id);
                if (siblings.every(t => t.status === 'done')) {
                    const parent = await getTask(task.parent_task_id);
                    if (parent && parent.status === 'blocked') {
                        parent.status = 'queued';
                        parent.handoff_note = `All subtasks successfully completed. Resuming parent task execution.`;
                        parent.updated = now();
                        await saveTask(parent);
                        parentStatus = 'all subtasks complete - parent unblocked and queued';
                    } else if (parent) {
                        parentStatus = 'all subtasks complete - parent can now be completed';
                    }
                }
            }
            return JSON.stringify({ success: true, task, parent_note: parentStatus });
        }

        case 'force_complete': {
            const task = await getTask(args.task_id as string);
            if (!task) return JSON.stringify({ error: `Task ${args.task_id} not found` });
            if (task.status === 'done') {
                return JSON.stringify({ success: true, already_done: true, task });
            }
            task.status = 'done';
            task.completed_at = now();
            task.updated = now();
            task.handoff_note = args.note as string;
            task.claimed_by = task.claimed_by ?? (args.agent_id as string);
            if (args.artifacts) task.artifacts = args.artifacts as string[];
            if (args.artifact_payload) task.artifact_payload = args.artifact_payload as string;
            await saveTask(task);

            // ARCHAEON: Asynchronously capture this resolution as a training triple
            logArchaeonTrainingSample(task, true, 0).catch(err => console.error('[archaeon]', err));

            // Clear agent's active task if they had it
            const fcAgent = await getAgent(args.agent_id as string);
            if (fcAgent && fcAgent.active_task_id === task.id) {
                fcAgent.active_task_id = null;
                fcAgent.last_seen = now();
                await saveAgent(fcAgent);
            }
            return JSON.stringify({ success: true, task });
        }

        case 'add_task': {
            // Accept `helix` as an alias for `workstream` (REST convenience)
            const workstream = (args.workstream ?? args.helix ?? 'general') as string;
            const rawMeta =
                args.metadata && typeof args.metadata === 'object' && !Array.isArray(args.metadata)
                    ? (args.metadata as Record<string, unknown>)
                    : undefined;
            const newTask: Task = {
                id: createTaskId(),
                org: 'WholeTroutMedia',
                project: (args.project as string) ?? 'creative-liberation-engine-v5',
                workstream,
                title: args.title as string,
                description: args.description as string | undefined,
                acceptance_criteria: args.acceptance_criteria as string[] | undefined,
                priority: normalizeTaskPriority(args.priority, 'P2'),
                status: 'queued',
                dependencies: (args.dependencies as string[]) ?? [],
                parent_task_id: (args.parent_task_id as string) ?? null,
                spawn_depth: 0,
                spawned_by: null,
                assigned_to_agent: (args.assigned_to_agent as string) ?? null,
                assigned_to_capability: (args.assigned_to_capability as string) ?? null,
                claimed_by: null, claimed_at: null, completed_at: null,
                handoff_note: null, artifacts: [],
                created: now(), created_by: (args.created_by as string) ?? 'system', updated: now(),
                spec_payload: (args.spec_payload as string) ?? undefined,
                artifact_payload: (args.artifact_payload as string) ?? undefined,
                source: typeof args.source === 'string' ? args.source : undefined,
                metadata: normalizeTaskMetadataPhoneFields(rawMeta),
            };
            await saveTask(newTask);
            return JSON.stringify({ success: true, task: newTask });
        }

        case 'handoff_task': {
            const task = await getTask(args.task_id as string);
            if (!task) return JSON.stringify({ error: `Task ${args.task_id} not found` });
            task.status = 'handoff';
            task.claimed_by = null;
            task.claimed_at = null;
            task.handoff_note = args.note as string;
            task.updated = now();
            await saveTask(task);
            const agent = await getAgent(args.agent_id as string);
            if (agent) { agent.active_task_id = null; agent.last_seen = now(); await saveAgent(agent); }
            return JSON.stringify({ success: true, task });
        }

        case 'get_status': {
            const [tasks, agents, projects] = await Promise.all([getTasks(), getAgents(), getProjects()]);
            const queued = tasks.filter(t => t.status === 'queued').length;
            const active = tasks.filter(t => t.status === 'active').length;
            const done = tasks.filter(t => t.status === 'done').length;
            const blocked = tasks.filter(t => t.status === 'blocked').length;
            return JSON.stringify({
                summary: { queued, active, done, blocked, total_agents: agents.length, total_projects: projects.length },
                active_agents: agents.filter(a => a.active_task_id),
                idle_agents: agents.filter(a => !a.active_task_id),
                queued_tasks: tasks.filter(t => t.status === 'queued').slice(0, 10),
                active_tasks: tasks.filter(t => t.status === 'active'),
            }, null, 2);
        }

        case 'list_projects': {
            const projects = await getProjects();
            const filtered = args.active_only !== false ? projects.filter(p => p.active) : projects;
            return JSON.stringify({ count: filtered.length, projects: filtered }, null, 2);
        }

        case 'delegate_task': {
            const delegated: Task = {
                id: createTaskId(),
                org: 'WholeTroutMedia',
                project: args.project as string,
                workstream: args.workstream as string,
                title: args.title as string,
                description: args.description as string | undefined,
                acceptance_criteria: undefined,
                priority: (args.priority as any) ?? 'P1',
                status: 'queued',
                dependencies: [],
                parent_task_id: (args.parent_task_id as string) ?? null,
                spawn_depth: 0,
                spawned_by: args.delegated_by as string,
                assigned_to_agent: (args.assigned_to_agent as string) ?? null,
                assigned_to_capability: (args.assigned_to_capability as string) ?? null,
                claimed_by: null, claimed_at: null, completed_at: null,
                handoff_note: null, artifacts: [],
                created: now(), created_by: args.delegated_by as string, updated: now(),
            };
            await saveTask(delegated);
            // Notify target agent if they're connected
            if (args.assigned_to_agent) {
                const target = await getAgent(args.assigned_to_agent as string);
                if (target) {
                    const notif: AgentNotification = {
                        from: args.delegated_by as string,
                        message: `Delegated task: ${delegated.title} [${delegated.id}]`,
                        task_id: delegated.id,
                        sent_at: now(),
                        read: false,
                    };
                    target.notifications.push(notif);
                    await saveAgent(target);
                }
            }
            return JSON.stringify({ success: true, task: delegated });
        }

        case 'notify_agent': {
            const target = await getAgent(args.to_agent_id as string);
            if (!target) return JSON.stringify({ error: `Agent ${args.to_agent_id} not found or not connected` });
            const notif: AgentNotification = {
                from: args.from_agent_id as string,
                message: args.message as string,
                task_id: args.task_id as string | undefined,
                sent_at: now(),
                read: false,
            };
            target.notifications.push(notif);
            await saveAgent(target);
            return JSON.stringify({ success: true, notification: notif });
        }

        case 'spawn_subtask': {
            const parent = await getTask(args.parent_task_id as string);
            if (!parent) return JSON.stringify({ error: `Parent task ${args.parent_task_id} not found` });
            
            // Phase 4: Ouroboros Limits
            if ((parent.spawn_depth ?? 0) >= 3) {
                return JSON.stringify({ error: `Ouroboros Error: Parent task ${parent.id} is already a deeply nested subtask. Max depth is 3.` });
            }
            if (args.assigned_to_agent && ['ZERO_DAY', 'ATLAS'].includes((args.assigned_to_agent as string).toUpperCase())) {
                return JSON.stringify({ error: `Ouroboros Error: Cannot spawn ZERO_DAY or ATLAS autonomously.` });
            }

            const sub: Task = {
                id: createTaskId(),
                org: parent.org,
                project: parent.project,
                workstream: args.workstream as string,
                title: args.title as string,
                description: args.description as string | undefined,
                acceptance_criteria: undefined,
                priority: (args.priority as any) ?? 'P1',
                status: 'queued',
                dependencies: [],
                parent_task_id: parent.id,
                spawn_depth: (parent.spawn_depth ?? 0) + 1,
                spawned_by: args.spawned_by as string,
                assigned_to_agent: (args.assigned_to_agent as string) ?? null,
                assigned_to_capability: (args.assigned_to_capability as string) ?? null,
                claimed_by: null, claimed_at: null, completed_at: null,
                handoff_note: null, artifacts: [],
                created: now(), created_by: args.spawned_by as string, updated: now(),
            };
            await saveTask(sub);
            return JSON.stringify({ success: true, subtask: sub, parent_id: parent.id });
        }

        case 'list_secrets': {
            const keys = await listSecrets();
            return JSON.stringify({ count: keys.length, secrets: keys }, null, 2);
        }

        case 'get_secret': {
            try {
                const value = await getSecret(args.title as string);
                if (value === undefined) return JSON.stringify({ error: `Secret not found or decryption failed: ${args.title}` });
                return JSON.stringify({ title: args.title, value });
            } catch (err: any) {
                return JSON.stringify({ error: err.message });
            }
        }

        case 'set_secret': {
            try {
                await setSecret(args.title as string, args.value as string);
                return JSON.stringify({ success: true, title: args.title });
            } catch (err: any) {
                return JSON.stringify({ error: err.message });
            }
        }

        default:
            return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
}

// â”€â”€ MCP Server Factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function createMcpServer(): Server {
    const server = new Server(
        { name: 'cle-dispatch', version: '1.0.0' },
        { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const result = await handleTool(req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>);
        return { content: [{ type: 'text', text: result }] };
    });

    return server;
}

// â”€â”€ Express Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// MCP over SSE â€” one transport per client session
app.get('/sse', async (req, res) => {
    const sessionId = uuidv4();
    const transport = new SSEServerTransport('/messages', res);
    activeTransports.set(sessionId, transport);

    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);

    req.on('close', () => {
        activeTransports.delete(sessionId);
        console.log(`[dispatch] Agent disconnected â€” session ${sessionId}`);
    });

    console.log(`[dispatch] Agent connected via SSE â€” session ${sessionId}`);
});

app.post('/messages', async (req, res) => {
    // Route message to correct SSE transport
    const sessionId = req.query.sessionId as string;
    const transport = activeTransports.get(sessionId);
    if (!transport) { res.status(404).json({ error: 'Session not found' }); return; }
    await transport.handlePostMessage(req, res);
});

// REST API â€” plain HTTP for non-MCP clients
app.get('/api/status', async (_, res) => { res.json(JSON.parse(await handleTool('get_status', {}))) });
app.get('/api/tasks', async (req, res) => { res.json(JSON.parse(await handleTool('list_tasks', req.query as any))) });
app.get('/api/projects', async (_, res) => { res.json(JSON.parse(await handleTool('list_projects', {}))) });
// NOTE: POST /api/tasks is defined below with SSE broadcast

const activeA2AAgents = new Map<string, {
  agentId: string;
  version: string;
  capabilities: string[];
  timestamp: number;
}>();

// Agent-to-Agent (A2A) Handshake Endpoint
app.post('/api/a2a/handshake', async (req, res) => {
    try {
        const payload = req.body;
        if (!A2ASchemaValidator.validateHandshake(payload)) {
            res.status(400).json({ error: 'Invalid A2A Handshake payload' });
            return;
        }

        // 1. Register or update the agent details in SQLite store
        const existingAgent = await getAgent(payload.agentId);
        let agentRecord: Agent;
        if (!existingAgent) {
            agentRecord = {
                agent_id: payload.agentId,
                session_id: `a2a-${uuidv4().substring(0, 8)}`,
                capabilities: payload.capabilities,
                connected_at: new Date().toISOString(),
                last_seen: new Date().toISOString(),
                active_task_id: null,
                notifications: [],
                tool: 'cle'
            };
        } else {
            agentRecord = {
                ...existingAgent,
                last_seen: new Date().toISOString(),
                capabilities: Array.from(new Set([...existingAgent.capabilities, ...payload.capabilities]))
            };
        }
        await saveAgent(agentRecord);

        // 2. Track in-memory active A2A agents registry
        activeA2AAgents.set(payload.agentId, {
            agentId: payload.agentId,
            version: payload.version,
            capabilities: payload.capabilities,
            timestamp: Date.now()
        });

        res.json({ success: true, message: 'A2A Handshake successful', agentId: payload.agentId });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// REST API — Agent-to-Agent Dispatch (Wave 1)
app.post('/api/a2a/dispatch', express.raw({ type: 'application/octet-stream', limit: '10mb' }), async (req, res) => {
    try {
        const contentType = req.headers['content-type'];
        
        // Handle binary packet structure
        if (contentType === 'application/octet-stream' && Buffer.isBuffer(req.body)) {
            const packet = A2AProtocol.deserialize(req.body);
            
            if (packet.header.packetType === A2APacketType.HANDSHAKE_REQ) {
                const handshakeData = JSON.parse(packet.payload.toString('utf-8'));
                if (!A2ASchemaValidator.validateHandshake(handshakeData)) {
                    throw new Error('Invalid binary handshake payload');
                }
                activeA2AAgents.set(handshakeData.agentId, {
                    agentId: handshakeData.agentId,
                    version: handshakeData.version,
                    capabilities: handshakeData.capabilities,
                    timestamp: Date.now()
                });
                
                // Return HANDSHAKE_RES packet
                const resBuffer = A2AProtocol.buildHandshake('dispatch-server', '6.0.0', ['broker']);
                const binaryRes = A2AProtocol.serialize(A2APacketType.HANDSHAKE_RES, resBuffer);
                res.setHeader('content-type', 'application/octet-stream');
                res.send(binaryRes);
                return;
            }

            if (packet.header.packetType === A2APacketType.AGENT_MESSAGE) {
                const messageData = JSON.parse(packet.payload.toString('utf-8'));
                if (!A2ASchemaValidator.validateMessage(messageData)) {
                    throw new Error('Invalid binary agent message payload');
                }

                // Route message to receiver
                const target = await getAgent(messageData.receiverId);
                if (!target) {
                    res.status(404).json({ error: `Agent ${messageData.receiverId} not found` });
                    return;
                }

                const notif: AgentNotification = {
                    from: messageData.senderId,
                    message: messageData.body,
                    sent_at: new Date().toISOString(),
                    read: false
                };
                target.notifications.push(notif);
                await saveAgent(target);

                res.setHeader('content-type', 'application/octet-stream');
                res.send(A2AProtocol.serialize(A2APacketType.AGENT_MESSAGE, Buffer.from(JSON.stringify({ success: true, messageId: messageData.messageId }), 'utf-8')));
                return;
            }

            throw new Error(`Unsupported A2A binary packet type: 0x${packet.header.packetType.toString(16)}`);
        }

        // Handle JSON payload structure
        const messageData = req.body;
        if (!A2ASchemaValidator.validateMessage(messageData)) {
            res.status(400).json({ error: 'Invalid A2A Agent Message payload' });
            return;
        }

        const target = await getAgent(messageData.receiverId);
        if (!target) {
            res.status(404).json({ error: `Agent ${messageData.receiverId} not found or not connected` });
            return;
        }

        const notif: AgentNotification = {
            from: messageData.senderId,
            message: messageData.body,
            sent_at: new Date().toISOString(),
            read: false
        };
        target.notifications.push(notif);
        await saveAgent(target);

        res.json({ success: true, messageId: messageData.messageId, delivered: true });
    } catch (err: any) {
        console.error(`[A2A Dispatch Error] ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── Skills Invoke API ─────────────────────────────────────────────────────────
// Agent-to-agent skill dispatch. Any agent POSTs here to receive the full
// instruction set of an agentCallable SKILL.md, enabling autonomous pipelines
// without human mediation: SHIP → VALIDATE → DEPLOY chains run end-to-end.

const skillInvoker = new SkillInvoker();

/** GET /api/skills — list all loaded skills (metadata only, no instructions) */
app.get('/api/skills', (_req, res) => {
    const skills = skillInvoker.list();
    res.json({ count: skills.length, skills });
});

/** GET /api/skills/log — recent invocation telemetry */
app.get('/api/skills/log', (req, res) => {
    const limit = parseInt((req.query.limit as string) ?? '50', 10);
    res.json({ log: skillInvoker.getLog(limit) });
});

/** GET /api/skills/:name — full skill record including instructions */
app.get('/api/skills/:name', (req, res) => {
    const record = skillInvoker.get(req.params.name);
    if (!record) { res.status(404).json({ error: `Skill "${req.params.name}" not found` }); return; }
    res.json(record);
});

/** POST /api/skills/invoke — invoke a skill for agent-to-agent dispatch */
app.post('/api/skills/invoke', (req, res) => {
    const { skill, trigger, context, calledBy, taskId } = req.body as {
        skill?: string; trigger?: string;
        context?: Record<string, unknown>;
        calledBy?: string; taskId?: string;
    };
    if (!skill || !trigger) { res.status(400).json({ error: 'Required: skill, trigger' }); return; }
    const result = skillInvoker.invoke({ skill, trigger, context, calledBy, taskId });
    const status = result.ok ? 200 : result.error?.includes('not found') ? 404 : 403;
    res.status(status).json(result);
    if (result.ok) console.log(`[skills] ${calledBy ?? 'unknown'} → skill:${skill} trigger:${trigger}${taskId ? ` task:${taskId}` : ''}`);
});

/** POST /api/skills/refresh — hot-reload all SKILL.md files from disk */
app.post('/api/skills/refresh', (_req, res) => {
    const count = skillInvoker.refresh();
    res.json({ ok: true, loaded: count, refreshedAt: new Date().toISOString() });
});

// REST API â€” Vault
app.get('/api/vault', async (_, res) => { res.json(JSON.parse(await handleTool('list_secrets', {}))) });
app.post('/api/vault', async (req, res) => { res.json(JSON.parse(await handleTool('set_secret', req.body))) });
app.delete('/api/vault/:id', async (req, res) => {
    const success = await deleteSecret(req.params.id);
    if (!success) { res.status(404).json({ error: `Secret ${req.params.id} not found` }); return; }
    res.json({ success: true });
});

// REST API â€” Peripheral Sovereign Identity (PSI)
app.get('/api/psi/profile', async (req, res) => {
    const deviceClass = req.query.class as string;
    
    // In a full implementation, we would query the database for the user's active Aura for this class.
    // For now, we return a hardcoded default Aura to get the daemon MVP working.
    res.json({
        id: `default-${deviceClass ?? 'unknown'}-1`,
        name: `Default Navigation Aura (${deviceClass})`,
        device_class: deviceClass ?? 'unknown',
        owner: 'system',
        updated_at: new Date().toISOString(),
        mappings: [
            {
                capability: 'side_button_1',
                action: { type: 'os', value: 'browser_back' }
            },
            {
                capability: 'side_button_2',
                action: { type: 'os', value: 'browser_forward' }
            }
        ]
    });
});

// REST API â€” DIRA resolution metrics
app.get('/dira/metrics', async (_, res) => {
    try {
        const allTasks = await getTasks();
        const now = Date.now();
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

        // Build 7-day date buckets
        const buckets: Record<string, { resolved: number; escalated: number; auto_resolved: number }> = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now - i * 24 * 60 * 60 * 1000);
            buckets[d.toISOString().slice(0, 10)] = { resolved: 0, escalated: 0, auto_resolved: 0 };
        }

        let total_cases = 0, auto_resolved = 0, escalated = 0, total_resolve_ms = 0, resolved_count = 0;
        const workflow_map: Record<string, { count: number; auto: number }> = {};
        const type_map: Record<string, number> = {};

        for (const task of allTasks) {
            // Only count tasks from last 7 days
            const created = new Date(task.created ?? task.updated ?? now).getTime();
            if (now - created > SEVEN_DAYS_MS) continue;

            total_cases++;
            const dateKey = new Date(created).toISOString().slice(0, 10);
            const bucket = buckets[dateKey];

            const isDone = task.status === 'done';
            const isEscalated = task.status === 'blocked' || (task as any).escalated;
            const isAutoResolved = isDone && !!(task as any).auto_resolved;

            if (isDone && bucket)    { bucket.resolved++; }
            if (isEscalated && bucket) { bucket.escalated++; escalated++; }
            if (isAutoResolved)      { auto_resolved++; if (bucket) bucket.auto_resolved++; }

            if (isDone) {
                resolved_count++;
                const created_ms = new Date(task.created ?? task.updated ?? now).getTime();
                const updated_ms = new Date(task.updated ?? now).getTime();
                total_resolve_ms += Math.max(0, updated_ms - created_ms);
            }

            // Workflow stats
            const wf = task.workstream ?? 'unknown';
            if (!workflow_map[wf]) workflow_map[wf] = { count: 0, auto: 0 };
            workflow_map[wf].count++;
            if (isAutoResolved) workflow_map[wf].auto++;

            // Type breakdown using workstream as category
            const tp = task.workstream ?? 'general';
            type_map[tp] = (type_map[tp] ?? 0) + 1;
        }

        const top_workflows = Object.entries(workflow_map)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([workflow, s]) => ({
                workflow,
                count: s.count,
                auto_resolved_pct: s.count > 0 ? s.auto / s.count : 0,
            }));

        res.json({
            total_cases,
            auto_resolved,
            escalated,
            avg_resolve_ms: resolved_count > 0 ? Math.round(total_resolve_ms / resolved_count) : 0,
            resolution_rate: total_cases > 0 ? (resolved_count / total_cases) : 0,
            rolling_7d: Object.entries(buckets).map(([date, b]) => ({ date, ...b })),
            top_workflows,
            case_type_breakdown: type_map,
        });
    } catch (err) {
        console.error('[dira/metrics] Error:', err);
        res.status(500).json({ error: String(err) });
    }
});

// â”€â”€ SSE Event Stream (Real-time console) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Track all browser SSE clients
const sseClients = new Set<{
    res: import('express').Response;
    id: string;
}>();

// â”€â”€ Capability Version State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Tracks the current instruction-layer version (AGENTS.md + skills + workflows).
// Incremented whenever a capability_update broadcast is fired.
// Windows compare this on boot to detect stale context.
interface CapabilityVersion {
    hash: string;
    timestamp: string;
    changed_files: string[];
    source: string;
}
let currentCapabilityVersion: CapabilityVersion = {
    hash: 'boot-' + Date.now().toString(36),
    timestamp: new Date().toISOString(),
    changed_files: [],
    source: 'boot',
};

// Push event to all connected SSE clients
function broadcastEvent(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        try { client.res.write(payload); } catch { sseClients.delete(client); }
    }
}

// GET /api/events â€” SSE stream for live console updates
app.get('/api/events', async (req, res) => {
    const clientId = uuidv4();
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ client_id: clientId, timestamp: new Date().toISOString() })}\n\n`);

    // Send full state immediately on connect
    const snap = JSON.parse(await handleTool('get_status', {}));
    res.write(`event: status\ndata: ${JSON.stringify(snap)}\n\n`);

    const client = { res, id: clientId };
    sseClients.add(client);
    console.log(`[dispatch:sse] Client connected â€” ${clientId} (${sseClients.size} total)`);

    // Heartbeat every 20s to keep connection alive through proxies
    const heartbeat = setInterval(() => {
        try { res.write(`:heartbeat\n\n`); } catch { clearInterval(heartbeat); }
    }, 20_000);

    req.on('close', () => {
        clearInterval(heartbeat);
        sseClients.delete(client);
        console.log(`[dispatch:sse] Client disconnected â€” ${clientId} (${sseClients.size} remaining)`);
    });
});

// Patch saveTask + saveAgent to auto-broadcast on every mutation
const _origSaveTask = saveTask;
const _origSaveAgent = saveAgent;
const _origRemoveAgent = removeAgent;

// Wrap with broadcast â€” safe even if broadcast throws
async function broadcastingHandleTool(name: string, args: Record<string, unknown>) {
    const result = await handleTool(name, args);
    // After any mutating tool, push a fresh status snapshot to all SSE clients
    if (['claim_task', 'complete_task', 'add_task', 'handoff_task', 'delegate_task', 'spawn_subtask', 'notify_agent'].includes(name)) {
        try {
            const snap = JSON.parse(await handleTool('get_status', {}));
            broadcastEvent('status', snap);
        } catch { }
    }
    return result;
}

// Override MCP handler to use broadcasting version
function createBroadcastingMcpServer(): Server {
    const server = new Server(
        { name: 'cle-dispatch', version: '1.0.0' },
        { capabilities: { tools: {} } }
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const result = await broadcastingHandleTool(req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>);
        return { content: [{ type: 'text', text: result }] };
    });
    return server;
}

// Also broadcast after REST mutations
app.post('/api/tasks', async (req, res) => {
    const result = JSON.parse(await handleTool('add_task', req.body));
    res.json(result);
    // Broadcast to SSE clients
    try { const snap = JSON.parse(await handleTool('get_status', {})); broadcastEvent('status', snap); } catch { }
});

app.post('/api/tasks/claim', async (req, res) => {
    const result = JSON.parse(await handleTool('claim_task', req.body));
    if (result.error) {
        res.status(400).json(result);
        return;
    }
    res.json(result);
    // Broadcast
    try { const snap = JSON.parse(await handleTool('get_status', {})); broadcastEvent('status', snap); } catch { }
});

app.get('/api/tasks/:id', async (req, res) => {
    let task = await getTask(req.params.id);
    if (!task) {
        // Defensive retry for transient PG read races observed under NAS load.
        for (let i = 0; i < 8 && !task; i++) {
            await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
            task = await getTask(req.params.id);
        }
    }
    if (!task) { res.status(404).json({ error: `Task ${req.params.id} not found` }); return; }
    res.json(task);
});

app.patch('/api/tasks/:id', async (req, res) => {
    const task = await getTask(req.params.id);
    if (!task) { res.status(404).json({ error: `Task ${req.params.id} not found` }); return; }
    const now = new Date().toISOString();
    const allowed: (keyof Task)[] = ['status', 'priority', 'title', 'handoff_note', 'artifacts'];
    for (const key of allowed) { if (req.body[key] !== undefined) (task as any)[key] = req.body[key]; }
    task.updated = now;
    if (req.body.status === 'done' && !task.completed_at) task.completed_at = now;
    await saveTask(task);
    res.json({ success: true, task });
    // Broadcast
    try { const snap = JSON.parse(await handleTool('get_status', {})); broadcastEvent('status', snap); } catch { }
});

// POST /api/tasks/:id/resolve â€” force-complete a task without requiring it to be claimed first.
// Used by Creative Liberation Engine when work is done async or before a formal claim (e.g. stale queue cleanup).
// Body: { agent_id: string, note: string, artifacts?: string[] }
app.post('/api/tasks/:id/resolve', async (req, res) => {
    const { agent_id, note, artifacts } = req.body as {
        agent_id?: string;
        note?: string;
        artifacts?: string[];
    };
    if (!agent_id || !note) {
        res.status(400).json({ error: 'agent_id and note are required' });
        return;
    }
    const result = JSON.parse(
        await handleTool('force_complete', {
            task_id: req.params.id,
            agent_id,
            note,
            ...(artifacts ? { artifacts } : {}),
        })
    );
    if (result.error) {
        res.status(result.error.includes('not found') ? 404 : 400).json(result);
        return;
    }
    res.json(result);
    // Broadcast live status to SSE dashboard
    try { const snap = JSON.parse(await handleTool('get_status', {})); broadcastEvent('status', snap); } catch { }
});

// POST /api/tasks/:id/complete â€” normal completion of a claimed task.
// Body: { agent_id: string, note?: string, artifacts?: string[] }
app.post('/api/tasks/:id/complete', async (req, res) => {
    const { agent_id, note, artifacts } = req.body as {
        agent_id?: string;
        note?: string;
        artifacts?: string[];
    };
    if (!agent_id) {
        res.status(400).json({ error: 'agent_id is required' });
        return;
    }
    const result = JSON.parse(
        await handleTool('complete_task', {
            task_id: req.params.id,
            agent_id,
            ...(note ? { note } : {}),
            ...(artifacts ? { artifacts } : {}),
        })
    );
    if (result.error) {
        res.status(result.error.includes('not found') ? 404 : 400).json(result);
        return;
    }
    res.json(result);
    // Broadcast
    try { const snap = JSON.parse(await handleTool('get_status', {})); broadcastEvent('status', snap); } catch { }
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'cle-dispatch', version: '1.0.0', sse_clients: sseClients.size }));

// ─── User Integrations API ──────────────────────────────────────────────────
app.get('/api/integrations/:uid/:platform', async (req, res) => {
    try {
        const { uid, platform } = req.params;
        const integration = await getUserIntegration(uid, platform);
        if (!integration) {
            res.status(404).json({ error: 'Integration not found' });
            return;
        }
        res.json(integration);
    } catch (err) {
        console.error('[dispatch] Error fetching user integration:', err);
        res.status(500).json({ error: String(err) });
    }
});

app.post('/api/integrations/:uid/:platform', async (req, res) => {
    try {
        const { uid, platform } = req.params;
        const { accountId, credentials, metadata } = req.body;
        await setUserIntegration(uid, platform, accountId || null, credentials, metadata || {});
        res.json({ success: true });
    } catch (err) {
        console.error('[dispatch] Error saving user integration:', err);
        res.status(500).json({ error: String(err) });
    }
});

app.delete('/api/integrations/:uid/:platform', async (req, res) => {
    try {
        const { uid, platform } = req.params;
        const deleted = await deleteUserIntegration(uid, platform);
        res.json({ success: deleted });
    } catch (err) {
        console.error('[dispatch] Error deleting user integration:', err);
        res.status(500).json({ error: String(err) });
    }
});

// â”€â”€ Capability Hot-Reload Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/capabilities/broadcast â€” announce a capability change to all SSE clients.
// Called by the capability-watcher daemon on file changes, or manually by any agent.
// Body: { changed_files?: string[], source?: 'watcher' | 'manual' | 'deploy' }
app.post('/api/capabilities/broadcast', (req, res) => {
    const changed_files: string[] = Array.isArray(req.body?.changed_files) ? req.body.changed_files : [];
    const source: string = typeof req.body?.source === 'string' ? req.body.source : 'manual';
    currentCapabilityVersion = {
        hash: uuidv4().slice(0, 8),
        timestamp: new Date().toISOString(),
        changed_files,
        source,
    };
    broadcastEvent('capability_update', currentCapabilityVersion);
    console.log(`[dispatch:capability] Broadcast fired â€” hash=${currentCapabilityVersion.hash} files=[${changed_files.join(', ')}] source=${source}`);
    res.json({ success: true, version: currentCapabilityVersion, sse_clients_notified: sseClients.size });
});

// GET /api/capabilities/version â€” returns current capability version hash.
// Windows call this on boot to detect whether their loaded context is already stale.
app.get('/api/capabilities/version', (_req, res) => {
    res.json(currentCapabilityVersion);
});

// â”€â”€ Smart Task Pickup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/tasks/next â€” returns the highest-priority unclaimed task that matches
// the requesting agent's capability/workstream, skipping tasks already active in
// another agent. This is the backbone of the /auto-loop protocol.
app.get('/api/tasks/next', async (req, res) => {
    const agentId = req.query.agent_id as string | undefined;
    const capability = req.query.agent_capability as string | undefined;

    const all = await getTasks();
    const agents = await getAgents();

    // Workstreams already held by active (non-stale) agents (excluding caller)
    const activeWorkstreams = new Set<string>();
    for (const a of agents) {
        if (a.agent_id === agentId) continue;
        if (computeStatus(a.last_seen) === 'stale') continue;
        if (a.workstream && a.active_task_id) activeWorkstreams.add(a.workstream);
    }

    const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

    let candidates = all
        .filter(t => t.status === 'queued' || t.status === 'handoff')
        .filter(t => {
            // Skip tasks assigned to a specific different agent
            if (t.assigned_to_agent && t.assigned_to_agent !== agentId) return false;
            // Skip tasks whose workstream is actively held by another agent
            if (activeWorkstreams.has(t.workstream)) return false;
            // Filter by capability match if provided
            if (capability && t.assigned_to_capability && t.assigned_to_capability !== capability) return false;
            // Prefer tasks matching the agent's capability workstream
            return true;
        })
        .sort((a, b) => {
            const pa = priorityOrder[a.priority] ?? 9;
            const pb = priorityOrder[b.priority] ?? 9;
            if (pa !== pb) return pa - pb;
            // Tiebreak: oldest first
            return new Date(a.created).getTime() - new Date(b.created).getTime();
        });

    if (candidates.length === 0) {
        res.json({ next: null, message: 'Queue empty or no tasks match your capabilities' });
        return;
    }

    res.json({ next: candidates[0], queue_depth: candidates.length });
});

// â”€â”€ Blocker API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// The BLOCKER protocol lets browser/COMET agents signal that they need terminal,
// sudo, or password work done. IDE agents pick these up on boot/heartbeat.

// GET /api/blockers â€” list blockers, filter by status and/or severity
app.get('/api/blockers', async (req, res) => {
    const results = await getBlockers({
        status:   req.query.status   as string | undefined,
        severity: req.query.severity as string | undefined,
    });
    res.json({ count: results.length, blockers: results });
});

// POST /api/blockers â€” file a new blocker
app.post('/api/blockers', async (req, res) => {
    const { id, severity, type, filed_by, task_id, description } = req.body as Partial<Blocker>;
    if (!id || !severity || !type || !filed_by || !description) {
        res.status(400).json({ error: 'id, severity, type, filed_by, and description are required' });
        return;
    }
    const existing = await getBlocker(id);
    if (existing) {
        res.status(409).json({ error: `Blocker ${id} already exists` });
        return;
    }
    const now = new Date().toISOString();
    const blocker: Blocker = {
        id, severity, type, filed_by, task_id, description,
        status: 'OPEN', filed_at: now, updated_at: now,
    };
    await saveBlocker(blocker);
    broadcastEvent('blocker', { event: 'filed', blocker });
    console.log(`[dispatch:blockers] OPEN ${severity} ${type} â€” ${id} by ${filed_by}`);
    res.json({ success: true, blocker });
});

// POST /api/blockers/:id/claim â€” IDE agent claims a blocker to work on it
app.post('/api/blockers/:id/claim', async (req, res) => {
    const blocker = await getBlocker(req.params.id);
    if (!blocker) { res.status(404).json({ error: `Blocker ${req.params.id} not found` }); return; }
    if (blocker.status !== 'OPEN') {
        res.status(400).json({ error: `Blocker ${req.params.id} is already ${blocker.status}` });
        return;
    }
    const { agent_id } = req.body as { agent_id?: string };
    if (!agent_id) { res.status(400).json({ error: 'agent_id required' }); return; }
    blocker.status = 'CLAIMED';
    blocker.claimed_by = agent_id;
    blocker.updated_at = new Date().toISOString();
    await saveBlocker(blocker);
    broadcastEvent('blocker', { event: 'claimed', blocker });
    console.log(`[dispatch:blockers] CLAIMED ${blocker.id} by ${agent_id}`);
    res.json({ success: true, blocker });
});

// POST /api/blockers/:id/resolve â€” mark a blocker resolved with a note
app.post('/api/blockers/:id/resolve', async (req, res) => {
    const blocker = await getBlocker(req.params.id);
    if (!blocker) { res.status(404).json({ error: `Blocker ${req.params.id} not found` }); return; }
    const { agent_id, note } = req.body as { agent_id?: string; note?: string };
    if (!agent_id || !note) { res.status(400).json({ error: 'agent_id and note required' }); return; }
    blocker.status = 'RESOLVED';
    blocker.resolved_by = agent_id;
    blocker.resolution_note = note;
    blocker.updated_at = new Date().toISOString();
    await saveBlocker(blocker);
    broadcastEvent('blocker', { event: 'resolved', blocker });
    console.log(`[dispatch:blockers] RESOLVED ${blocker.id} by ${agent_id}: ${note}`);
    res.json({ success: true, blocker });
});

// â”€â”€ Archive API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/archive â€” query tasks_archive (done/failed tasks swept from the hot queue)
// Optional: ?workstream=genkit-flows&project=creative-liberation-engine-v5&limit=50
app.get('/api/archive', async (req, res) => {
    const tasks = await getArchivedTasks({
        workstream: req.query.workstream as string | undefined,
        project:    req.query.project    as string | undefined,
        limit:      req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json({ count: tasks.length, tasks });
});

// POST /api/archive/sweep â€” manually trigger the weekly sweep
// Call after a bulk completion sprint to immediately lean out the hot queue.
app.post('/api/archive/sweep', (_req, res) => {
    const swept = runArchiveSweep();
    res.json({ success: true, swept, message: `Moved ${swept} tasks to archive` });
});

// Redis proxy health check (since Redis has no native HTTP port for dashboard polling)
app.get('/health/redis', (req, res) => {
    const client = net.createConnection({
        host: process.env.REDIS_HOST || '127.0.0.1', // or localhost if running locally
        port: parseInt(process.env.REDIS_PORT || '6379')
    }, () => {
        client.write('PING\r\n');
    });

    let answered = false;
    client.on('data', (data) => {
        if (data.toString().includes('PONG') || data.toString().includes('NOAUTH')) {
            answered = true;
            client.end();
            res.status(200).json({ status: 'ok', service: 'redis' });
        }
    });

    client.on('error', (err) => {
        if (!answered) {
            answered = true;
            res.status(503).json({ status: 'error', error: err.message });
        }
    });

    setTimeout(() => {
        if (!answered) {
            answered = true;
            client.destroy();
            res.status(504).json({ status: 'timeout' });
        }
    }, 2000);
});

// â”€â”€ Agent REST API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/agents â€” list all agents with live stale detection
const STALE_MS = 5 * 60 * 1000;  // 5 minutes
const IDLE_MS = 30 * 1000;      // 30 seconds

function computeStatus(lastSeen: string): 'active' | 'idle' | 'stale' {
    const age = Date.now() - new Date(lastSeen).getTime();
    if (age > STALE_MS) return 'stale';
    if (age > IDLE_MS) return 'idle';
    return 'active';
}

app.get('/api/agents', async (req, res) => {
    const agents = await getAgents();
    const enriched = agents.map(a => ({ ...a, status: computeStatus(a.last_seen) }));

    // ?type= filter: browser-extension | COMET | playwright-headless | cle
    // Agents register their tool type via the heartbeat. This lets /browser-ideate
    // query "give me all active browser-extension agents" without loading the full roster.
    const typeFilter = req.query.type as string | undefined;
    const filtered = typeFilter
        ? enriched.filter(a => (a as any).tool === typeFilter)
        : enriched;

    res.json({
        total: filtered.length,
        active: filtered.filter(a => a.status === 'active'),
        idle: filtered.filter(a => a.status === 'idle'),
        stale: filtered.filter(a => a.status === 'stale'),
    });
});

// GET /api/agents/:id â€” get a specific agent
app.get('/api/agents/:id', async (req, res) => {
    const agent = await getAgent(req.params.id);
    if (!agent) { res.status(404).json({ error: `Agent ${req.params.id} not found` }); return; }
    res.json(agent);
});

// GET /api/agents/:id/tabs â€” return the tab manifest last uploaded by this agent
// Browser extensions push tab_manifest on every heartbeat so this is always fresh.
// Used by /browser-ideate workflow to get the user's real tab list without a round-trip to the extension.
app.get('/api/agents/:id/tabs', async (req, res) => {
    const agent = await getAgent(req.params.id);
    if (!agent) { res.status(404).json({ error: `Agent ${req.params.id} not found` }); return; }
    const manifest = (agent as any).tab_manifest ?? [];
    const status = computeStatus(agent.last_seen);
    res.json({
        agent_id: agent.agent_id,
        browser_family: (agent as any).browser_family ?? 'unknown',
        status,
        tab_count: manifest.length,
        tabs: manifest,
        last_seen: agent.last_seen,
    });
});

// DELETE /api/agents/:id â€” disconnect/remove an agent from the registry
app.delete('/api/agents/:id', async (req, res) => {
    const agent = await getAgent(req.params.id);
    if (!agent) { res.status(404).json({ error: `Agent ${req.params.id} not found` }); return; }
    await removeAgent(req.params.id);
    console.log(`[dispatch] Agent ${req.params.id} removed via REST`);
    res.json({ success: true, removed: req.params.id });
});

// POST /api/agents/heartbeat â€” fire-and-forget from every IDE window on every response
// Body: { agent_id, window?, workstream?, current_task?, tool?, capabilities? }
// Creates agent if not exists. Updates last_seen always. Broadcasts SSE heartbeat event.
app.post('/api/agents/heartbeat', async (req, res) => {
    const now = new Date().toISOString();
    const { agent_id, window: win, workstream, current_task, tool, capabilities } = req.body as {
        agent_id: string;
        window?: string;
        workstream?: string;
        current_task?: string;
        tool?: string;
        capabilities?: string[];
    };

    if (!agent_id) { res.status(400).json({ error: 'agent_id required' }); return; }

    // Extra fields carried by browser-extension agents
    const { browser_family, tab_manifest, all_tabs_count } = req.body as {
        browser_family?: string;
        tab_manifest?: Array<{ url: string; title: string; tabId: number }>;
        all_tabs_count?: number;
    };

    let agent = await getAgent(agent_id);
    if (!agent) {
        // Auto-register on first heartbeat
        agent = {
            agent_id,
            tool: (tool as any) ?? 'cle',
            capabilities: capabilities ?? [],
            session_id: uuidv4(),
            connected_at: now,
            last_seen: now,
            active_task_id: null,
            notifications: [],
        } as any;
    } else {
        agent.last_seen = now;
        if (capabilities) agent.capabilities = capabilities;
        if (tool) agent.tool = tool as any;
    }

    // agent is always defined here: either auto-created above or fetched from store
    const definedAgent = agent!;

    // Persist browser-specific fields so GET /api/agents/:id/tabs always has fresh data
    if (browser_family) (definedAgent as any).browser_family = browser_family;
    if (tab_manifest) (definedAgent as any).tab_manifest = tab_manifest;
    if (all_tabs_count !== undefined) (definedAgent as any).all_tabs_count = all_tabs_count;

    // Heartbeat-specific fields
    if (win) definedAgent.window = win;
    if (workstream) definedAgent.workstream = workstream;
    if (current_task !== undefined) definedAgent.current_task = current_task;
    definedAgent.status = 'active'; // freshly seen = active

    await saveAgent(definedAgent);

    // Broadcast live window map to all SSE dashboard clients
    const allAgents = await getAgents();
    const enriched = allAgents.map(a => ({ ...a, status: computeStatus(a.last_seen) }));
    broadcastEvent('heartbeat', {
        agent_id,
        window: win,
        workstream,
        current_task,
        last_seen: now,
        total_agents: enriched.length,
        active: enriched.filter(a => a.status === 'active').length,
        idle: enriched.filter(a => a.status === 'idle').length,
        stale: enriched.filter(a => a.status === 'stale').length,
        windows: enriched.map(a => ({
            agent_id: a.agent_id,
            window: a.window ?? '?',
            workstream: a.workstream ?? 'free',
            status: a.status,
            current_task: a.current_task ?? null,
            last_seen: a.last_seen,
        })),
    });

    res.json({ ok: true, agent_id, last_seen: now });
});


// â”€â”€ Federation REST API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import {
    registerPeer,
    removePeer,
    getAllPeers,
    getPeerHealthSummaries,
} from './federation/peer-registry.js';
import { startGossip } from './federation/gossip.js';
import { buildMeshHealthSnapshot } from './federation/mesh-health.js';

// POST /api/federation/peer â€” register a new peer IE dispatch
app.post('/api/federation/peer', (req, res) => {
    const { name, endpoint, authToken, capabilities, workstreams } = req.body as {
        name?: string;
        endpoint?: string;
        authToken?: string;
        capabilities?: string[];
        workstreams?: string[];
    };

    if (!name || !endpoint) {
        res.status(400).json({ error: '`name` and `endpoint` are required' });
        return;
    }

    const peer = registerPeer({ name, endpoint, authToken, capabilities, workstreams });
    // Broadcast updated mesh health to all SSE clients immediately
    try { broadcastEvent('mesh_health', buildMeshHealthSnapshot()); } catch { /* ok */ }
    res.json({ success: true, peer });
});

// GET /api/federation/peers â€” list all peers with health summaries
app.get('/api/federation/peers', (_req, res) => {
    const peers = getPeerHealthSummaries();
    res.json({ count: peers.length, peers });
});

// GET /api/federation/peers/full â€” full peer objects (admin use)
app.get('/api/federation/peers/full', (_req, res) => {
    const peers = getAllPeers();
    res.json({ count: peers.length, peers });
});

// GET /api/mesh-health â€” live health snapshot of all federated peers
app.get('/api/mesh-health', (_req, res) => {
    res.json(buildMeshHealthSnapshot());
});

// DELETE /api/federation/peer/:peerId â€” remove a peer
app.delete('/api/federation/peer/:peerId', (req, res) => {
    const existed = removePeer(req.params.peerId);
    if (!existed) {
        res.status(404).json({ error: `Peer ${req.params.peerId} not found` });
        return;
    }
    try { broadcastEvent('mesh_health', buildMeshHealthSnapshot()); } catch { /* ok */ }
    res.json({ success: true, removed: req.params.peerId });
});

import { dispatchEmitter } from './events.js';

app.post('/api/dream/trigger', (req, res) => {
    console.log(`[dispatch:dream] Received DREAM trigger pulse.`);
    dispatchEmitter.emitSafe('dispatch:idle', { timestamp: new Date().toISOString() });
    res.json({ success: true, message: 'Dream pulse broadcasted' });
});

// â”€â”€ Boot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function main() {
    await ensureStore();
    await migrateFromMarkdown();

    // Start federation gossip loop â€” pings peers every 30s and broadcasts mesh_health
    const gossip = startGossip({ intervalMs: 30_000, timeoutMs: 5_000 });
    // Broadcast mesh health to all SSE clients after each gossip cycle
    gossip.onCycleComplete = () => {
        try { broadcastEvent('mesh_health', buildMeshHealthSnapshot()); } catch { /* ok */ }
    };

    const httpServer = app.listen(PORT, '0.0.0.0', () => {
        console.log(`\nâ•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—`);
        console.log(`â•‘  CLE DISPATCH SERVER â€” ONLINE         â•‘`);
        console.log(`â•‘  http://127.0.0.1:${PORT}                â•‘`);
        console.log(`â•‘  MCP: GET /sse  |  REST: GET /api/status    â•‘`);
        console.log(`â•‘  Federation: POST /api/federation/peer      â•‘`);
        console.log(`â•‘  Mesh Health: GET /api/mesh-health  (SSE)   â•‘`);
        console.log(`â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n`);
    });

    const wss = new WebSocketServer({ server: httpServer, path: '/ws/bridge' });
    wss.on('connection', (ws) => {
        console.log(`[dispatch] CLE Bridge connected via WebSocket`);
        
        ws.on('message', async (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'register') {
                    console.log(`[dispatch:bridge] Registered client: ${msg.client}`);
                } else if (msg.type === 'user_command' && msg.source === 'gemini_web') {
                    console.log(`[dispatch:bridge] Received Gemini command: ${msg.command}`);
                    
                    const taskId = uuidv4();
                    const now = new Date().toISOString();
                    const task: Task = {
                        id: taskId,
                        org: 'CLE',
                        project: process.env.PROJECT ?? 'creative-liberation-engine',
                        workstream: 'general',
                        title: `Bridge Command: ${msg.command.substring(0, 50)}`,
                        description: msg.command,
                        priority: 'P1',
                        status: 'queued',
                        dependencies: [],
                        parent_task_id: null,
                        spawn_depth: 0,
                        spawned_by: 'cle-bridge',
                        assigned_to_agent: null,
                        assigned_to_capability: null,
                        claimed_by: null,
                        claimed_at: null,
                        completed_at: null,
                        handoff_note: null,
                        artifacts: [],
                        created: now,
                        created_by: 'cle-bridge',
                        updated: now,
                        source: 'gemini_web',
                        metadata: {
                            original_command: msg.command
                        },
                    };
                    await saveTask(task);
                    console.log(`[dispatch:bridge] Task ${taskId} created for bridge command.`);
                }
            } catch (err) {
                console.error('[dispatch:bridge] Error processing message:', err);
            }
        });

        ws.on('close', () => {
            console.log(`[dispatch] CLE Bridge disconnected`);
        });
    });
}

main().catch(err => { console.error('[dispatch] Fatal:', err); process.exit(1); });


