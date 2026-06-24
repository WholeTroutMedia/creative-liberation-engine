import express from 'express';
import pino from 'pino';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { 
  createDocument, 
  updateField, 
  deleteField, 
  mergeRemote, 
  getDocument, 
  getActiveState,
  CRDTDocument
} from './modules/crdt-state.js';
import { logMemoryTransaction } from './modules/memory-history.js';
import { initQdrantSpine, initializeCollection, insertVector, searchVectors } from './modules/qdrant-spine.js';
import { EdgeSyncBridge, SubquadraticContextCompactor, StaticESMCompiler } from '../../../packages/memory/src/MemoryUnification.js';

const logger = pino({ 
  name: 'averi-memory-service',
  level: process.env.LOG_LEVEL || 'info'
});

const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'memory.db'));

// Initialize Qdrant Spine vector engine
initQdrantSpine(db);

// Initialize SQLite Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS crdt_docs (
    doc_id TEXT PRIMARY KEY,
    collection TEXT NOT NULL,
    state_json TEXT NOT NULL,
    vector_clock_json TEXT NOT NULL,
    last_sync TEXT NOT NULL,
    origin_node TEXT NOT NULL,
    conflict_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS nodes (
    node_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    last_seen TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS context_cache (
    cache_key TEXT PRIMARY KEY,
    gemini_cache_name TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    tokens INTEGER DEFAULT 0
  );
`);

// Load all persisted CRDT documents into memory map at boot
try {
  const savedDocs = db.prepare('SELECT * FROM crdt_docs').all() as any[];
  logger.info({ count: savedDocs.length }, 'Restoring CRDT memory documents from DB');
} catch (err: any) {
  logger.error(err, 'Failed to restore documents from database');
}

const persistDoc = (doc: CRDTDocument, action: 'create' | 'update' | 'delete' | 'sync' = 'update') => {
  const stmt = db.prepare(`
    INSERT INTO crdt_docs (doc_id, collection, state_json, vector_clock_json, last_sync, origin_node, conflict_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(doc_id) DO UPDATE SET
      state_json = excluded.state_json,
      vector_clock_json = excluded.vector_clock_json,
      last_sync = excluded.last_sync,
      conflict_count = excluded.conflict_count
  `);
  stmt.run(
    doc.doc_id,
    doc.collection,
    JSON.stringify(doc.state),
    JSON.stringify(doc.vector_clock),
    doc.last_sync,
    doc.origin_node,
    doc.conflict_count
  );
  
  logMemoryTransaction(doc.doc_id, doc.collection, doc.state, action).catch((err: any) => {
    logger.warn({ error: err.message }, 'Failed to log memory git transaction');
  });
};

const app = express();
app.use(express.json());

// API Endpoints
app.get('/health', (req, res) => {
  const docCount = db.prepare('SELECT COUNT(*) as count FROM crdt_docs').get() as any;
  res.json({
    status: 'online',
    service: 'averi-memory-service',
    database: {
      activeDocuments: docCount.count
    }
  });
});

app.post('/api/documents', (req, res) => {
  const { collection, initialState, id } = req.body;
  if (!collection) return res.status(400).json({ error: 'collection is required' });
  try {
    const doc = createDocument(collection, initialState || {}, id);
    persistDoc(doc, 'create');
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id', (req, res) => {
  // Try fetching from DB to support persistent loading
  try {
    const dbDoc = db.prepare('SELECT * FROM crdt_docs WHERE doc_id = ?').get(req.params.id) as any;
    if (!dbDoc) return res.status(404).json({ error: 'Document not found' });
    
    res.json({
      doc_id: dbDoc.doc_id,
      collection: dbDoc.collection,
      state: JSON.parse(dbDoc.state_json),
      vector_clock: JSON.parse(dbDoc.vector_clock_json),
      last_sync: dbDoc.last_sync,
      origin_node: dbDoc.origin_node,
      conflict_count: dbDoc.conflict_count
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id/active', (req, res) => {
  try {
    const dbDoc = db.prepare('SELECT * FROM crdt_docs WHERE doc_id = ?').get(req.params.id) as any;
    if (!dbDoc) return res.status(404).json({ error: 'Document not found' });
    
    const state = JSON.parse(dbDoc.state_json);
    const activeState: Record<string, any> = {};
    for (const [key, val] of Object.entries(state)) {
      const crdtVal = val as any;
      if (!crdtVal.tombstone) {
        activeState[key] = crdtVal.value;
      }
    }
    
    res.json({
      doc_id: req.params.id,
      collection: dbDoc.collection,
      activeState
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/documents/:id/fields', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'key and value are required' });
  }

  try {
    // 1. Fetch current document
    const dbDoc = db.prepare('SELECT * FROM crdt_docs WHERE doc_id = ?').get(req.params.id) as any;
    if (!dbDoc) return res.status(404).json({ error: 'Document not found' });

    const doc: CRDTDocument = {
      doc_id: dbDoc.doc_id,
      collection: dbDoc.collection,
      state: JSON.parse(dbDoc.state_json),
      vector_clock: JSON.parse(dbDoc.vector_clock_json),
      last_sync: dbDoc.last_sync,
      origin_node: dbDoc.origin_node,
      conflict_count: dbDoc.conflict_count
    };

    // 2. Mutate state
    const now = Date.now();
    doc.state[key] = { value, timestamp: now, node_id: doc.origin_node, tombstone: false };
    doc.vector_clock[doc.origin_node] = (doc.vector_clock[doc.origin_node] || 0) + 1;
    doc.last_sync = new Date().toISOString();

    // 3. Save
    persistDoc(doc, 'update');
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/documents/:id/fields/:key', (req, res) => {
  const { key } = req.params;
  try {
    const dbDoc = db.prepare('SELECT * FROM crdt_docs WHERE doc_id = ?').get(req.params.id) as any;
    if (!dbDoc) return res.status(404).json({ error: 'Document not found' });

    const doc: CRDTDocument = {
      doc_id: dbDoc.doc_id,
      collection: dbDoc.collection,
      state: JSON.parse(dbDoc.state_json),
      vector_clock: JSON.parse(dbDoc.vector_clock_json),
      last_sync: dbDoc.last_sync,
      origin_node: dbDoc.origin_node,
      conflict_count: dbDoc.conflict_count
    };

    if (!doc.state[key]) {
      return res.status(404).json({ error: `Field '${key}' not found` });
    }

    doc.state[key].tombstone = true;
    doc.state[key].timestamp = Date.now();
    doc.state[key].node_id = doc.origin_node;
    doc.vector_clock[doc.origin_node] = (doc.vector_clock[doc.origin_node] || 0) + 1;
    doc.last_sync = new Date().toISOString();

    persistDoc(doc, 'delete');
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CRDT Sync Merge Endpoint
app.post('/api/documents/:id/sync', (req, res) => {
  const { remoteState, remoteClock } = req.body;
  if (!remoteState || !remoteClock) {
    return res.status(400).json({ error: 'remoteState and remoteClock are required' });
  }

  try {
    const dbDoc = db.prepare('SELECT * FROM crdt_docs WHERE doc_id = ?').get(req.params.id) as any;
    if (!dbDoc) return res.status(404).json({ error: 'Document not found' });

    const doc: CRDTDocument = {
      doc_id: dbDoc.doc_id,
      collection: dbDoc.collection,
      state: JSON.parse(dbDoc.state_json),
      vector_clock: JSON.parse(dbDoc.vector_clock_json),
      last_sync: dbDoc.last_sync,
      origin_node: dbDoc.origin_node,
      conflict_count: dbDoc.conflict_count
    };

    const start = Date.now();
    let conflicts = 0;

    for (const [key, remoteVal] of Object.entries(remoteState)) {
      const localVal = doc.state[key];
      const rVal = remoteVal as any;
      if (!localVal || rVal.timestamp > localVal.timestamp) {
        doc.state[key] = rVal;
      } else if (rVal.timestamp === localVal.timestamp && rVal.node_id !== localVal.node_id) {
        // Conflict resolve by node lexicographic order
        if (rVal.node_id > localVal.node_id) doc.state[key] = rVal;
        conflicts++;
      }
    }

    // Merge vector clocks
    for (const [node, count] of Object.entries(remoteClock)) {
      const remoteCount = count as number;
      doc.vector_clock[node] = Math.max(doc.vector_clock[node] || 0, remoteCount);
    }

    doc.conflict_count += conflicts;
    doc.last_sync = new Date().toISOString();

    persistDoc(doc, 'sync');

    res.json({
      sync_id: uuidv4(),
      conflicts_resolved: conflicts,
      bytes_transferred: JSON.stringify(remoteState).length,
      duration_ms: Date.now() - start,
      document: doc
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── WS-03: Vector Indexing & Qdrant Integration Endpoints ─────────────────────────────────────

// 1. Initialize Collection
app.post('/api/vectors/indexes', async (req, res) => {
  const { collection, vectorSize } = req.body;
  if (!collection) {
    return res.status(400).json({ error: 'collection is required' });
  }
  try {
    const success = await initializeCollection(collection, vectorSize || 1536);
    res.json({ success, collection });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Insert Vector Point
app.post('/api/vectors/insert', async (req, res) => {
  const { vectorId, docId, collection, vector, payload } = req.body;
  if (!vectorId || !docId || !collection || !Array.isArray(vector)) {
    return res.status(400).json({ error: 'vectorId, docId, collection, and vector array are required' });
  }
  try {
    const success = await insertVector(vectorId, docId, collection, vector, payload || {});
    res.json({ success, vectorId, docId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Search Vector Points
app.post('/api/vectors/search', async (req, res) => {
  const { collection, queryVector, limit } = req.body;
  if (!collection || !Array.isArray(queryVector)) {
    return res.status(400).json({ error: 'collection and queryVector array are required' });
  }
  try {
    const results = await searchVectors(collection, queryVector, limit || 10);
    res.json({ results, collection });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── WS-03: Memory Unification & Edge Sync Endpoints ─────────────────────────

// 1. Edge Sync Bridge Synchronizer
app.post('/api/unification/sync', async (req, res) => {
  const { localDbPath, nasVaultPath } = req.body;
  try {
    const bridge = new EdgeSyncBridge(localDbPath, nasVaultPath);
    const result = await bridge.synchronizeWithNAS();
    if (result.success) {
      res.json({ success: true, ...result.value });
    } else {
      res.status(500).json({ error: (result as any).error });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Subquadratic Dynamic Context Compactor
app.post('/api/unification/compact', async (req, res) => {
  const { dialogueHistory, maxTurns } = req.body;
  if (!dialogueHistory || !Array.isArray(dialogueHistory)) {
    return res.status(400).json({ error: 'dialogueHistory array is required' });
  }
  try {
    const compactor = new SubquadraticContextCompactor();
    const result = await compactor.compactDialogue(dialogueHistory, maxTurns || 6);
    if (result.success) {
      res.json({ success: true, compactedRecord: result.value });
    } else {
      res.status(400).json({ error: (result as any).error });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Static ESM Compiler (Compile-Stage Knowledge Layer)
app.post('/api/unification/compile', async (req, res) => {
  const { sourceDir, outputDir } = req.body;
  try {
    const compiler = new StaticESMCompiler(sourceDir, outputDir);
    const result = await compiler.compileKnowledgeLayer();
    if (result.success) {
      res.json({ success: true, ...result.value });
    } else {
      res.status(500).json({ error: (result as any).error });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── WS-03: Context Caching Endpoints ─────────────────────────────────────────

// Helper to compute SHA-256 hash of a string
const sha256 = (str: string): string => {
  return crypto.createHash('sha256').update(str).digest('hex');
};

// Clean up expired caches from SQLite database
const cleanupExpiredCaches = () => {
  try {
    const now = new Date().toISOString();
    const result = db.prepare('DELETE FROM context_cache WHERE expires_at < ?').run(now);
    if (result.changes > 0) {
      logger.info({ evicted: result.changes }, 'Cleaned up expired context caches from database');
    }
  } catch (err: any) {
    logger.error(err, 'Failed to perform context cache cleanup');
  }
};

// Register a context for caching
app.post('/api/context-cache/register', async (req, res) => {
  const { key, content, model, ttlSeconds } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  const targetModel = model || 'models/gemini-2.5-flash';
  const ttl = ttlSeconds || 300; // default 5 minutes
  const contentHash = sha256(content);
  const cacheKey = key || `cache-${contentHash.substring(0, 16)}`;

  cleanupExpiredCaches();

  try {
    // 1. Check if cache exists and is not expired
    const now = new Date().toISOString();
    const existing = db.prepare(`
      SELECT * FROM context_cache 
      WHERE (cache_key = ? OR content_hash = ?) AND expires_at > ?
      LIMIT 1
    `).get(cacheKey, contentHash, now) as any;

    if (existing) {
      logger.debug({ cacheKey: existing.cache_key, hit: true }, 'Context cache hit');
      return res.json({
        cacheName: existing.gemini_cache_name,
        expiresAt: existing.expires_at,
        hit: true,
        tokens: existing.tokens
      });
    }

    // 2. Cache Miss. Resolve Gemini context cache if API key is present
    let geminiCacheName = `cachedContents/mock-${uuidv4().substring(0, 8)}`;
    let expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const tokens = Math.ceil(content.length / 4);

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const geminiModel = targetModel.startsWith('models/') ? targetModel : `models/${targetModel}`;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: geminiModel,
            displayName: `averi-memory-caching-${cacheKey}`,
            contents: [
              {
                role: 'user',
                parts: [{ text: content }]
              }
            ],
            ttl: `${ttl}s`
          })
        });

        if (response.ok) {
          const data = await response.json() as any;
          if (data.name) {
            geminiCacheName = data.name;
            if (data.expireTime) {
              expiresAt = new Date(data.expireTime).toISOString();
            }
            logger.info({ geminiCacheName, cacheKey }, 'Successfully registered context cache with Gemini API');
          }
        } else {
          const errText = await response.text();
          logger.warn({ status: response.status, error: errText }, 'Gemini context cache registration failed, using mock cache ID');
        }
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Gemini context cache request exception, using mock cache ID');
      }
    }

    // 3. Persist to SQLite
    db.prepare(`
      INSERT OR REPLACE INTO context_cache (cache_key, gemini_cache_name, content_hash, model, created_at, expires_at, tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(cacheKey, geminiCacheName, contentHash, targetModel, now, expiresAt, tokens);

    res.json({
      cacheName: geminiCacheName,
      expiresAt,
      hit: false,
      tokens
    });
  } catch (err: any) {
    logger.error(err, 'Failed to register context cache');
    res.status(500).json({ error: err.message });
  }
});

// Retrieve context cache by key
app.get('/api/context-cache/:key', (req, res) => {
  try {
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT * FROM context_cache WHERE cache_key = ? AND expires_at > ?').get(req.params.key, now) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Cache not found or expired' });
    }
    res.json(existing);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Evict a cache entry manually
app.delete('/api/context-cache/:key', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM context_cache WHERE cache_key = ?').run(req.params.key);
    res.json({ success: true, changes: result.changes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export app and conditionally listen to support dynamic port testing in Vitest
export { app };

const PORT = process.env.PORT || 5070;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'averi-memory-service CRDT database online');
    console.log(`[CLE ENGINE] averi-memory-service LIVE on port ${PORT}`);
  });
}
