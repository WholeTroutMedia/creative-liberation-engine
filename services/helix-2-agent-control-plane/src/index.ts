import pino from 'pino';
import express from 'express';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const logger = pino({ 
  name: 'helix-2-control-plane',
  level: process.env.LOG_LEVEL || 'info'
});

const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'helix2.db'));

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS relations (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(source_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY(target_id) REFERENCES entities(id) ON DELETE CASCADE,
    UNIQUE(source_id, target_id, relation_type)
  );

  CREATE TABLE IF NOT EXISTS scraped_pages (
    id TEXT PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    title TEXT,
    content TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

export class ControlPlane {
  async ingestKnowledgeGraph(name: string, type: string, description?: string, relations?: Array<{ targetName: string; relationType: string }>) {
    // 1. Ingest/Update Entity
    const entityId = uuidv4();
    const insertEntity = db.prepare(`
      INSERT INTO entities (id, name, type, description)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        type = excluded.type,
        description = COALESCE(excluded.description, description)
    `);
    
    insertEntity.run(entityId, name, type, description || null);
    
    // Resolve the actual ID (either the newly generated one or the existing one)
    const entityObj = db.prepare('SELECT id FROM entities WHERE name = ?').get(name) as { id: string };
    const actualSourceId = entityObj.id;

    // 2. Ingest Relations
    if (relations && relations.length > 0) {
      const insertRelation = db.prepare(`
        INSERT INTO relations (id, source_id, target_id, relation_type)
        VALUES (?, ?, ?, ?)
        ON CONFLICT DO NOTHING
      `);

      for (const rel of relations) {
        // Ensure target entity exists
        const targetId = uuidv4();
        db.prepare(`
          INSERT INTO entities (id, name, type)
          VALUES (?, ?, 'Unknown')
          ON CONFLICT(name) DO NOTHING
        `).run(targetId, rel.targetName);

        const targetObj = db.prepare('SELECT id FROM entities WHERE name = ?').get(rel.targetName) as { id: string };
        insertRelation.run(uuidv4(), actualSourceId, targetObj.id, rel.relationType);
      }
    }

    logger.info({ name, type, relationsCount: relations?.length || 0 }, 'Ingested entity and relations into Knowledge Graph');
    return this.getEntity(name);
  }

  getEntity(name: string) {
    const entity = db.prepare('SELECT * FROM entities WHERE name = ?').get(name) as any;
    if (!entity) return null;

    const relations = db.prepare(`
      SELECT r.relation_type, e.name as target_name, e.type as target_type
      FROM relations r
      JOIN entities e ON r.target_id = e.id
      WHERE r.source_id = ?
    `).all(entity.id);

    return { ...entity, relations };
  }

  async runSovereignWebScrape(url: string) {
    logger.info({ url }, 'Executing sovereign web scrape...');
    let title = 'Sovereign Scrape Match';
    let textContent = '';
    
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 CLEEngine/6.0' },
        signal: AbortSignal.timeout(10000) // 10s timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();

      // Basic regex parsing to avoid heavy dependency trees
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }

      // Strip tags to extract text content
      textContent = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Truncate to reasonable length for store
      if (textContent.length > 50000) {
        textContent = textContent.slice(0, 50000) + '... [TRUNCATED]';
      }

    } catch (err: any) {
      logger.warn({ url, error: err.message }, 'Live fetch failed, recording scrape event with fallback error context');
      textContent = `Failed to scrape url ${url}. Error: ${err.message}`;
    }

    const id = uuidv4();
    const insertScrape = db.prepare(`
      INSERT INTO scraped_pages (id, url, title, content)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        created_at = CURRENT_TIMESTAMP
    `);
    insertScrape.run(id, url, title, textContent);
    return { id, url, title, contentLength: textContent.length };
  }

  async assembleCompanyBrainContext() {
    logger.info('Assembling pre-model company brain relational context...');
    const entities = db.prepare('SELECT * FROM entities').all() as any[];
    const relations = db.prepare(`
      SELECT r.source_id, r.target_id, r.relation_type, 
             e1.name as source_name, e2.name as target_name
      FROM relations r
      JOIN entities e1 ON r.source_id = e1.id
      JOIN entities e2 ON r.target_id = e2.id
    `).all() as any[];

    const scraped = db.prepare('SELECT id, url, title, length(content) as size, created_at FROM scraped_pages').all();

    return {
      version: '6.0.0',
      timestamp: new Date().toISOString(),
      graph: {
        entityCount: entities.length,
        relationCount: relations.length,
        entities: entities.map(e => ({
          id: e.id,
          name: e.name,
          type: e.type,
          description: e.description
        })),
        relations: relations.map(r => ({
          source: r.source_name,
          target: r.target_name,
          type: r.relation_type
        }))
      },
      sources: scraped
    };
  }
}

const controlPlane = new ControlPlane();
const app = express();
app.use(express.json());

// API Endpoints
app.get('/health', (req, res) => {
  const entityCount = db.prepare('SELECT COUNT(*) as count FROM entities').get() as any;
  const scrapeCount = db.prepare('SELECT COUNT(*) as count FROM scraped_pages').get() as any;
  res.json({
    status: 'online',
    service: 'helix-2-agent-control-plane',
    database: {
      entities: entityCount.count,
      scrapedPages: scrapeCount.count
    }
  });
});

app.post('/api/knowledge/entities', async (req, res) => {
  const { name, type, description, relations } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' });
  }
  try {
    const entity = await controlPlane.ingestKnowledgeGraph(name, type, description, relations);
    res.status(201).json(entity);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/knowledge/entities/:name', (req, res) => {
  try {
    const entity = controlPlane.getEntity(req.params.name);
    if (!entity) return res.status(404).json({ error: 'Entity not found' });
    res.json(entity);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/knowledge/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
  try {
    const results = db.prepare(`
      SELECT * FROM entities 
      WHERE name LIKE ? OR description LIKE ?
      LIMIT 20
    `).all(`%${q}%`, `%${q}%`);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const result = await controlPlane.runSovereignWebScrape(url);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/context/aggregate', async (req, res) => {
  try {
    const context = await controlPlane.assembleCompanyBrainContext();
    res.json(context);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 6002;
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'helix-2-agent-control-plane service online');
  console.log(`[CLE ENGINE] helix-2-agent-control-plane LIVE on port ${PORT}`);
});
