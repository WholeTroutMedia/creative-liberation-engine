import express from 'express';
import cors from 'cors';
import { readdir, readFile, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import sqlite3 from 'sqlite3';

const app = express();
const PORT = 3901;
const REPO_ROOT = process.env.REPO_ROOT ?? '/app/creative-liberation-engine';
const DISPATCH_BASE = process.env.DISPATCH_BASE ?? 'http://127.0.0.1:5050';
const NAS_LEDGER_DB = process.env.NAS_LEDGER_DB ?? '/app/genesis-deploy/runtime/registry/media_ledger.sqlite';

app.use(cors());
app.use(express.json());

// Health
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'nexus-bridge', repo: REPO_ROOT }));

// File tree — shallow listing
app.get('/api/files', async (req, res) => {
  const rel = req.query.path ?? '';
  const dir = join(REPO_ROOT, rel);
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
      .map(e => ({
        name: e.name,
        path: rel ? `${rel}/${e.name}` : e.name,
        type: e.isDirectory() ? 'dir' : 'file',
        ext: e.isFile() ? extname(e.name) : null
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    res.json({ files, dir });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Read file content
app.get('/api/files/read', async (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'path required' });
  const abs = join(REPO_ROOT, filePath);
  if (!abs.startsWith(REPO_ROOT)) return res.status(403).json({ error: 'forbidden' });
  try {
    const s = await stat(abs);
    if (s.size > 500_000) return res.status(413).json({ error: 'file too large' });
    const content = await readFile(abs, 'utf-8');
    res.json({ content, path: filePath, size: s.size });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

import { writeFile } from 'fs/promises';

// Write file content
app.post('/api/files/write', async (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || typeof content !== 'string') return res.status(400).json({ error: 'path and content required' });
  const abs = join(REPO_ROOT, filePath);
  if (!abs.startsWith(REPO_ROOT)) return res.status(403).json({ error: 'forbidden' });
  try {
    await writeFile(abs, content, 'utf-8');
    res.json({ status: 'ok', path: filePath, size: content.length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Fetch latest asset from media ledger
app.get('/api/assets/latest', (req, res) => {
  const db = new sqlite3.Database(NAS_LEDGER_DB, sqlite3.OPEN_READONLY, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to open ledger db' });
  });

  db.get('SELECT * FROM media_ledger ORDER BY ingested_at DESC LIMIT 1', (err, row) => {
    db.close();
    if (err) return res.status(500).json({ error: 'Failed to query ledger' });
    if (!row) return res.json({ assetUrl: '/models/hill-country.glb' }); // Fallback
    
    // Convert to a serveable URL. If we serve via a static directory or nexus-bridge file reader:
    // Actually, we can return the path and let the frontend use /api/files/read or similar, 
    // or return a path that the asset server handles.
    // For now, let's just return a placeholder or the proxy path
    res.json({ assetUrl: '/models/hill-country.glb', data: row });
  });
});

// Proxy dispatch status
app.get('/api/dispatch/status', async (_, res) => {
  try {
    const r = await fetch(`${DISPATCH_BASE}/api/status`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(503).json({ error: 'dispatch unreachable', detail: e.message });
  }
});

// Proxy dispatch tasks
app.get('/api/dispatch/tasks', async (_, res) => {
  try {
    const r = await fetch(`${DISPATCH_BASE}/api/tasks`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(503).json({ error: 'dispatch unreachable', detail: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[nexus-bridge] running on :${PORT}`);
  console.log(`[nexus-bridge] repo root: ${REPO_ROOT}`);
  console.log(`[nexus-bridge] dispatch: ${DISPATCH_BASE}`);
});
