import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import type { DispatchStore, Task, Agent, Project, SessionLog, TaskPrediction } from './types.js';
import { encrypt, decrypt } from './crypto.js';
import type { Blocker, BlockerSeverity, BlockerStatus, BlockerType } from './server.js';

const { Pool } = pg;

// ─── Singleton DB connection ──────────────────────────────────────────────────

let _pool: pg.Pool | null = null;

export function db(): pg.Pool {
    if (_pool) return _pool;
    _pool = new Pool({
        // Uses POSTGRES_URL environment variable by default if connectionString is not passed.
        connectionString: process.env.POSTGRES_URL || 'postgresql://cle:cle_secure_pass@127.0.0.1:5432/cle_genesis',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });
    return _pool;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const SCHEMA = `
    CREATE TABLE IF NOT EXISTS tasks (
        id                    TEXT PRIMARY KEY,
        org                   TEXT NOT NULL DEFAULT 'WholeTroutMedia',
        project               TEXT NOT NULL,
        workstream            TEXT NOT NULL,
        title                 TEXT NOT NULL,
        description           TEXT,
        acceptance_criteria   TEXT,   -- JSON array
        priority              TEXT NOT NULL DEFAULT 'P2',
        status                TEXT NOT NULL DEFAULT 'queued',
        dependencies          TEXT,   -- JSON array
        parent_task_id        TEXT,
        spawn_depth           INTEGER NOT NULL DEFAULT 0,
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
        updated               TEXT NOT NULL,
        prediction            TEXT,   -- JSON: TaskPrediction | null
        spec_payload          TEXT,
        artifact_payload      TEXT,
        source                TEXT,
        metadata              JSONB,
        human_state           JSONB
    );

    CREATE TABLE IF NOT EXISTS tasks_archive (
        id                    TEXT PRIMARY KEY,
        org                   TEXT,
        project               TEXT,
        workstream            TEXT,
        title                 TEXT,
        description           TEXT,
        acceptance_criteria   TEXT,
        priority              TEXT,
        status                TEXT,
        dependencies          TEXT,
        parent_task_id        TEXT,
        spawn_depth           INTEGER NOT NULL DEFAULT 0,
        spawned_by            TEXT,
        assigned_to_agent     TEXT,
        assigned_to_capability TEXT,
        claimed_by            TEXT,
        claimed_at            TEXT,
        completed_at          TEXT,
        handoff_note          TEXT,
        artifacts             TEXT,
        created               TEXT,
        created_by            TEXT,
        updated               TEXT,
        prediction            TEXT,
        spec_payload          TEXT,
        artifact_payload      TEXT,
        source                TEXT,
        metadata              JSONB,
        archived_at           TEXT NOT NULL,
        human_state           JSONB
    );

    CREATE TABLE IF NOT EXISTS blockers (
        id               TEXT PRIMARY KEY,
        severity         TEXT NOT NULL,
        type             TEXT NOT NULL,
        filed_by         TEXT NOT NULL,
        task_id          TEXT,
        description      TEXT NOT NULL,
        claimed_by       TEXT,
        resolved_by      TEXT,
        resolution_note  TEXT,
        status           TEXT NOT NULL DEFAULT 'OPEN',
        filed_at         TEXT NOT NULL,
        updated_at       TEXT NOT NULL
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
        "window"        TEXT,
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

// ─── User Directory Tree Migration ───────────────────────────────────────────

async function migrateUserDirectoryTree(): Promise<void> {
    const USER_SCHEMA = `
        CREATE TABLE IF NOT EXISTS cle_users (
            uid             TEXT PRIMARY KEY,
            display_name    TEXT NOT NULL,
            email           TEXT,
            avatar_url      TEXT,
            bio             TEXT,
            timezone        TEXT DEFAULT 'America/New_York',
            language        TEXT DEFAULT 'en',
            preferences     JSONB DEFAULT '{}'::jsonb,
            roles           TEXT[] DEFAULT ARRAY['user'],
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            last_active_at  TIMESTAMPTZ DEFAULT NOW(),
            is_active       BOOLEAN DEFAULT TRUE
        );

        CREATE TABLE IF NOT EXISTS cle_user_memory (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            uid             TEXT NOT NULL REFERENCES cle_users(uid) ON DELETE CASCADE,
            memory_type     TEXT NOT NULL CHECK (memory_type IN ('episodic', 'semantic', 'procedural')),
            key             TEXT,
            content         TEXT NOT NULL,
            meta            JSONB DEFAULT '{}'::jsonb,
            embedding_ref   TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW(),
            expires_at      TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS idx_user_memory_uid  ON cle_user_memory(uid);
        CREATE INDEX IF NOT EXISTS idx_user_memory_type ON cle_user_memory(uid, memory_type);

        CREATE TABLE IF NOT EXISTS cle_user_agents (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            uid             TEXT NOT NULL REFERENCES cle_users(uid) ON DELETE CASCADE,
            agent_id        TEXT NOT NULL,
            display_name    TEXT,
            acl             JSONB DEFAULT '{}'::jsonb,
            is_active       BOOLEAN DEFAULT TRUE,
            granted_at      TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_agents_uid_agent ON cle_user_agents(uid, agent_id);

        CREATE TABLE IF NOT EXISTS cle_user_contacts (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            uid             TEXT NOT NULL REFERENCES cle_users(uid) ON DELETE CASCADE,
            name            TEXT NOT NULL,
            email           TEXT,
            phone           TEXT,
            relationship    TEXT,
            meta            JSONB DEFAULT '{}'::jsonb,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cle_user_audit (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            uid             TEXT NOT NULL REFERENCES cle_users(uid) ON DELETE CASCADE,
            actor           TEXT NOT NULL,
            actor_type      TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
            action          TEXT NOT NULL,
            path            TEXT NOT NULL,
            detail          JSONB DEFAULT '{}'::jsonb,
            occurred_at     TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_user_audit_uid      ON cle_user_audit(uid);
        CREATE INDEX IF NOT EXISTS idx_user_audit_occurred ON cle_user_audit(occurred_at DESC);
    `;

    await db().query(USER_SCHEMA);

    // Seed jaharoni — operator / root user
    await db().query(`
        INSERT INTO cle_users (uid, display_name, email, timezone, roles, preferences)
        VALUES (
            'jaharoni', 'Sovereign Artist', 'justin@incompass.inc',
            'America/New_York', ARRAY['user','admin','operator'],
            '{"agent_verbosity":"compact","theme":"dark","hud_panels":["dispatch","agents","memory","inbox"]}'::jsonb
        )
        ON CONFLICT (uid) DO UPDATE SET last_active_at = NOW()
    `);

    // Seed AVERI agents
    const averiAgents = [
        { id: 'athena', name: 'ATHENA', acl: { read: ['*'], write: ['projects','inbox','memory'] } },
        { id: 'vera',   name: 'VERA',   acl: { read: ['*'], write: ['projects','inbox','comms'] } },
        { id: 'iris',   name: 'IRIS',   acl: { read: ['*'], write: ['media','comms','memory'] } },
    ];
    for (const a of averiAgents) {
        await db().query(
            `INSERT INTO cle_user_agents (uid, agent_id, display_name, acl)
             VALUES ('jaharoni', $1, $2, $3::jsonb)
             ON CONFLICT (uid, agent_id) DO NOTHING`,
            [a.id, a.name, JSON.stringify(a.acl)]
        );
    }

    console.log('[store] User directory tree schema applied — jaharoni provisioned.');
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────


export async function ensureStore(): Promise<void> {
    try {
        await db().query(SCHEMA);
        
        // Additive migration: add columns safely. PostgreSQL throws on duplicate column if using ALTER,
        // so we trap the specific duplicate column error.
        const cols = [
            'ALTER TABLE tasks ADD COLUMN prediction TEXT',
            'ALTER TABLE tasks ADD COLUMN spec_payload TEXT',
            'ALTER TABLE tasks ADD COLUMN artifact_payload TEXT',
            'ALTER TABLE tasks ADD COLUMN source TEXT',
            'ALTER TABLE tasks ADD COLUMN metadata JSONB',
            'ALTER TABLE tasks ADD COLUMN human_state JSONB',
            'ALTER TABLE tasks_archive ADD COLUMN spec_payload TEXT',
            'ALTER TABLE tasks_archive ADD COLUMN artifact_payload TEXT',
            'ALTER TABLE tasks_archive ADD COLUMN source TEXT',
            'ALTER TABLE tasks_archive ADD COLUMN metadata JSONB',
            'ALTER TABLE tasks_archive ADD COLUMN human_state JSONB',
            'ALTER TABLE tasks ADD COLUMN spawn_depth INTEGER NOT NULL DEFAULT 0',
            'ALTER TABLE tasks_archive ADD COLUMN spawn_depth INTEGER NOT NULL DEFAULT 0',
        ];
        
        for (const sql of cols) {
            try {
                await db().query(sql);
            } catch (err: any) {
                // column already exists is OK. error code 42701 is duplicate_column
                if (err.code !== '42701') {
                    console.error('[store:pg] schema alter error:', err);
                }
            }
        }
        
        // ── User Directory Tree Migration (idempotent) ─────────────────────────
        await migrateUserDirectoryTree();

        await seedProjectsIfEmpty();
        console.log(`[store] PostgreSQL ready at host ${process.env.POSTGRES_URL ? 'specfied in ENV' : 'default NAS IP'}`);
        scheduleWeeklyArchiveSweep();
    } catch (e) {
        console.error('[store] Bootstrap failed', e);
        throw e;
    }
}

// ─── JSON serializers ────────────────────────────────────────────────────────

function taskToRow(t: Task): any[] {
    return [
        t.id, t.org ?? 'WholeTroutMedia',
        t.project, t.workstream,
        t.title, t.description ?? null,
        t.acceptance_criteria ? JSON.stringify(t.acceptance_criteria) : null,
        t.priority, t.status,
        JSON.stringify(t.dependencies ?? []),
        t.parent_task_id ?? null,
        t.spawn_depth ?? 0,
        t.spawned_by ?? null,
        t.assigned_to_agent ?? null,
        t.assigned_to_capability ?? null,
        t.claimed_by ?? null,
        t.claimed_at ?? null,
        t.completed_at ?? null,
        t.handoff_note ?? null,
        JSON.stringify(t.artifacts ?? []),
        t.created, t.created_by, t.updated,
        t.prediction ? JSON.stringify(t.prediction) : null,
        t.spec_payload ?? null,
        t.artifact_payload ?? null,
        t.source ?? null,
        t.metadata ? JSON.stringify(t.metadata) : null,
        t.humanState ? JSON.stringify(t.humanState) : null,
    ];
}

function rowToTask(row: Record<string, unknown>): Task {
    return {
        id: row.id as string,
        org: row.org as string,
        project: row.project as string,
        workstream: row.workstream as string,
        title: row.title as string,
        description: row.description as string | undefined,
        acceptance_criteria: row.acceptance_criteria ? JSON.parse(row.acceptance_criteria as string) : undefined,
        priority: row.priority as 'P0' | 'P1' | 'P2' | 'P3',
        status: row.status as Task['status'],
        dependencies: row.dependencies ? JSON.parse(row.dependencies as string) : [],
        parent_task_id: row.parent_task_id as string | null,
        spawn_depth: (row.spawn_depth as number) ?? 0,
        spawned_by: row.spawned_by as string | null,
        assigned_to_agent: row.assigned_to_agent as string | null,
        assigned_to_capability: row.assigned_to_capability as string | null,
        claimed_by: row.claimed_by as string | null,
        claimed_at: row.claimed_at as string | null,
        completed_at: row.completed_at as string | null,
        handoff_note: row.handoff_note as string | null,
        artifacts: row.artifacts ? JSON.parse(row.artifacts as string) : [],
        created: row.created as string,
        created_by: row.created_by as string,
        updated: row.updated as string,
        prediction: row.prediction ? JSON.parse(row.prediction as string) : undefined,
        spec_payload: row.spec_payload as string | undefined,
        artifact_payload: row.artifact_payload as string | undefined,
        source: row.source as string | undefined,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata as any,
        humanState: typeof row.human_state === 'string' ? JSON.parse(row.human_state) : row.human_state as any,
    };
}

function agentToRow(a: Agent): any[] {
    return [
        a.agent_id, a.tool,
        JSON.stringify(a.capabilities ?? []),
        a.session_id ?? null,
        a.connected_at ?? null,
        a.last_seen ?? null,
        a.active_task_id ?? null,
        JSON.stringify(a.notifications ?? []),
        (a as any).window ?? null,
        (a as any).workstream ?? null,
        (a as any).current_task ?? null,
        (a as any).status ?? null,
    ];
}

function rowToAgent(row: Record<string, unknown>): Agent {
    return {
        agent_id: row.agent_id as string,
        tool: row.tool as any,
        capabilities: row.capabilities ? JSON.parse(row.capabilities as string) : [],
        session_id: row.session_id as string,
        connected_at: row.connected_at as string,
        last_seen: row.last_seen as string,
        active_task_id: row.active_task_id as string | null,
        notifications: row.notifications ? JSON.parse(row.notifications as string) : [],
        window: row.window as string | undefined,
        workstream: row.workstream as string | undefined,
        current_task: row.current_task as string | undefined,
        status: row.status as string | undefined,
    } as Agent & { window?: string; workstream?: string; current_task?: string; status?: string };
}

// ─── Task Operations ────────────────────────────────────────────────────────

export async function getTasks(): Promise<Task[]> {
    const { rows } = await db().query(`
        SELECT 
            id, org, project, workstream, title, description,
            acceptance_criteria, priority, status, dependencies,
            parent_task_id, spawn_depth, spawned_by, assigned_to_agent, assigned_to_capability,
            claimed_by, claimed_at, completed_at, handoff_note, artifacts,
            created, created_by, updated, prediction, spec_payload, artifact_payload, source, metadata, human_state
        FROM tasks
        ORDER BY priority ASC, created DESC
    `);
    return rows.map(rowToTask);
}

export async function getTask(id: string): Promise<Task | undefined> {
    const { rows } = await db().query('SELECT * FROM tasks WHERE id = $1', [id]);
    return rows.length > 0 ? rowToTask(rows[0]) : undefined;
}

/**
 * Atomically transition queued → active. Only one concurrent worker wins per task.
 * Fixes multi-slot races where two loops read the same snapshot and both call saveTask.
 */
export async function tryClaimTaskAtomic(
    taskId: string,
    claimedBy: string,
    updatedIso: string,
): Promise<Task | undefined> {
    const { rows } = await db().query(
        `UPDATE tasks
         SET status = 'active',
             claimed_by = $1,
             claimed_at = $2,
             updated = $2
         WHERE id = $3 AND status = 'queued'
         RETURNING *`,
        [claimedBy, updatedIso, taskId],
    );
    if (rows.length === 0) return undefined;
    return rowToTask(rows[0] as Record<string, unknown>);
}

/** Re-queue tasks stuck in `active` (worker crash, hung Genkit, partial failure). */
export async function reclaimStaleActiveTasks(maxAgeMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    const now = new Date().toISOString();
    const { rowCount } = await db().query(
        `UPDATE tasks
         SET status = 'queued',
             claimed_by = NULL,
             claimed_at = NULL,
             updated = $1
         WHERE status = 'active'
           AND claimed_at IS NOT NULL
           AND claimed_at < $2`,
        [now, cutoff],
    );
    const n = rowCount ?? 0;
    if (n > 0) {
        console.warn(`[store] Reclaimed ${n} stale active task(s) (claimed before ${cutoff})`);
    }
    return n;
}

export async function saveTask(task: Task): Promise<void> {
    await db().query(`
        INSERT INTO tasks (
            id, org, project, workstream, title, description,
            acceptance_criteria, priority, status, dependencies,
            parent_task_id, spawn_depth, spawned_by, assigned_to_agent, assigned_to_capability,
            claimed_by, claimed_at, completed_at, handoff_note, artifacts,
            created, created_by, updated, prediction, spec_payload, artifact_payload, source, metadata, human_state
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29
        )
        ON CONFLICT(id) DO UPDATE SET
            status=EXCLUDED.status, priority=EXCLUDED.priority,
            title=EXCLUDED.title, description=EXCLUDED.description,
            claimed_by=EXCLUDED.claimed_by, claimed_at=EXCLUDED.claimed_at,
            completed_at=EXCLUDED.completed_at, handoff_note=EXCLUDED.handoff_note,
            artifacts=EXCLUDED.artifacts, updated=EXCLUDED.updated,
            assigned_to_agent=EXCLUDED.assigned_to_agent,
            assigned_to_capability=EXCLUDED.assigned_to_capability,
            prediction=EXCLUDED.prediction,
            spec_payload=EXCLUDED.spec_payload,
            artifact_payload=EXCLUDED.artifact_payload,
            source=EXCLUDED.source,
            metadata=EXCLUDED.metadata,
            human_state=EXCLUDED.human_state
    `, taskToRow(task));
}

export async function getQueuedTasks(filters?: {
    project?: string;
    workstream?: string;
    priority?: string;
    assigned_to_agent?: string;
    assigned_to_capability?: string;
}): Promise<Task[]> {
    let sql = `
        SELECT 
            id, org, project, workstream, title, description,
            acceptance_criteria, priority, status, dependencies,
            parent_task_id, spawn_depth, spawned_by, assigned_to_agent, assigned_to_capability,
            claimed_by, claimed_at, completed_at, handoff_note, artifacts,
            created, created_by, updated, prediction, spec_payload, artifact_payload, source, metadata, human_state
        FROM tasks 
        WHERE status = 'queued'
    `;
    const params: string[] = [];
    let idx = 1;

    if (filters?.project) { sql += ` AND project = $${idx++}`; params.push(filters.project); }
    if (filters?.workstream) { sql += ` AND workstream = $${idx++}`; params.push(filters.workstream); }
    if (filters?.priority) { sql += ` AND priority = $${idx++}`; params.push(filters.priority); }
    if (filters?.assigned_to_agent) { sql += ` AND assigned_to_agent = $${idx++}`; params.push(filters.assigned_to_agent); }
    if (filters?.assigned_to_capability) { sql += ` AND assigned_to_capability = $${idx++}`; params.push(filters.assigned_to_capability); }
    
    sql += ` ORDER BY CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, created ASC`;
    const { rows } = await db().query(sql, params);
    return rows.map(rowToTask);
}

export async function setPrediction(
    taskId: string,
    expectedOutcome: string,
): Promise<boolean> {
    const prediction: TaskPrediction = {
        expectedOutcome,
        predictedAt: new Date().toISOString(),
    };
    const { rowCount } = await db().query(
        `UPDATE tasks SET prediction = $1, updated = $2 WHERE id = $3`,
        [JSON.stringify(prediction), new Date().toISOString(), taskId]
    );
    if ((rowCount || 0) > 0) {
        console.log(`[store] Prediction recorded for task ${taskId}`);
    }
    return (rowCount || 0) > 0;
}

export async function resolvePrediction(
    taskId: string,
    actualOutcome: string,
): Promise<boolean> {
    const { rows } = await db().query('SELECT prediction FROM tasks WHERE id = $1', [taskId]);
    if (!rows.length || !rows[0].prediction) return false;

    const existing = JSON.parse(rows[0].prediction) as TaskPrediction;
    const predictionError = await computeSemanticError(existing.expectedOutcome, actualOutcome);

    const resolved: TaskPrediction = {
        ...existing,
        actualOutcome,
        predictionError,
        resolvedAt: new Date().toISOString(),
    };

    const { rowCount } = await db().query(
        `UPDATE tasks SET prediction = $1, updated = $2 WHERE id = $3`,
        [JSON.stringify(resolved), new Date().toISOString(), taskId]
    );

    if ((rowCount || 0) > 0) {
        console.log(`[store] Prediction resolved for ${taskId} | error=${predictionError.toFixed(2)}`);
    }
    return (rowCount || 0) > 0;
}

async function computeSemanticError(expected: string, actual: string): Promise<number> {
    try {
        const url = process.env.OLLAMA_URL ?? 'http://localhost:11434';
        
        const fetchEmbed = async (text: string) => {
            const res = await fetch(`${url}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
            });
            if (!res.ok) throw new Error(`Ollama embed failed: ${res.statusText}`);
            const data = await res.json() as { embedding: number[] };
            return data.embedding;
        };

        const [vecA, vecB] = await Promise.all([fetchEmbed(expected), fetchEmbed(actual)]);
        
        // Cosine similarity
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        
        if (normA === 0 || normB === 0) return 1.0;
        const cosineSimilarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
        
        const error = Math.max(0, Math.min(1, 1 - cosineSimilarity));
        return parseFloat(error.toFixed(4));
        
    } catch (err) {
        console.warn(`[store] Failed to compute semantic error, falling back to 1.0: ${err}`);
        return 1.0;
    }
}

