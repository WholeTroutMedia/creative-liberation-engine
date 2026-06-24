import pino from 'pino';
import express from 'express';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const logger = pino({ 
  name: 'helix-1-infrastructure',
  level: process.env.LOG_LEVEL || 'info'
});

// Ensure data directory exists
const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'helix1.db'));

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS swarm_runs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    status TEXT NOT NULL,
    duration_ms INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    payload TEXT
  );

  CREATE TABLE IF NOT EXISTS credits (
    id TEXT PRIMARY KEY,
    pool_name TEXT UNIQUE NOT NULL,
    allocated INTEGER NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contexts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    payload TEXT,
    size INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS debt (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    severity TEXT,
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

export class InfrastructureManager {
  async trackSwarm(agentId: string, status: string, durationMs?: number, payload?: any) {
    const id = uuidv4();
    const payloadStr = payload ? JSON.stringify(payload) : null;
    const stmt = db.prepare(`
      INSERT INTO swarm_runs (id, agent_id, status, duration_ms, payload)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, agentId, status, durationMs ?? null, payloadStr);
    logger.info({ agentId, status, durationMs }, 'Swarm execution tracked');
    return { id, agentId, status };
  }

  async allocateResourcePool(poolName: string, tokens: number) {
    const stmt = db.prepare(`
      INSERT INTO credits (id, pool_name, allocated, used)
      VALUES (?, ?, ?, 0)
      ON CONFLICT(pool_name) DO UPDATE SET
        allocated = allocated + excluded.allocated
    `);
    const id = uuidv4();
    stmt.run(id, poolName, tokens);
    logger.info({ poolName, tokens }, 'Resource credit pool allocated');
    return this.getPool(poolName);
  }

  async spendCredits(poolName: string, tokens: number) {
    const stmt = db.prepare(`
      UPDATE credits 
      SET used = used + ? 
      WHERE pool_name = ? AND (allocated - used) >= ?
    `);
    const result = stmt.run(tokens, poolName, tokens);
    if (result.changes === 0) {
      throw new Error(`Insufficient credits in pool '${poolName}' or pool does not exist.`);
    }
    logger.info({ poolName, tokens }, 'Credits spent');
    return this.getPool(poolName);
  }

  getPool(poolName: string) {
    return db.prepare('SELECT * FROM credits WHERE pool_name = ?').get(poolName);
  }

  async applySubquadraticContext(name: string, payload: any) {
    const id = uuidv4();
    const payloadStr = JSON.stringify(payload);
    const size = payloadStr.length;
    const stmt = db.prepare(`
      INSERT INTO contexts (id, name, payload, size)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, name, payloadStr, size);
    logger.info({ name, size }, 'Subquadratic context applied (12M Token Window Mapping)');
    return { id, name, size };
  }

  async scanHiddenDebt(dirToScan: string) {
    logger.info({ dirToScan }, 'Scanning for technical debt...');
    const foundDebt: any[] = [];
    
    const scanDir = (dir: string) => {
      let files: string[];
      try {
        files = fs.readdirSync(dir);
      } catch (err) {
        return;
      }
      for (const file of files) {
        const fullPath = path.join(dir, file);
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue;
        }
        if (stat.isDirectory()) {
          if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
            scanDir(fullPath);
          }
        } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.mjs'))) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK') || line.includes('stub') || line.includes('IE-IDX')) {
                let type = 'TODO';
                if (line.includes('FIXME')) type = 'FIXME';
                else if (line.includes('HACK')) type = 'HACK';
                else if (line.includes('IE-IDX')) type = 'IE-IDX';

                foundDebt.push({
                  id: uuidv4(),
                  file_path: fullPath,
                  type,
                  description: `Line ${idx + 1}: ${line.trim()}`,
                  severity: type === 'FIXME' ? 'high' : 'medium'
                });
              }
            });
          } catch {
            // Ignore unreadable files
          }
        }
      }
    };

    scanDir(dirToScan);

    // Save found debt to DB
    const deleteStmt = db.prepare('DELETE FROM debt');
    deleteStmt.run();

    const insertStmt = db.prepare(`
      INSERT INTO debt (id, file_path, type, description, severity)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((debts) => {
      for (const d of debts) {
        insertStmt.run(d.id, d.file_path, d.type, d.description, d.severity);
      }
    });

    transaction(foundDebt);
    logger.info({ count: foundDebt.length }, 'Technical debt scan completed');
    return foundDebt;
  }
}

const manager = new InfrastructureManager();
const app = express();
app.use(express.json());

// API Endpoints
app.get('/health', (req, res) => {
  const swarmCount = db.prepare('SELECT COUNT(*) as count FROM swarm_runs').get() as any;
  const debtCount = db.prepare('SELECT COUNT(*) as count FROM debt').get() as any;
  res.json({
    status: 'online',
    service: 'helix-1-infrastructure',
    database: {
      swarmRuns: swarmCount.count,
      activeDebtItems: debtCount.count
    }
  });
});

app.post('/api/swarm/track', async (req, res) => {
  const { agentId, status, durationMs, payload } = req.body;
  if (!agentId || !status) {
    return res.status(400).json({ error: 'agentId and status are required' });
  }
  try {
    const run = await manager.trackSwarm(agentId, status, durationMs, payload);
    res.status(201).json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/swarm/status', (req, res) => {
  const runs = db.prepare('SELECT * FROM swarm_runs ORDER BY created_at DESC LIMIT 50').all();
  res.json(runs);
});

app.post('/api/credits/allocate', async (req, res) => {
  const { poolName, tokens } = req.body;
  if (!poolName || typeof tokens !== 'number') {
    return res.status(400).json({ error: 'poolName and tokens (number) are required' });
  }
  try {
    const pool = await manager.allocateResourcePool(poolName, tokens);
    res.json(pool);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/credits/spend', async (req, res) => {
  const { poolName, tokens } = req.body;
  if (!poolName || typeof tokens !== 'number') {
    return res.status(400).json({ error: 'poolName and tokens (number) are required' });
  }
  try {
    const pool = await manager.spendCredits(poolName, tokens);
    res.json(pool);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/credits/usage', (req, res) => {
  const pools = db.prepare('SELECT * FROM credits').all();
  res.json(pools);
});

app.post('/api/context/subquadratic', async (req, res) => {
  const { name, payload } = req.body;
  if (!name || !payload) {
    return res.status(400).json({ error: 'name and payload are required' });
  }
  try {
    const result = await manager.applySubquadraticContext(name, payload);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/context-map', (req, res) => {
  const contexts = db.prepare('SELECT id, name, size, created_at FROM contexts ORDER BY created_at DESC').all();
  res.json(contexts);
});

app.post('/api/debt/scan', async (req, res) => {
  const { dir } = req.body;
  const targetDir = dir || '../'; // default to scanning the workspace root
  try {
    const absolutePath = path.resolve(targetDir);
    const debts = await manager.scanHiddenDebt(absolutePath);
    res.json({ success: true, count: debts.length, debts: debts.slice(0, 100) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/debt/report', (req, res) => {
  const report = db.prepare('SELECT * FROM debt ORDER BY severity DESC, created_at DESC').all();
  res.json(report);
});

const PORT = process.env.PORT || 6001;
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'helix-1-infrastructure service online');
  console.log(`[CLE ENGINE] helix-1-infrastructure LIVE on port ${PORT}`);
});
