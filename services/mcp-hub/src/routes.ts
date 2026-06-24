import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventBus } from './events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const apiRouter = express.Router();
export const eventBus = new EventBus();

const DATA_DIR = process.env.MCP_HUB_DATA_DIR || path.join(__dirname, '../data');
const ISSUES_FILE = path.join(DATA_DIR, 'issues.json');
const DOCS_FILE = path.join(DATA_DIR, 'docs.json');
const AUDIT_LOG = path.join(DATA_DIR, 'audit.json');

// --- Helpers ---
function readJSON(file: string): any[] {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function writeJSON(file: string, data: any[]): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function appendAudit(action: string, entity: string, entityId: string, agent: string, details?: any): void {
  const log = readJSON(AUDIT_LOG);
  log.push({ timestamp: new Date().toISOString(), action, entity, entityId, agent, details });
  // Keep last 500 entries
  if (log.length > 500) log.splice(0, log.length - 500);
  writeJSON(AUDIT_LOG, log);
}

// Valid status transitions (state machine)
const VALID_TRANSITIONS: Record<string, string[]> = {
  BACKLOG: ['IDEATION'],
  IDEATION: ['DESIGN', 'BACKLOG'],
  DESIGN: ['PLAN', 'IDEATION'],
  PLAN: ['SHIP', 'DESIGN'],
  SHIP: ['VALIDATION', 'PLAN'],
  VALIDATION: ['DONE', 'SHIP'],
  DONE: [],
  BLOCKED: ['BACKLOG', 'IDEATION', 'DESIGN', 'PLAN', 'SHIP', 'VALIDATION'],
};

// ========================
// SENTINEL TRACK ROUTES
// ========================

// LIST all issues (with optional filter)
apiRouter.get('/track/issues', (req: Request, res: Response) => {
  const issues = readJSON(ISSUES_FILE);
  const { status, type, assignee, tag, parent_id, q } = req.query;

  let filtered = issues;
  if (status) filtered = filtered.filter((i: any) => i.status === status);
  if (type) filtered = filtered.filter((i: any) => i.type === type);
  if (assignee) filtered = filtered.filter((i: any) => i.assignee === assignee);
  if (parent_id) filtered = filtered.filter((i: any) => i.parent_id === parent_id);
  if (tag) filtered = filtered.filter((i: any) => i.tags?.includes(tag));
  if (q) {
    const query = (q as string).toLowerCase();
    filtered = filtered.filter((i: any) =>
      i.title.toLowerCase().includes(query) || i.description?.toLowerCase().includes(query)
    );
  }

  res.json(filtered);
});

// GET single issue
apiRouter.get('/track/issues/:id', (req: Request, res: Response) => {
  const issues = readJSON(ISSUES_FILE);
  const issue = issues.find((i: any) => i.id === req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  res.json(issue);
});

// CREATE issue
apiRouter.post('/track/issues', (req: Request, res: Response) => {
  const issues = readJSON(ISSUES_FILE);
  const newIssue = {
    ...req.body,
    id: `trk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    status: req.body.status || 'BACKLOG',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  issues.push(newIssue);
  writeJSON(ISSUES_FILE, issues);
  appendAudit('CREATE', 'issue', newIssue.id, req.body.reporter || 'system');
  eventBus.emit('issue:created', newIssue);
  res.status(201).json(newIssue);
});

// UPDATE issue
apiRouter.patch('/track/issues/:id', (req: Request, res: Response) => {
  const issues = readJSON(ISSUES_FILE);
  const idx = issues.findIndex((i: any) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Issue not found' });

  const old = issues[idx];
  const updates = req.body;

  // Validate status transition if status is being changed
  if (updates.status && updates.status !== old.status) {
    const allowed = VALID_TRANSITIONS[old.status] || [];
    if (!allowed.includes(updates.status)) {
      return res.status(400).json({
        error: `Invalid transition: ${old.status} â†’ ${updates.status}`,
        allowed_transitions: allowed,
      });
    }
  }

  issues[idx] = { ...old, ...updates, updated_at: new Date().toISOString() };
  writeJSON(ISSUES_FILE, issues);
  appendAudit('UPDATE', 'issue', req.params.id, updates._agent || 'system', { from: old.status, to: issues[idx].status });
  eventBus.emit('issue:updated', { old, updated: issues[idx] });
  res.json(issues[idx]);
});

// DELETE issue
apiRouter.delete('/track/issues/:id', (req: Request, res: Response) => {
  let issues = readJSON(ISSUES_FILE);
  const idx = issues.findIndex((i: any) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Issue not found' });
  const removed = issues.splice(idx, 1)[0];
  writeJSON(ISSUES_FILE, issues);
  appendAudit('DELETE', 'issue', req.params.id, req.body?._agent || 'system');
  eventBus.emit('issue:deleted', removed);
  res.json({ deleted: true, id: req.params.id });
});

// TRANSITION status (explicit endpoint)
apiRouter.post('/track/issues/:id/transition', (req: Request, res: Response) => {
  const issues = readJSON(ISSUES_FILE);
  const idx = issues.findIndex((i: any) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Issue not found' });

  const { to, agent } = req.body;
  const old = issues[idx];
  const allowed = VALID_TRANSITIONS[old.status] || [];

  if (!allowed.includes(to)) {
    return res.status(400).json({
      error: `Invalid transition: ${old.status} â†’ ${to}`,
      allowed_transitions: allowed,
    });
  }

  issues[idx] = { ...old, status: to, updated_at: new Date().toISOString() };
  writeJSON(ISSUES_FILE, issues);
  appendAudit('TRANSITION', 'issue', req.params.id, agent || 'system', { from: old.status, to });
  eventBus.emit('issue:transitioned', { issue: issues[idx], from: old.status, to });
  res.json(issues[idx]);
});

// SPRINT BOARD - Get grouped by status with counts
apiRouter.get('/track/board', (_req: Request, res: Response) => {
  const issues = readJSON(ISSUES_FILE);
  const board: Record<string, any[]> = {};
  for (const status of Object.keys(VALID_TRANSITIONS)) {
    board[status] = issues.filter((i: any) => i.status === status);
  }
  const stats = {
    total: issues.length,
    by_status: Object.fromEntries(Object.entries(board).map(([k, v]) => [k, v.length])),
    by_assignee: {} as Record<string, number>,
  };
  for (const issue of issues) {
    if (issue.assignee) {
      stats.by_assignee[issue.assignee] = (stats.by_assignee[issue.assignee] || 0) + 1;
    }
  }
  res.json({ board, stats });
});

// ========================
// SCHOLAR HIVE ROUTES
// ========================

// LIST all docs (with search)
apiRouter.get('/hive/docs', (req: Request, res: Response) => {
  const docs = readJSON(DOCS_FILE);
  const { type, author, tag, q } = req.query;

  let filtered = docs;
  if (type) filtered = filtered.filter((d: any) => d.document_type === type);
  if (author) filtered = filtered.filter((d: any) => d.author === author);
  if (tag) filtered = filtered.filter((d: any) => d.tags?.includes(tag));
  if (q) {
    const query = (q as string).toLowerCase();
    filtered = filtered.filter((d: any) =>
      d.title.toLowerCase().includes(query) || d.content?.toLowerCase().includes(query)
    );
  }

  res.json(filtered);
});

// GET single doc
apiRouter.get('/hive/docs/:id', (req: Request, res: Response) => {
  const docs = readJSON(DOCS_FILE);
  const doc = docs.find((d: any) => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json(doc);
});

// CREATE doc
apiRouter.post('/hive/docs', (req: Request, res: Response) => {
  const docs = readJSON(DOCS_FILE);
  const newDoc = {
    ...req.body,
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    vector_reference: null, // Will be set by vectorization hook
  };
  docs.push(newDoc);
  writeJSON(DOCS_FILE, docs);
  appendAudit('CREATE', 'doc', newDoc.id, req.body.author || 'system');
  eventBus.emit('doc:created', newDoc);
  res.status(201).json(newDoc);
});

// UPDATE doc
apiRouter.patch('/hive/docs/:id', (req: Request, res: Response) => {
  const docs = readJSON(DOCS_FILE);
  const idx = docs.findIndex((d: any) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Document not found' });

  docs[idx] = { ...docs[idx], ...req.body, updated_at: new Date().toISOString() };
  writeJSON(DOCS_FILE, docs);
  appendAudit('UPDATE', 'doc', req.params.id, req.body._agent || 'system');
  eventBus.emit('doc:updated', docs[idx]);
  res.json(docs[idx]);
});

// DELETE doc
apiRouter.delete('/hive/docs/:id', (req: Request, res: Response) => {
  let docs = readJSON(DOCS_FILE);
  const idx = docs.findIndex((d: any) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Document not found' });
  const removed = docs.splice(idx, 1)[0];
  writeJSON(DOCS_FILE, docs);
  appendAudit('DELETE', 'doc', req.params.id, req.body?._agent || 'system');
  eventBus.emit('doc:deleted', removed);
  res.json({ deleted: true, id: req.params.id });
});

// ========================
// AUDIT LOG
// ========================
apiRouter.get('/audit', (_req: Request, res: Response) => {
  res.json(readJSON(AUDIT_LOG));
});

// ========================
// SYSTEM STATS
// ========================
apiRouter.get('/stats', (_req: Request, res: Response) => {
  const issues = readJSON(ISSUES_FILE);
  const docs = readJSON(DOCS_FILE);
  res.json({
    sentinel_track: {
      total_issues: issues.length,
      by_status: issues.reduce((acc: any, i: any) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {}),
      by_type: issues.reduce((acc: any, i: any) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {}),
    },
    scholar_hive: {
      total_docs: docs.length,
      by_type: docs.reduce((acc: any, d: any) => { acc[d.document_type] = (acc[d.document_type] || 0) + 1; return acc; }, {}),
      vectorized: docs.filter((d: any) => d.vector_reference).length,
    },
    uptime: process.uptime(),
  });
});

// ========================
// CONTENT FOUNDRY ROUTES
// ========================
const MEDIA_ASSETS_FILE = path.join(DATA_DIR, 'media_assets.json');
const TRANSCRIPTS_FILE = path.join(DATA_DIR, 'transcripts.json');

apiRouter.get('/media/assets', (_req: Request, res: Response) => {
  res.json(readJSON(MEDIA_ASSETS_FILE));
});

apiRouter.get('/media/transcripts', (_req: Request, res: Response) => {
  res.json(readJSON(TRANSCRIPTS_FILE));
});

apiRouter.put('/media/transcripts', (req: Request, res: Response) => {
  try {
    writeJSON(TRANSCRIPTS_FILE, req.body);
    appendAudit('UPDATE', 'transcripts', 'bulk', req.body._agent || 'user', { count: req.body.length });
    res.json({ status: 'saved', count: req.body.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// NAS directory browsing â€” serves real folder structure from mounted volumes
const VAULT_ROOT = process.env.VAULT_ROOT || '/vault';
apiRouter.get('/media/browse', (req: Request, res: Response) => {
  const subpath = (req.query.path as string) || '';
  const fullPath = path.join(VAULT_ROOT, subpath);
  
  // Security: prevent directory traversal
  if (!fullPath.startsWith(VAULT_ROOT)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Path not found', path: subpath });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      return res.sendFile(fullPath);
    }

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const items = entries
      .filter(e => !e.name.startsWith('.') && !e.name.startsWith('@') && !e.name.startsWith('#'))
      .map(e => {
        const itemPath = path.join(fullPath, e.name);
        const stat = fs.statSync(itemPath);
        return {
          name: e.name,
          type: e.isDirectory() ? 'folder' : 'file',
          size: e.isFile() ? stat.size : undefined,
          modified: stat.mtime.toISOString(),
          path: path.join(subpath, e.name).replace(/\\/g, '/'),
          extension: e.isFile() ? path.extname(e.name).toLowerCase() : undefined,
        };
      })
      .sort((a, b) => {
        // Folders first, then files
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    res.json({ path: subpath || '/', items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PUBLISH_FILE = path.join(DATA_DIR, 'publish.json');

apiRouter.get('/media/publish', (_req: Request, res: Response) => {
  let publishData = readJSON(PUBLISH_FILE);
  // Seed initial data if empty or array (since readJSON catches errors and returns [])
  if (!publishData || Array.isArray(publishData) && publishData.length === 0) {
    publishData = {
      pipelines: [
        { id: 'p1', name: 'Foundry_A_Master_V2', specs: '4K UHD | HEVC | 60 FPS', eta: '04:12', progress: 78 },
        { id: 'p2', name: 'Foundry_A_TikTok_Cut', specs: '1080p | Vertical | H.264', eta: '01:45', progress: 45 }
      ],
      metadata: {
        title: "The Future of AI Orchestration in Cinema",
        description: "Deep dive into the Media Orchestrator pipeline. We explore how generative agents are redefining post-production workflows...",
        tags: ["#AI_Cinema", "#FutureTech", "#Foundry"]
      },
      channels: [
        { id: 'yt', icon: 'smart_display', name: 'YouTube', desc: '4K Master Delivery', color: 'text-red-500', bg: 'bg-red-600/10', active: true },
        { id: 'tt', icon: 'bolt', name: 'TikTok', desc: 'Vertical Optimized', color: 'text-white', bg: 'bg-white/10', active: true },
        { id: 'ig', icon: 'photo_camera', name: 'Instagram', desc: 'Reels & Feed', color: 'text-pink-500', bg: 'bg-pink-600/10', active: false },
        { id: 'tw', icon: 'dynamic_feed', name: 'X / Twitter', desc: 'Native HD Video', color: 'text-blue-400', bg: 'bg-blue-600/10', active: true },
        { id: 'fb', icon: 'auto_stories', name: 'Flipboard', desc: 'Magazine Delivery', color: 'text-red-700', bg: 'bg-red-600/10', active: false }
      ],
      stats: {
        totalUpload: "14.2 GB"
      }
    } as any;
    writeJSON(PUBLISH_FILE, publishData as any);
  }
  res.json(publishData);
});

apiRouter.post('/media/publish/initiate', (req: Request, res: Response) => {
  const payload = req.body;
  appendAudit('PUBLISH_SEQUENCE', 'media', payload.title || 'Unknown', req.body._agent || 'system', payload);
  eventBus.emit('media:publish', payload);
  res.json({ status: 'initiated', timestamp: new Date().toISOString() });
});