// ─── Agent Operations ───────────────────────────────────────────────────────

export async function getAgents(): Promise<Agent[]> {
    const { rows } = await db().query('SELECT * FROM agents');
    return rows.map(rowToAgent);
}

export async function getAgent(agent_id: string): Promise<Agent | undefined> {
    const { rows } = await db().query('SELECT * FROM agents WHERE agent_id = $1', [agent_id]);
    return rows.length > 0 ? rowToAgent(rows[0]) : undefined;
}

export async function saveAgent(agent: Agent): Promise<void> {
    await db().query(`
        INSERT INTO agents (
            agent_id, tool, capabilities, session_id, connected_at,
            last_seen, active_task_id, notifications, "window", workstream,
            current_task, status
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        )
        ON CONFLICT(agent_id) DO UPDATE SET
            tool=EXCLUDED.tool, capabilities=EXCLUDED.capabilities,
            last_seen=EXCLUDED.last_seen, active_task_id=EXCLUDED.active_task_id,
            notifications=EXCLUDED.notifications, "window"=EXCLUDED."window",
            workstream=EXCLUDED.workstream, current_task=EXCLUDED.current_task,
            status=EXCLUDED.status
    `, agentToRow(agent));
}

export async function removeAgent(agent_id: string): Promise<void> {
    await db().query('DELETE FROM agents WHERE agent_id = $1', [agent_id]);
}

