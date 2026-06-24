-- =============================================================
-- CLEENGINE-SYSTEMS: User Directory Tree Schema
-- Target: cle_genesis (NAS PostgreSQL @ 127.0.0.1)
-- =============================================================

-- Users: core identity node
CREATE TABLE IF NOT EXISTS cle_users (
  uid             TEXT PRIMARY KEY,                   -- e.g. "jaharoni"
  display_name    TEXT NOT NULL,
  email           TEXT,
  avatar_url      TEXT,
  bio             TEXT,
  timezone        TEXT DEFAULT 'America/New_York',
  language        TEXT DEFAULT 'en',
  preferences     JSONB DEFAULT '{}'::jsonb,          -- UI prefs, agent verbosity, etc.
  roles           TEXT[] DEFAULT ARRAY['user'],
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ DEFAULT NOW(),
  is_active       BOOLEAN DEFAULT TRUE
);

-- Memory nodes: episodic / semantic / procedural
CREATE TABLE IF NOT EXISTS cle_user_memory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid             TEXT NOT NULL REFERENCES cle_users(uid) ON DELETE CASCADE,
  memory_type     TEXT NOT NULL CHECK (memory_type IN ('episodic', 'semantic', 'procedural')),
  key             TEXT,                               -- optional label / slug
  content         TEXT NOT NULL,
  meta            JSONB DEFAULT '{}'::jsonb,          -- source, confidence, tags, etc.
  embedding_ref   TEXT,                               -- pointer to vector store (Qdrant/pgvector)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ                         -- optional TTL for ephemeral memories
);

CREATE INDEX IF NOT EXISTS idx_user_memory_uid ON cle_user_memory(uid);
CREATE INDEX IF NOT EXISTS idx_user_memory_type ON cle_user_memory(uid, memory_type);

-- Agent roster: which agents a user has access to + their permissions
CREATE TABLE IF NOT EXISTS cle_user_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid             TEXT NOT NULL REFERENCES cle_users(uid) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL,                      -- e.g. "athena", "vera", "iris"
  display_name    TEXT,
  acl             JSONB DEFAULT '{}'::jsonb,          -- read/write permissions per tree path
  is_active       BOOLEAN DEFAULT TRUE,
  granted_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_agents_uid_agent ON cle_user_agents(uid, agent_id);

-- Contacts / people graph
CREATE TABLE IF NOT EXISTS cle_user_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid             TEXT NOT NULL REFERENCES cle_users(uid) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  relationship    TEXT,                               -- "client", "family", "team", etc.
  meta            JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log: who/what touched the tree and when
CREATE TABLE IF NOT EXISTS cle_user_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid             TEXT NOT NULL REFERENCES cle_users(uid) ON DELETE CASCADE,
  actor           TEXT NOT NULL,                      -- uid of user OR agent_id
  actor_type      TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
  action          TEXT NOT NULL,                      -- "read", "write", "delete"
  path            TEXT NOT NULL,                      -- virtual path: "memory/episodic", "vault/documents"
  detail          JSONB DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_audit_uid ON cle_user_audit(uid);
CREATE INDEX IF NOT EXISTS idx_user_audit_occurred ON cle_user_audit(occurred_at DESC);

-- =============================================================
-- SEED: Sovereign Artist (jaharoni) — Operator / Root User
-- =============================================================
INSERT INTO cle_users (uid, display_name, email, timezone, roles, preferences)
VALUES (
  'jaharoni',
  'Sovereign Artist',
  'justin@incompass.inc',
  'America/New_York',
  ARRAY['user', 'admin', 'operator'],
  '{
    "agent_verbosity": "compact",
    "theme": "dark",
    "hud_panels": ["dispatch", "agents", "memory", "inbox"],
    "notifications": {"digest": "daily", "signals": true}
  }'::jsonb
)
ON CONFLICT (uid) DO UPDATE SET
  last_active_at = NOW(),
  preferences = EXCLUDED.preferences;

-- Seed AVERI agents for Artist
INSERT INTO cle_user_agents (uid, agent_id, display_name, acl)
VALUES
  ('jaharoni', 'athena', 'ATHENA', '{"read": ["*"], "write": ["projects", "inbox", "memory"]}'::jsonb),
  ('jaharoni', 'vera',   'VERA',   '{"read": ["*"], "write": ["projects", "inbox", "comms"]}'::jsonb),
  ('jaharoni', 'iris',   'IRIS',   '{"read": ["*"], "write": ["media", "comms", "memory"]}'::jsonb)
ON CONFLICT (uid, agent_id) DO NOTHING;

-- Seed a bootstrap episodic memory
INSERT INTO cle_user_memory (uid, memory_type, key, content, meta)
VALUES (
  'jaharoni',
  'episodic',
  'system-init',
  'User directory tree initialized for jaharoni. AVERI agents registered. NAS storage provisioned.',
  '{"source": "system", "tags": ["init", "averi", "cle"]}'::jsonb
)
ON CONFLICT DO NOTHING;
