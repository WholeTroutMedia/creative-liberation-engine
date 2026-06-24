import express from 'express';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import readline from 'readline';

const logger = pino({ 
  name: 'scribe-daemon',
  level: process.env.LOG_LEVEL || 'info'
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const DATA_DIR = process.env.SCRIBE_DATA_DIR || path.join(ROOT_DIR, 'services', 'scribe-daemon', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Fallback database in case better-sqlite3 native addon fails on Windows
class JsonFallbackDatabase {
  dbPath: string;
  data: { audit_events: any[]; system_snapshots: any[] };

  constructor(filePath: string) {
    this.dbPath = filePath.replace(/\.db$/, '_fallback.json');
    if (fs.existsSync(this.dbPath)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
      } catch {
        this.data = { audit_events: [], system_snapshots: [] };
      }
    } else {
      this.data = { audit_events: [], system_snapshots: [] };
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err: any) {
      logger.error('Failed to save fallback JSON database: ' + err.message);
    }
  }

  exec(sql: string) {
    return this;
  }

  prepare(sql: string) {
    const self = this;
    const cleanSql = sql.trim().replace(/\s+/g, ' ').toLowerCase();

    return {
      run(...args: any[]) {
        if (cleanSql.includes('insert into audit_events')) {
          const [id, type, source, message, severity, metadata_json] = args;
          self.data.audit_events.push({
            id,
            type,
            source,
            message,
            severity,
            metadata_json,
            timestamp: new Date().toISOString()
          });
          self.save();
        } else if (cleanSql.includes('insert into system_snapshots')) {
          const [id, name, snapshot_json] = args;
          const idx = self.data.system_snapshots.findIndex(s => s.name === name);
          if (idx !== -1) {
            self.data.system_snapshots[idx].snapshot_json = snapshot_json;
            self.data.system_snapshots[idx].created_at = new Date().toISOString();
          } else {
            self.data.system_snapshots.push({
              id,
              name,
              snapshot_json,
              created_at: new Date().toISOString()
            });
          }
          self.save();
        }
        return { changes: 1, lastInsertRowid: 1 };
      },

      get(...args: any[]) {
        if (cleanSql.includes('select count(*) as count from audit_events')) {
          return { count: self.data.audit_events.length };
        } else if (cleanSql.includes('select count(*) as count from system_snapshots')) {
          return { count: self.data.system_snapshots.length };
        } else if (cleanSql.includes('select * from system_snapshots where name = ?')) {
          const [name] = args;
          return self.data.system_snapshots.find(s => s.name === name);
        }
        return null;
      },

      all(...args: any[]) {
        if (cleanSql.includes('select id, name, created_at from system_snapshots')) {
          return [...self.data.system_snapshots]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map(s => ({ id: s.id, name: s.name, created_at: s.created_at }));
        } else if (cleanSql.includes('select * from audit_events')) {
          let results = [...self.data.audit_events];
          let paramIdx = 0;
          if (sql.includes('source = ?')) {
            const val = args[paramIdx++];
            results = results.filter(e => e.source === val);
          }
          if (sql.includes('type = ?')) {
            const val = args[paramIdx++];
            results = results.filter(e => e.type === val);
          }
          if (sql.includes('severity = ?')) {
            const val = args[paramIdx++];
            results = results.filter(e => e.severity === val);
          }
          
          results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          
          const limit = args[paramIdx];
          if (typeof limit === 'number') {
            results = results.slice(0, limit);
          }
          return results;
        }
        return [];
      }
    };
  }
}

const require = createRequire(import.meta.url);
let db: any;
try {
  const Database = require('better-sqlite3');
  db = new Database(path.join(DATA_DIR, 'scribe.db'));
  logger.info('Loaded native better-sqlite3 successfully');
} catch (err: any) {
  logger.warn('Failed to load better-sqlite3 native addon. Falling back to JsonFallbackDatabase: ' + err.message);
  db = new JsonFallbackDatabase(path.join(DATA_DIR, 'scribe.db'));
}

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL,
    metadata_json TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_snapshots (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_events(type);
  CREATE INDEX IF NOT EXISTS idx_audit_source ON audit_events(source);
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
`);

const app = express();
app.use(express.json());

// API Endpoints
app.get('/health', (req, res) => {
  const eventCount = db.prepare('SELECT COUNT(*) as count FROM audit_events').get() as any;
  const snapshotCount = db.prepare('SELECT COUNT(*) as count FROM system_snapshots').get() as any;
  res.json({
    status: 'online',
    service: 'scribe-daemon',
    database: {
      totalEvents: eventCount.count,
      totalSnapshots: snapshotCount.count
    }
  });
});

app.post('/api/scribe/log', (req, res) => {
  const { type, source, message, severity, metadata } = req.body;
  if (!type || !source || !message || !severity) {
    return res.status(400).json({ error: 'type, source, message, and severity are required' });
  }

  try {
    const id = uuidv4();
    const metaStr = metadata ? JSON.stringify(metadata) : null;
    const stmt = db.prepare(`
      INSERT INTO audit_events (id, type, source, message, severity, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, type, source, message, severity, metaStr);
    logger.info({ id, source, type, severity }, `Audit event recorded: ${message}`);
    res.status(201).json({ id, type, source, status: 'logged' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scribe/timeline', (req, res) => {
  const { source, type, severity, limit } = req.query;
  const conditions: string[] = [];
  const params: any[] = [];

  if (source) {
    conditions.push('source = ?');
    params.push(source);
  }
  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (severity) {
    conditions.push('severity = ?');
    params.push(severity);
  }

  const queryLimit = limit ? parseInt(limit as string) : 100;
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT * FROM audit_events 
    ${whereClause} 
    ORDER BY timestamp DESC 
    LIMIT ?
  `;
  params.push(queryLimit);

  try {
    const events = db.prepare(query).all(...params) as any[];
    res.json(events.map(e => ({
      id: e.id,
      type: e.type,
      source: e.source,
      message: e.message,
      severity: e.severity,
      metadata: e.metadata_json ? JSON.parse(e.metadata_json) : null,
      timestamp: e.timestamp
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/scribe/snapshot', (req, res) => {
  const { name, state } = req.body;
  if (!name || !state) {
    return res.status(400).json({ error: 'name and state payload are required' });
  }

  try {
    const id = uuidv4();
    const stateStr = JSON.stringify(state);
    const stmt = db.prepare(`
      INSERT INTO system_snapshots (id, name, snapshot_json)
      VALUES (?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        snapshot_json = excluded.snapshot_json,
        created_at = CURRENT_TIMESTAMP
    `);
    stmt.run(id, name, stateStr);
    logger.info({ id, name }, `System state snapshot captured successfully`);
    res.status(201).json({ id, name, status: 'captured' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scribe/snapshots', (req, res) => {
  try {
    const snapshots = db.prepare('SELECT id, name, created_at FROM system_snapshots ORDER BY created_at DESC').all();
    res.json(snapshots);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scribe/snapshots/:name', (req, res) => {
  try {
    const snap = db.prepare('SELECT * FROM system_snapshots WHERE name = ?').get(req.params.name) as any;
    if (!snap) return res.status(404).json({ error: `Snapshot '${req.params.name}' not found` });
    
    res.json({
      id: snap.id,
      name: snap.name,
      state: JSON.parse(snap.snapshot_json),
      created_at: snap.created_at
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5080;
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'scribe-daemon event recording auditor online');
  console.error(`[CLE ENGINE] scribe-daemon LIVE on port ${PORT}`);
});

// Minimal stdio MCP/JSON-RPC handshake to prevent IDE initialization errors
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.method === "initialize") {
      const response = {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: msg.params?.protocolVersion || "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "scribe-daemon",
            version: "0.1.0"
          }
        }
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  } catch (err) {
    console.error("[ScribeDaemon] Stdio parse error:", err);
  }
});