// ─── Project Operations ─────────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
    const { rows } = await db().query('SELECT * FROM projects');
    return rows.map(r => ({
        id: r.id as string,
        org: r.org as string,
        name: r.name as string,
        repo_url: (r.repo_url as string) ?? '',
        workstreams: r.workstreams ? JSON.parse(r.workstreams as string) : [],
        registered_at: r.registered_at as string,
        active: Boolean(r.active),
    }));
}

async function seedProjectsIfEmpty(): Promise<void> {
    const { rows } = await db().query('SELECT COUNT(*) as n FROM projects');
    if (parseInt(rows[0].n, 10) > 0) return;
    const now = new Date().toISOString();
    const DEFAULT_PROJECTS: Project[] = [
        {
            id: 'creative-liberation-engine-v5', org: 'WholeTroutMedia', name: 'Creative Liberation Engine v5 (GENESIS)',
            repo_url: 'http://127.0.0.1:3000/WholeTroutMedia/creative-liberation-engine-v5',
            workstreams: ['genkit-flows', 'console-ui', 'cle-core', 'synology-mcp',
                'zero-day', 'infra-docker', 'comet-browser', 'spatial-visionos',
                'genkit-server', 'dispatch'],
            registered_at: now, active: true,
        },
        {
            id: 'andgather', org: 'WholeTroutMedia', name: '&Gather Social Intelligence',
            repo_url: 'http://127.0.0.1:3000/WholeTroutMedia/andgather',
            workstreams: ['social-graph', 'event-engine', 'mobile-app'],
            registered_at: now, active: true,
        },
        {
            id: 'nbc-nexus', org: 'WholeTroutMedia', name: 'NBC Nexus Broadcast Platform',
            repo_url: 'http://127.0.0.1:3000/WholeTroutMedia/nbc-nexus',
            workstreams: ['broadcast-ui', 'content-pipeline', 'atlas-agent'],
            registered_at: now, active: true,
        },
    ];
    
    for (const p of DEFAULT_PROJECTS) {
        await db().query(`
            INSERT INTO projects (id,org,name,repo_url,workstreams,registered_at,active)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT(id) DO NOTHING
        `, [
            p.id, p.org, p.name, p.repo_url, JSON.stringify(p.workstreams),
            p.registered_at, p.active ? 1 : 0
        ]);
    }
}

