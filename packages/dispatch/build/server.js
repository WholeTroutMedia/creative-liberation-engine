// Creative Liberation Engine Dispatch Server â€” Main Entry Point
// Express HTTP + MCP over SSE transport
// Runs on NAS at 127.0.0.1:5050
// Any MCP-compatible agent connects here â€” no workspace, no config needed
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { v4 as uuidv4 } from 'uuid';
import { ensureStore, getTasks, getTask, saveTask, getAgents, getAgent, saveAgent, removeAgent, getProjects, getSecret, setSecret, listSecrets, deleteSecret } from './store.js';
import { migrateFromMarkdown } from './migrate.js';
import * as net from 'net';
const PORT = parseInt(process.env.PORT ?? '5050');
const app = express();
app.use(express.json());
// Track active SSE transports per session
const activeTransports = new Map();
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
                project: { type: 'string', description: 'Filter by project ID (e.g. brainchild-v5)' },
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
                agent_id: { type: 'string', description: 'Your agent ID (e.g. antigravity-window-a)' },
                capabilities: { type: 'array', items: { type: 'string' }, description: 'Your capabilities' },
                tool: { type: 'string', description: 'Tool name (e.g. antigravity, cursor)' },
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
                project: { type: 'string', description: 'Project ID (e.g. brainchild-v5)' },
                workstream: { type: 'string' },
                priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'], default: 'P2' },
                description: { type: 'string' },
                acceptance_criteria: { type: 'array', items: { type: 'string' } },
                assigned_to_agent: { type: 'string', description: 'Assign directly to a specific agent ID' },
                assigned_to_capability: { type: 'string', description: 'Assign to any agent with this capability' },
                parent_task_id: { type: 'string', description: 'Parent task ID for subtasks' },
                created_by: { type: 'string', description: 'Your agent_id or "user"' },
                dependencies: { type: 'array', items: { type: 'string' }, description: 'Task IDs that must complete first' },
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
        description: 'List all CLE org projects registered in the dispatch server.',
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
    // kstored Operations
    {
        name: 'get_secret',
        description: 'Securely retrieve a decrypted secret/credential from the kstored by its title.',
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
        description: 'Securely encrypt and store a new secret/credential in the kstored.',
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
        description: 'List all available secret titles stored in the kstored. Does not reveal their values.',
        inputSchema: { type: 'object', properties: {} }
    }
];
// â”€â”€ Tool Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function handleTool(name, args) {
    const now = () => new Date().toISOString();
    switch (name) {
        case 'list_tasks': {
            const status = args.status ?? 'queued';
            const all = await getTasks();
            let results = all.filter(t => t.status === status);
            if (args.project)
                results = results.filter(t => t.project === args.project);
            if (args.workstream)
                results = results.filter(t => t.workstream === args.workstream);
            if (args.priority)
                results = results.filter(t => t.priority === args.priority);
            if (args.assigned_to_agent)
                results = results.filter(t => t.assigned_to_agent === args.assigned_to_agent);
            if (args.assigned_to_capability)
                results = results.filter(t => t.assigned_to_capability === args.assigned_to_capability);
            const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
            results.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));
            return JSON.stringify({ count: results.length, tasks: results }, null, 2);
        }
        case 'claim_task': {
            const task = await getTask(args.task_id);
            if (!task)
                return JSON.stringify({ error: `Task ${args.task_id} not found` });
            if (task.status !== 'queued' && task.status !== 'handoff')
                return JSON.stringify({ error: `Task ${args.task_id} is already ${task.status} by ${task.claimed_by}` });
            task.status = 'active';
            task.claimed_by = args.agent_id;
            task.claimed_at = now();
            task.updated = now();
            await saveTask(task);
            // Register agent if not already known
            let agent = await getAgent(args.agent_id);
            if (!agent) {
                agent = {
                    agent_id: args.agent_id,
                    tool: args.tool ?? 'unknown',
                    capabilities: args.capabilities ?? [],
                    session_id: uuidv4(),
                    connected_at: now(),
                    last_seen: now(),
                    active_task_id: task.id,
                    notifications: [],
                };
            }
            else {
                agent.active_task_id = task.id;
                agent.last_seen = now();
            }
            await saveAgent(agent);
            return JSON.stringify({ success: true, task, agent_registered: true });
        }
        case 'complete_task': {
            const task = await getTask(args.task_id);
            if (!task)
                return JSON.stringify({ error: `Task ${args.task_id} not found` });
            if (task.claimed_by !== args.agent_id)
                return JSON.stringify({ error: `Task ${args.task_id} is claimed by ${task.claimed_by}, not ${args.agent_id}` });
            task.status = 'done';
            task.completed_at = now();
            task.updated = now();
            if (args.artifacts)
                task.artifacts = args.artifacts;
            if (args.note)
                task.handoff_note = args.note;
            await saveTask(task);
            // Update agent
            const agent = await getAgent(args.agent_id);
            if (agent) {
                agent.active_task_id = null;
                agent.last_seen = now();
                await saveAgent(agent);
            }
            // If this is a subtask, check if parent can now complete
            let parentStatus = null;
            if (task.parent_task_id) {
                const allTasks = await getTasks();
                const siblings = allTasks.filter(t => t.parent_task_id === task.parent_task_id && t.id !== task.id);
                if (siblings.every(t => t.status === 'done'))
                    parentStatus = 'all subtasks complete â€” parent can now be completed';
            }
            return JSON.stringify({ success: true, task, parent_note: parentStatus });
        }
        case 'force_complete': {
            const task = await getTask(args.task_id);
            if (!task)
                return JSON.stringify({ error: `Task ${args.task_id} not found` });
            if (task.status === 'done') {
                return JSON.stringify({ success: true, already_done: true, task });
            }
            task.status = 'done';
            task.completed_at = now();
            task.updated = now();
            task.handoff_note = args.note;
            task.claimed_by = task.claimed_by ?? args.agent_id;
            if (args.artifacts)
                task.artifacts = args.artifacts;
            await saveTask(task);
            // Clear agent's active task if they had it
            const fcAgent = await getAgent(args.agent_id);
            if (fcAgent && fcAgent.active_task_id === task.id) {
                fcAgent.active_task_id = null;
                fcAgent.last_seen = now();
                await saveAgent(fcAgent);
            }
            return JSON.stringify({ success: true, task });
        }
        case 'add_task': {
            const newTask = {
                id: `T${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 900) + 100)}`,
                org: 'Creative-Liberation-Engine',
                project: args.project,
                workstream: args.workstream,
                title: args.title,
                description: args.description,
                acceptance_criteria: args.acceptance_criteria,
                priority: args.priority ?? 'P2',
                status: 'queued',
                dependencies: args.dependencies ?? [],
                parent_task_id: args.parent_task_id ?? null,
                spawned_by: null,
                assigned_to_agent: args.assigned_to_agent ?? null,
                assigned_to_capability: args.assigned_to_capability ?? null,
                claimed_by: null, claimed_at: null, completed_at: null,
                handoff_note: null, artifacts: [],
                created: now(), created_by: args.created_by, updated: now(),
            };
            await saveTask(newTask);
            return JSON.stringify({ success: true, task: newTask });
        }
        case 'handoff_task': {
            const task = await getTask(args.task_id);
            if (!task)
                return JSON.stringify({ error: `Task ${args.task_id} not found` });
            task.status = 'handoff';
            task.claimed_by = null;
            task.claimed_at = null;
            task.handoff_note = args.note;
            task.updated = now();
            await saveTask(task);
            const agent = await getAgent(args.agent_id);
            if (agent) {
                agent.active_task_id = null;
                agent.last_seen = now();
                await saveAgent(agent);
            }
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
            const delegated = {
                id: `T${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 900) + 100)}`,
                org: 'Creative-Liberation-Engine',
                project: args.project,
                workstream: args.workstream,
                title: args.title,
                description: args.description,
                acceptance_criteria: undefined,
                priority: args.priority ?? 'P1',
                status: 'queued',
                dependencies: [],
                parent_task_id: args.parent_task_id ?? null,
                spawned_by: args.delegated_by,
                assigned_to_agent: args.assigned_to_agent ?? null,
                assigned_to_capability: args.assigned_to_capability ?? null,
                claimed_by: null, claimed_at: null, completed_at: null,
                handoff_note: null, artifacts: [],
                created: now(), created_by: args.delegated_by, updated: now(),
            };
            await saveTask(delegated);
            // Notify target agent if they're connected
            if (args.assigned_to_agent) {
                const target = await getAgent(args.assigned_to_agent);
                if (target) {
                    const notif = {
                        from: args.delegated_by,
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
            const target = await getAgent(args.to_agent_id);
            if (!target)
                return JSON.stringify({ error: `Agent ${args.to_agent_id} not found or not connected` });
            const notif = {
                from: args.from_agent_id,
                message: args.message,
                task_id: args.task_id,
                sent_at: now(),
                read: false,
            };
            target.notifications.push(notif);
            await saveAgent(target);
            return JSON.stringify({ success: true, notification: notif });
        }
        case 'spawn_subtask': {
            const parent = await getTask(args.parent_task_id);
            if (!parent)
                return JSON.stringify({ error: `Parent task ${args.parent_task_id} not found` });
            const sub = {
                id: `T${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 900) + 100)}`,
                org: parent.org,
                project: parent.project,
                workstream: args.workstream,
                title: args.title,
                description: args.description,
                acceptance_criteria: undefined,
                priority: args.priority ?? 'P1',
                status: 'queued',
                dependencies: [],
                parent_task_id: parent.id,
                spawned_by: args.spawned_by,
                assigned_to_agent: args.assigned_to_agent ?? null,
                assigned_to_capability: args.assigned_to_capability ?? null,
                claimed_by: null, claimed_at: null, completed_at: null,
                handoff_note: null, artifacts: [],
                created: now(), created_by: args.spawned_by, updated: now(),
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
                const value = await getSecret(args.title);
                if (value === undefined)
                    return JSON.stringify({ error: `Secret not found or decryption failed: ${args.title}` });
                return JSON.stringify({ title: args.title, value });
            }
            catch (err) {
                return JSON.stringify({ error: err.message });
            }
        }
        case 'set_secret': {
            try {
                await setSecret(args.title, args.value);
                return JSON.stringify({ success: true, title: args.title });
            }
            catch (err) {
                return JSON.stringify({ error: err.message });
            }
        }
        default:
            return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
}
// â”€â”€ MCP Server Factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createMcpServer() {
    const server = new Server({ name: 'cle-dispatch', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const result = await handleTool(req.params.name, (req.params.arguments ?? {}));
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
    const sessionId = req.query.sessionId;
    const transport = activeTransports.get(sessionId);
    if (!transport) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    await transport.handlePostMessage(req, res);
});
// REST API â€” plain HTTP for non-MCP clients
app.get('/api/status', async (_, res) => { res.json(JSON.parse(await handleTool('get_status', {}))); });
app.get('/api/tasks', async (req, res) => { res.json(JSON.parse(await handleTool('list_tasks', req.query))); });
app.get('/api/projects', async (_, res) => { res.json(JSON.parse(await handleTool('list_projects', {}))); });
// NOTE: POST /api/tasks is defined below with SSE broadcast
// REST API â€” kstored
app.get('/api/kstored', async (_, res) => { res.json(JSON.parse(await handleTool('list_secrets', {}))); });
app.post('/api/kstored', async (req, res) => { res.json(JSON.parse(await handleTool('set_secret', req.body))); });
app.delete('/api/kstored/:id', async (req, res) => {
    const success = await deleteSecret(req.params.id);
    if (!success) {
        res.status(404).json({ error: `Secret ${req.params.id} not found` });
        return;
    }
    res.json({ success: true });
});
// â”€â”€ SSE Event Stream (Real-time console) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Track all browser SSE clients
const sseClients = new Set();
// Push event to all connected SSE clients
function broadcastEvent(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        try {
            client.res.write(payload);
        }
        catch {
            sseClients.delete(client);
        }
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
        try {
            res.write(`:heartbeat\n\n`);
        }
        catch {
            clearInterval(heartbeat);
        }
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
async function broadcastingHandleTool(name, args) {
    const result = await handleTool(name, args);
    // After any mutating tool, push a fresh status snapshot to all SSE clients
    if (['claim_task', 'complete_task', 'add_task', 'handoff_task', 'delegate_task', 'spawn_subtask', 'notify_agent'].includes(name)) {
        try {
            const snap = JSON.parse(await handleTool('get_status', {}));
            broadcastEvent('status', snap);
        }
        catch { }
    }
    return result;
}
// Override MCP handler to use broadcasting version
function createBroadcastingMcpServer() {
    const server = new Server({ name: 'cle-dispatch', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const result = await broadcastingHandleTool(req.params.name, (req.params.arguments ?? {}));
        return { content: [{ type: 'text', text: result }] };
    });
    return server;
}
// Also broadcast after REST mutations
app.post('/api/tasks', async (req, res) => {
    const result = JSON.parse(await handleTool('add_task', req.body));
    res.json(result);
    // Broadcast to SSE clients
    try {
        const snap = JSON.parse(await handleTool('get_status', {}));
        broadcastEvent('status', snap);
    }
    catch { }
});
app.post('/api/tasks/claim', async (req, res) => {
    const result = JSON.parse(await handleTool('claim_task', req.body));
    if (result.error) {
        res.status(400).json(result);
        return;
    }
    res.json(result);
    // Broadcast
    try {
        const snap = JSON.parse(await handleTool('get_status', {}));
        broadcastEvent('status', snap);
    }
    catch { }
});
app.patch('/api/tasks/:id', async (req, res) => {
    const task = await getTask(req.params.id);
    if (!task) {
        res.status(404).json({ error: `Task ${req.params.id} not found` });
        return;
    }
    const now = new Date().toISOString();
    const allowed = ['status', 'priority', 'title', 'handoff_note', 'artifacts'];
    for (const key of allowed) {
        if (req.body[key] !== undefined)
            task[key] = req.body[key];
    }
    task.updated = now;
    if (req.body.status === 'done' && !task.completed_at)
        task.completed_at = now;
    await saveTask(task);
    res.json({ success: true, task });
    // Broadcast
    try {
        const snap = JSON.parse(await handleTool('get_status', {}));
        broadcastEvent('status', snap);
    }
    catch { }
});
// POST /api/tasks/:id/resolve â€” force-complete a task without requiring it to be claimed first.
// Used by Antigravity when work is done async or before a formal claim (e.g. stale queue cleanup).
// Body: { agent_id: string, note: string, artifacts?: string[] }
app.post('/api/tasks/:id/resolve', async (req, res) => {
    const { agent_id, note, artifacts } = req.body;
    if (!agent_id || !note) {
        res.status(400).json({ error: 'agent_id and note are required' });
        return;
    }
    const result = JSON.parse(await handleTool('force_complete', {
        task_id: req.params.id,
        agent_id,
        note,
        ...(artifacts ? { artifacts } : {}),
    }));
    if (result.error) {
        res.status(result.error.includes('not found') ? 404 : 400).json(result);
        return;
    }
    res.json(result);
    // Broadcast live status to SSE dashboard
    try {
        const snap = JSON.parse(await handleTool('get_status', {}));
        broadcastEvent('status', snap);
    }
    catch { }
});
// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'cle-dispatch', version: '1.0.0', sse_clients: sseClients.size }));
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
const STALE_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_MS = 30 * 1000; // 30 seconds
function computeStatus(lastSeen) {
    const age = Date.now() - new Date(lastSeen).getTime();
    if (age > STALE_MS)
        return 'stale';
    if (age > IDLE_MS)
        return 'idle';
    return 'active';
}
app.get('/api/agents', async (_, res) => {
    const agents = await getAgents();
    const enriched = agents.map(a => ({ ...a, status: computeStatus(a.last_seen) }));
    res.json({
        total: enriched.length,
        active: enriched.filter(a => a.status === 'active'),
        idle: enriched.filter(a => a.status === 'idle'),
        stale: enriched.filter(a => a.status === 'stale'),
    });
});
// GET /api/agents/:id â€” get a specific agent
app.get('/api/agents/:id', async (req, res) => {
    const agent = await getAgent(req.params.id);
    if (!agent) {
        res.status(404).json({ error: `Agent ${req.params.id} not found` });
        return;
    }
    res.json(agent);
});
// DELETE /api/agents/:id â€” disconnect/remove an agent from the registry
app.delete('/api/agents/:id', async (req, res) => {
    const agent = await getAgent(req.params.id);
    if (!agent) {
        res.status(404).json({ error: `Agent ${req.params.id} not found` });
        return;
    }
    await removeAgent(req.params.id);
    console.log(`[dispatch] Agent ${req.params.id} removed via REST`);
    res.json({ success: true, removed: req.params.id });
});
// POST /api/agents/heartbeat â€” fire-and-forget from every IDE window on every response
// Body: { agent_id, window?, workstream?, current_task?, tool?, capabilities? }
// Creates agent if not exists. Updates last_seen always. Broadcasts SSE heartbeat event.
app.post('/api/agents/heartbeat', async (req, res) => {
    const now = new Date().toISOString();
    const { agent_id, window: win, workstream, current_task, tool, capabilities } = req.body;
    if (!agent_id) {
        res.status(400).json({ error: 'agent_id required' });
        return;
    }
    let agent = await getAgent(agent_id);
    if (!agent) {
        // Auto-register on first heartbeat
        agent = {
            agent_id,
            tool: tool ?? 'antigravity',
            capabilities: capabilities ?? [],
            session_id: uuidv4(),
            connected_at: now,
            last_seen: now,
            active_task_id: null,
            notifications: [],
        };
    }
    else {
        agent.last_seen = now;
        if (capabilities)
            agent.capabilities = capabilities;
        if (tool)
            agent.tool = tool;
    }
    // Heartbeat-specific fields
    if (win)
        agent.window = win;
    if (workstream)
        agent.workstream = workstream;
    if (current_task !== undefined)
        agent.current_task = current_task;
    agent.status = 'active'; // freshly seen = active
    await saveAgent(agent);
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
// â”€â”€ Boot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function main() {
    await ensureStore();
    await migrateFromMarkdown();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\nâ•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—`);
        console.log(`â•‘  cle DISPATCH SERVER â€” ONLINE         â•‘`);
        console.log(`â•‘  http://127.0.0.1:${PORT}                â•‘`);
        console.log(`â•‘  MCP: GET /sse  |  REST: GET /api/status    â•‘`);
        console.log(`â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n`);
    });
}
main().catch(err => { console.error('[dispatch] Fatal:', err); process.exit(1); });
