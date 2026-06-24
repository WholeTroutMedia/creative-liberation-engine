-- CLE Agent Mail — D1 Schema (SQLite)
-- Migration: 0001_initial.sql

-- ─── Threads ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL DEFAULT '',
  last_message_at INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0
);

-- ─── Messages ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  from_addr TEXT NOT NULL,
  to_addr TEXT NOT NULL DEFAULT '',
  cc TEXT DEFAULT '',
  bcc TEXT DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body_text TEXT DEFAULT '',
  body_html TEXT DEFAULT '',
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  approved INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'received',
  agent_target TEXT DEFAULT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (thread_id) REFERENCES threads(id)
);

CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_approved ON messages(approved);
CREATE INDEX idx_messages_from ON messages(from_addr);
CREATE INDEX idx_messages_agent ON messages(agent_target);
CREATE INDEX idx_messages_archived ON messages(archived);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- ─── Attachments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_message ON attachments(message_id);

-- ─── Labels ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- ─── Message ↔ Label Junction ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_labels (
  message_id TEXT NOT NULL,
  label_id INTEGER NOT NULL,
  PRIMARY KEY (message_id, label_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);

-- ─── Approved Senders ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approved_senders (
  email TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  approved_at INTEGER NOT NULL DEFAULT (unixepoch()),
  approved_by TEXT DEFAULT 'operator'
);

-- ─── Drafts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  agent_id TEXT DEFAULT NULL,
  to_addr TEXT DEFAULT '',
  cc TEXT DEFAULT '',
  bcc TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  body_text TEXT DEFAULT '',
  thread_id TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'discarded')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_drafts_status ON drafts(status);
CREATE INDEX idx_drafts_agent ON drafts(agent_id);

-- ─── Full-Text Search (FTS5) ─────────────────────────────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  subject,
  body_text,
  content='messages',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, subject, body_text)
  VALUES (NEW.rowid, NEW.subject, NEW.body_text);
END;

CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, body_text)
  VALUES ('delete', OLD.rowid, OLD.subject, OLD.body_text);
END;

CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, body_text)
  VALUES ('delete', OLD.rowid, OLD.subject, OLD.body_text);
  INSERT INTO messages_fts(rowid, subject, body_text)
  VALUES (NEW.rowid, NEW.subject, NEW.body_text);
END;