// ─── Session Operations ─────────────────────────────────────────────────────

export async function saveSession(session: SessionLog): Promise<void> {
    await db().query(`
        INSERT INTO sessions (session_id, data) VALUES ($1, $2)
        ON CONFLICT(session_id) DO UPDATE SET data=EXCLUDED.data
    `, [session.session_id, JSON.stringify(session)]);
}

// ─── Vault Operations (Encrypted) ───────────────────────────────────────────

export async function getSecret(title: string): Promise<string | undefined> {
    const { rows } = await db().query('SELECT value FROM vault WHERE title = $1', [title]);
    if (rows.length === 0) return undefined;
    try { return decrypt(rows[0].value); } catch { return undefined; }
}

export async function setSecret(title: string, plainText: string): Promise<void> {
    await db().query(`
        INSERT INTO vault (title, value) VALUES ($1, $2)
        ON CONFLICT(title) DO UPDATE SET value=EXCLUDED.value
    `, [title, encrypt(plainText)]);
}

export async function listSecrets(): Promise<string[]> {
    const { rows } = await db().query('SELECT title FROM vault');
    return rows.map(r => r.title);
}

export async function deleteSecret(title: string): Promise<boolean> {
    const { rowCount } = await db().query('DELETE FROM vault WHERE title = $1', [title]);
    return (rowCount || 0) > 0;
}

