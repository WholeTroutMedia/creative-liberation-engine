// Creative Liberation Engine Dispatch Server â€” SQLite Persistence Store
// WAL-mode SQLite via better-sqlite3. All ops are synchronous (no async needed for SQLite).
// Preserves the same async API surface as the old JSON store so server.ts needs zero changes.
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { encrypt, decrypt } from './crypto.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_DIR = process.env.DISPATCH_STORE_DIR
    ?? path.join(__dirname, '../../data');
const DB_PATH = path.join(STORE_DIR, 'dispatch.db');
// â”€â”€ Singleton DB connection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _db = null;
function db() {
    if (_db)
        return _db;
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL'); // concurrent reads while writing
    _db.pragma('synchronous = NORMAL'); // safe + fast
    _db.pragma('foreign_keys = ON');
    return _db;
}
// â”€â”€ Schema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SCHEMA = `
    CREATE TABLE IF NOT EXISTS tasks (
        id                    TEXT PRIMARY KEY,
        org                   TEXT NOT NULL DEFAULT 'Creative Liberation Engine Community',
        project               TEXT NOT NULL,
        workstream            TEXT NOT NULL,
        title                 TEXT NOT NULL,
        description           TEXT,
        acceptance_criteria   TEXT,   -- JSON array
        priority              TEXT NOT NULL DEFAULT 'P2',
        status                TEXT NOT NULL DEFAULT 'queued',
        dependencies          TEXT,   -- JSON array
        parent_task_id        TEXT,
        spawned_by            TEXT,
        assigned_to_agent     TEXT,
        assigned_to_capability TEXT,
        claimed_by            TEXT,
        claimed_at            TEXT,
        completed_at          TEXT,
        handoff_note          TEXT,
        artifacts             TEXT,   -- JSON array
        created               TEXT NOT NULL,
        created_by            TEXT NOT NULL,
        updated               TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agents (
        agent_id        TEXT PRIMARY KEY,
        tool            TEXT NOT NULL DEFAULT 'unknown',
        capabilities    TEXT,   -- JSON array
        session_id      TEXT,
        connected_at    TEXT,
        last_seen       TEXT,
        active_task_id  TEXT,
        notifications   TEXT,   -- JSON array
        window          TEXT,
        workstream      TEXT,
        current_task    TEXT,
        status          TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
        id              TEXT PRIMARY KEY,
        org             TEXT NOT NULL,
        name            TEXT NOT NULL,
        repo_url        TEXT,
        workstreams     TEXT,   -- JSON array
        registered_at   TEXT,
        active          INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sessions (
        session_id  TEXT PRIMARY KEY,
        data        TEXT NOT NULL   -- full SessionLog as JSON
    );

    CREATE TABLE IF NOT EXISTS vault (
        title   TEXT PRIMARY KEY,
        value   TEXT NOT NULL   -- encrypted value
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);
    CREATE INDEX IF NOT EXISTS idx_tasks_workstream ON tasks(workstream);
`;
// â”€â”€ Bootstrap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function ensureStore() {
    const fs = await import('fs/promises');
    await fs.mkdir(STORE_DIR, { recursive: true });
    db().exec(SCHEMA);
    await seedProjectsIfEmpty();
    await migrateJsonIfExists();
    console.log(`[store] SQLite ready at ${DB_PATH}`);
}
// â”€â”€ JSON â†’ SQLite one-time migration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function migrateJsonIfExists() {
    const fs = await import('fs/promises');
    const jsonFiles = {
        tasks: path.join(STORE_DIR, 'tasks.json'),
        agents: path.join(STORE_DIR, 'agents.json'),
        projects: path.join(STORE_DIR, 'projects.json'),
    };
    // Tasks
    try {
        await fs.access(jsonFiles.tasks);
        const raw = JSON.parse(await fs.readFile(jsonFiles.tasks, 'utf-8'));
        const count = db().prepare('SELECT COUNT(*) as n FROM tasks').get();
        if (count.n === 0 && raw.length > 0) {
            const insert = db().prepare(`
                INSERT OR IGNORE INTO tasks VALUES (
                    @id,@org,@project,@workstream,@title,@description,
                    @acceptance_criteria,@priority,@status,@dependencies,
                    @parent_task_id,@spawned_by,@assigned_to_agent,@assigned_to_capability,
                    @claimed_by,@claimed_at,@completed_at,@handoff_note,@artifacts,
                    @created,@created_by,@updated
                )
            `);
            const insertMany = db().transaction((tasks) => {
                for (const t of tasks)
                    insert.run(taskToRow(t));
            });
            insertMany(raw);
            console.log(`[store:migrate] Imported ${raw.length} tasks from JSON`);
            await fs.rename(jsonFiles.tasks, jsonFiles.tasks + '.migrated');
        }
    }
    catch { /* no json file â€” fresh install */ }
    // Agents
    try {
        await fs.access(jsonFiles.agents);
        const raw = JSON.parse(await fs.readFile(jsonFiles.agents, 'utf-8'));
        const count = db().prepare('SELECT COUNT(*) as n FROM agents').get();
        if (count.n === 0 && raw.length > 0) {
            const insert = db().prepare(`
                INSERT OR IGNORE INTO agents VALUES (
                    @agent_id,@tool,@capabilities,@session_id,@connected_at,
                    @last_seen,@active_task_id,@notifications,@window,@workstream,
                    @current_task,@status
                )
            `);
            const insertMany = db().transaction((agents) => {
                for (const a of agents)
                    insert.run(agentToRow(a));
            });
            insertMany(raw);
            console.log(`[store:migrate] Imported ${raw.length} agents from JSON`);
            await fs.rename(jsonFiles.agents, jsonFiles.agents + '.migrated');
        }
    }
    catch { /* ok */ }
}
// â”€â”€ Row serializers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function taskToRow(t) {
    return {
        id: t.id, org: t.org ?? 'Creative Liberation Engine Community',
        project: t.project, workstream: t.workstream,
        title: t.title, description: t.description ?? null,
        acceptance_criteria: t.acceptance_criteria ? JSON.stringify(t.acceptance_criteria) : null,
        priority: t.priority, status: t.status,
        dependencies: JSON.stringify(t.dependencies ?? []),
        parent_task_id: t.parent_task_id ?? null,
        spawned_by: t.spawned_by ?? null,
        assigned_to_agent: t.assigned_to_agent ?? null,
        assigned_to_capability: t.assigned_to_capability ?? null,
        claimed_by: t.claimed_by ?? null,
        claimed_at: t.claimed_at ?? null,
        completed_at: t.completed_at ?? null,
        handoff_note: t.handoff_note ?? null,
        artifacts: JSON.stringify(t.artifacts ?? []),
        created: t.created, created_by: t.created_by, updated: t.updated,
    };
}
function rowToTask(row) {
    return {
        id: row.id,
        org: row.org,
        project: row.project,
        workstream: row.workstream,
        title: row.title,
        description: row.description,
        acceptance_criteria: row.acceptance_criteria ? JSON.parse(row.acceptance_criteria) : undefined,
        priority: row.priority,
        status: row.status,
        dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
        parent_task_id: row.parent_task_id,
        spawned_by: row.spawned_by,
        assigned_to_agent: row.assigned_to_agent,
        assigned_to_capability: row.assigned_to_capability,
        claimed_by: row.claimed_by,
        claimed_at: row.claimed_at,
        completed_at: row.completed_at,
        handoff_note: row.handoff_note,
        artifacts: row.artifacts ? JSON.parse(row.artifacts) : [],
        created: row.created,
        created_by: row.created_by,
        updated: row.updated,
    };
}
function agentToRow(a) {
    return {
        agent_id: a.agent_id, tool: a.tool,
        capabilities: JSON.stringify(a.capabilities ?? []),
        session_id: a.session_id ?? null,
        connected_at: a.connected_at ?? null,
        last_seen: a.last_seen ?? null,
        active_task_id: a.active_task_id ?? null,
        notifications: JSON.stringify(a.notifications ?? []),
        window: a.window ?? null,
        workstream: a.workstream ?? null,
        current_task: a.current_task ?? null,
        status: a.status ?? null,
    };
}
function rowToAgent(row) {
    return {
        agent_id: row.agent_id,
        tool: row.tool,
        capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
        session_id: row.session_id,
        connected_at: row.connected_at,
        last_seen: row.last_seen,
        active_task_id: row.active_task_id,
        notifications: row.notifications ? JSON.parse(row.notifications) : [],
        window: row.window,
        workstream: row.workstream,
        current_task: row.current_task,
        status: row.status,
    };
}
// â”€â”€ Task Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getTasks() {
    const rows = db().prepare('SELECT * FROM tasks ORDER BY created ASC').all();
    return rows.map(rowToTask);
}
export async function getTask(id) {
    const row = db().prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    return row ? rowToTask(row) : undefined;
}
export async function saveTask(task) {
    db().prepare(`
        INSERT INTO tasks VALUES (
            @id,@org,@project,@workstream,@title,@description,
            @acceptance_criteria,@priority,@status,@dependencies,
            @parent_task_id,@spawned_by,@assigned_to_agent,@assigned_to_capability,
            @claimed_by,@claimed_at,@completed_at,@handoff_note,@artifacts,
            @created,@created_by,@updated
        )
        ON CONFLICT(id) DO UPDATE SET
            status=excluded.status, priority=excluded.priority,
            title=excluded.title, description=excluded.description,
            claimed_by=excluded.claimed_by, claimed_at=excluded.claimed_at,
            completed_at=excluded.completed_at, handoff_note=excluded.handoff_note,
            artifacts=excluded.artifacts, updated=excluded.updated,
            assigned_to_agent=excluded.assigned_to_agent,
            assigned_to_capability=excluded.assigned_to_capability
    `).run(taskToRow(task));
}
export async function getQueuedTasks(filters) {
    let sql = `SELECT * FROM tasks WHERE status = 'queued'`;
    const params = [];
    if (filters?.project) {
        sql += ` AND project = ?`;
        params.push(filters.project);
    }
    if (filters?.workstream) {
        sql += ` AND workstream = ?`;
        params.push(filters.workstream);
    }
    if (filters?.priority) {
        sql += ` AND priority = ?`;
        params.push(filters.priority);
    }
    if (filters?.assigned_to_agent) {
        sql += ` AND assigned_to_agent = ?`;
        params.push(filters.assigned_to_agent);
    }
    if (filters?.assigned_to_capability) {
        sql += ` AND assigned_to_capability = ?`;
        params.push(filters.assigned_to_capability);
    }
    sql += ` ORDER BY CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, created ASC`;
    return db().prepare(sql).all(...params).map(rowToTask);
}
// â”€â”€ Agent Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getAgents() {
    return db().prepare('SELECT * FROM agents').all().map(rowToAgent);
}
export async function getAgent(agent_id) {
    const row = db().prepare('SELECT * FROM agents WHERE agent_id = ?').get(agent_id);
    return row ? rowToAgent(row) : undefined;
}
export async function saveAgent(agent) {
    db().prepare(`
        INSERT INTO agents VALUES (
            @agent_id,@tool,@capabilities,@session_id,@connected_at,
            @last_seen,@active_task_id,@notifications,@window,@workstream,
            @current_task,@status
        )
        ON CONFLICT(agent_id) DO UPDATE SET
            tool=excluded.tool, capabilities=excluded.capabilities,
            last_seen=excluded.last_seen, active_task_id=excluded.active_task_id,
            notifications=excluded.notifications, window=excluded.window,
            workstream=excluded.workstream, current_task=excluded.current_task,
            status=excluded.status
    `).run(agentToRow(agent));
}
export async function removeAgent(agent_id) {
    db().prepare('DELETE FROM agents WHERE agent_id = ?').run(agent_id);
}
// â”€â”€ Project Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getProjects() {
    const rows = db().prepare('SELECT * FROM projects').all();
    return rows.map(r => ({
        id: r.id,
        org: r.org,
        name: r.name,
        repo_url: r.repo_url ?? '',
        workstreams: r.workstreams ? JSON.parse(r.workstreams) : [],
        registered_at: r.registered_at,
        active: Boolean(r.active),
    }));
}
async function seedProjectsIfEmpty() {
    const count = db().prepare('SELECT COUNT(*) as n FROM projects').get();
    if (count.n > 0)
        return;
    const now = new Date().toISOString();
    const DEFAULT_PROJECTS = [
        {
            id: 'brainchild-v5', org: 'Creative Liberation Engine Community', name: 'Creative Liberation Engine v5 (GENESIS)',
            repo_url: 'http://127.0.0.1:3000/Creative Liberation Engine Community/brainchild-v5',
            workstreams: ['genkit-flows', 'console-ui', 'inception-core', 'synology-mcp',
                'zero-day', 'infra-docker', 'comet-browser', 'spatial-visionos',
                'genkit-server', 'dispatch'],
            registered_at: now, active: true,
        },
        {
            id: 'brainchild-v4', org: 'Creative Liberation Engine Community', name: 'Creative Liberation Engine v4',
            repo_url: 'http://127.0.0.1:3000/Creative Liberation Engine Community/brainchild-v4',
            workstreams: ['python-engine', 'legacy-memory', 'agent-catalog'],
            registered_at: now, active: true,
        },
        {
            id: 'andgather', org: 'Creative Liberation Engine Community', name: '&Gather Social Intelligence',
            repo_url: 'http://127.0.0.1:3000/Creative Liberation Engine Community/andgather',
            workstreams: ['social-graph', 'event-engine', 'mobile-app'],
            registered_at: now, active: true,
        },
        {
            id: 'nbc-nexus', org: 'Creative Liberation Engine Community', name: 'NBC Nexus Broadcast Platform',
            repo_url: 'http://127.0.0.1:3000/Creative Liberation Engine Community/nbc-nexus',
            workstreams: ['broadcast-ui', 'content-pipeline', 'atlas-agent'],
            registered_at: now, active: true,
        },
    ];
    const insert = db().prepare(`
        INSERT OR IGNORE INTO projects (id,org,name,repo_url,workstreams,registered_at,active)
        VALUES (@id,@org,@name,@repo_url,@workstreams,@registered_at,@active)
    `);
    const insertMany = db().transaction((projects) => {
        for (const p of projects)
            insert.run({
                ...p, workstreams: JSON.stringify(p.workstreams),
                active: p.active ? 1 : 0,
            });
    });
    insertMany(DEFAULT_PROJECTS);
}
// â”€â”€ Session Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function saveSession(session) {
    db().prepare(`
        INSERT INTO sessions (session_id, data) VALUES (?, ?)
        ON CONFLICT(session_id) DO UPDATE SET data=excluded.data
    `).run(session.session_id, JSON.stringify(session));
}
// â”€â”€ Vault Operations (Encrypted) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getSecret(title) {
    const row = db().prepare('SELECT value FROM vault WHERE title = ?').get(title);
    if (!row)
        return undefined;
    try {
        return decrypt(row.value);
    }
    catch {
        return undefined;
    }
}
export async function setSecret(title, plainText) {
    db().prepare(`
        INSERT INTO vault (title, value) VALUES (?, ?)
        ON CONFLICT(title) DO UPDATE SET value=excluded.value
    `).run(title, encrypt(plainText));
}
export async function listSecrets() {
    return db().prepare('SELECT title FROM vault').all().map(r => r.title);
}
export async function deleteSecret(title) {
    const result = db().prepare('DELETE FROM vault WHERE title = ?').run(title);
    return result.changes > 0;
}