// ─── Blocker Operations ────────────────────────────────────────────────────

export async function getBlockers(filters?: { status?: string; severity?: string }): Promise<Blocker[]> {
    let sql = 'SELECT * FROM blockers';
    const params: string[] = [];
    const clauses: string[] = [];
    let idx = 1;

    if (filters?.status) {
        const statuses = filters.status.split(',');
        clauses.push(`status IN (${statuses.map(() => `$${idx++}`).join(',')})`);
        params.push(...statuses);
    }
    if (filters?.severity) {
        const sevs = filters.severity.split(',');
        clauses.push(`severity IN (${sevs.map(() => `$${idx++}`).join(',')})`);
        params.push(...sevs);
    }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ` ORDER BY CASE severity WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 ELSE 2 END, filed_at ASC`;
    
    const { rows } = await db().query(sql, params);
    return rows as Blocker[];
}

export async function getBlocker(id: string): Promise<Blocker | undefined> {
    const { rows } = await db().query('SELECT * FROM blockers WHERE id = $1', [id]);
    return rows.length > 0 ? (rows[0] as Blocker) : undefined;
}

export async function saveBlocker(blocker: Blocker): Promise<void> {
    await db().query(`
        INSERT INTO blockers (
            id, severity, type, filed_by, task_id, description,
            claimed_by, resolved_by, resolution_note, status, filed_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
        ON CONFLICT(id) DO UPDATE SET
            status=EXCLUDED.status, claimed_by=EXCLUDED.claimed_by,
            resolved_by=EXCLUDED.resolved_by, resolution_note=EXCLUDED.resolution_note,
            updated_at=EXCLUDED.updated_at
    `, [
        blocker.id, blocker.severity, blocker.type, blocker.filed_by,
        blocker.task_id ?? null, blocker.description, blocker.claimed_by ?? null,
        blocker.resolved_by ?? null, blocker.resolution_note ?? null,
        blocker.status, blocker.filed_at, blocker.updated_at
    ]);
}

// ─── Weekly Archive Sweep ──────────────────────────────────────────────────

const ARCHIVE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function runArchiveSweep(): Promise<number> {
    const cutoff = new Date(Date.now() - ARCHIVE_AGE_MS).toISOString();
    const archivedAt = new Date().toISOString();
    let numSwept = 0;

    const client = await db().connect();
    try {
        await client.query('BEGIN');
        
        const { rows: eligible } = await client.query(
            `SELECT * FROM tasks WHERE status IN ('done','failed') AND updated < $1`,
            [cutoff]
        );
        
        if (eligible.length > 0) {
            for (const row of eligible) {
                // Task extraction needs proper index alignment for the array slice
                let t = rowToTask(row as any);
                await client.query(`
                    INSERT INTO tasks_archive (
                        id, org, project, workstream, title, description,
                        acceptance_criteria, priority, status, dependencies,
                        parent_task_id, spawn_depth, spawned_by, assigned_to_agent, assigned_to_capability,
                        claimed_by, claimed_at, completed_at, handoff_note, artifacts,
                        created, created_by, updated, prediction, spec_payload, artifact_payload,
                        source, metadata, human_state, archived_at
                    ) VALUES (
                        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30
                    ) ON CONFLICT(id) DO NOTHING
                `, [...taskToRow(t), archivedAt]);
                
                await client.query(`DELETE FROM tasks WHERE id = $1`, [row.id]);
            }
            numSwept = eligible.length;
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[store:archive] Sweep transaction failed:', e);
    } finally {
        client.release();
    }

    if (numSwept > 0) {
        console.log(`[store:archive] Swept ${numSwept} tasks → tasks_archive (cutoff: ${cutoff})`);
    }
    return numSwept;
}

function scheduleWeeklyArchiveSweep(): void {
    function msUntilNextSunday(): number {
        const now = new Date();
        const next = new Date(now);
        next.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
        next.setHours(0, 0, 0, 0);
        return next.getTime() - now.getTime();
    }

    const scheduleNext = () => {
        const delay = msUntilNextSunday();
        const nextRun = new Date(Date.now() + delay).toISOString();
        console.log(`[store:archive] Next weekly sweep scheduled for ${nextRun}`);
        setTimeout(async () => {
            try { await runArchiveSweep(); } catch (e) { console.error('[store:archive] Sweep failed:', e); }
            scheduleNext();
        }, delay);
    };

    scheduleNext();
}

// ─── Archive Query (REST) ──────────────────────────────────────────────────

export async function getArchivedTasks(filters?: { workstream?: string; project?: string; limit?: number }): Promise<Task[]> {
    let sql = `
        SELECT 
            id, org, project, workstream, title, description,
            acceptance_criteria, priority, status, dependencies,
            parent_task_id, spawn_depth, spawned_by, assigned_to_agent, assigned_to_capability,
            claimed_by, claimed_at, completed_at, handoff_note, artifacts,
            created, created_by, updated, prediction, spec_payload, artifact_payload, source, metadata, human_state
        FROM tasks_archive 
        WHERE 1=1
    `;
    const params: (string | number)[] = [];
    let idx = 1;

    if (filters?.workstream) { sql += ` AND workstream = $${idx++}`; params.push(filters.workstream); }
    if (filters?.project)    { sql += ` AND project = $${idx++}`; params.push(filters.project); }
    sql += ' ORDER BY archived_at DESC';
    sql += ` LIMIT $${idx++}`;
    params.push(filters?.limit ?? 200);
    
    const { rows } = await db().query(sql, params);
    return rows.map(rowToTask);
}
