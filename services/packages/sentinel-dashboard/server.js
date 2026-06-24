const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4200;
const QUEUE_DIR = process.env.QUEUE_DIR || path.join(__dirname, '../../../runtime/ideation-queue');
const REGISTRY_PATH = process.env.REGISTRY_PATH || path.join(__dirname, '../../../runtime/registry/ideations.canonical.json');
const RAG_DIR = process.env.RAG_DIR || path.join(__dirname, '../../../runtime/rag');
const GENKIT_URL = process.env.GENKIT_BASE_URL || 'http://127.0.0.1:4110';
const GENKIT_KEY = process.env.GENKIT_API_KEY || 'v6-nas-key';
const CORTEX_CDP = process.env.CORTEX_CDP_URL || 'http://127.0.0.1:9222';

// V2 Lifecycle statuses
const V2_STATUSES = [
  'INGESTED', 'BRAINSTORM', 'IDEATED', 'REVIEWED',
  'ACTIVATED', 'IN_PROGRESS', 'SHIPPED', 'VALIDATED', 'COMPLETED',
  'PARKED', 'ARCHIVED', 'DISCARDED'
];

const ACTIVE_STATUSES = ['INGESTED', 'BRAINSTORM', 'IDEATED', 'REVIEWED', 'ACTIVATED', 'IN_PROGRESS', 'SHIPPED', 'VALIDATED'];
const TERMINAL_STATUSES = ['COMPLETED', 'PARKED', 'ARCHIVED', 'DISCARDED'];

// ── Helpers ──
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

// ── V2 Registry Reader (primary data source) ──
let registryCache = null;
let registryCacheTime = 0;
const CACHE_TTL = 10000; // 10s

function readRegistry() {
  const now = Date.now();
  if (registryCache && (now - registryCacheTime) < CACHE_TTL) return registryCache;

  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    registryCache = JSON.parse(raw);
    registryCacheTime = now;
    return registryCache;
  } catch (e) {
    console.warn('[REGISTRY] Cannot read V2 registry, falling back to queue dir:', e.message);
    return buildRegistryFromQueue();
  }
}

// ── Fallback: build registry from individual V1/V2 files ──
function buildRegistryFromQueue() {
  try {
    const files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json'));
    const ideations = files.map(f => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, f), 'utf8'));
        return normalizeToV2(raw);
      } catch { return null; }
    }).filter(Boolean).sort((a, b) => {
      const numA = parseInt((a.id || '').replace(/\D/g, '')) || 0;
      const numB = parseInt((b.id || '').replace(/\D/g, '')) || 0;
      return numB - numA;
    });

    return { version: '2.0.0-fallback', ideations, stats: buildStatsFromArray(ideations) };
  } catch { return { version: '2.0.0-empty', ideations: [], stats: {} }; }
}

// ── Normalize V1 manifest to V2 registry entry ──
function normalizeToV2(m) {
  // Already V2
  if (m.version === 2 || m.id?.startsWith('IE-IDX-')) {
    return {
      id: m.id,
      slug: m.slug,
      status: m.status || 'BRAINSTORM',
      title: m.source?.title || m.title || m.slug,
      directive: m.athena?.directive || m.directive || '',
      sourceType: m.source?.type || 'unknown',
      sourceUrl: m.source?.url || '',
      categories: m.classification?.categories || [],
      tags: m.classification?.tags || [],
      domain: m.classification?.domain || 'uncategorized',
      relevance: m.classification?.cleRelevance || 0,
      urgency: m.classification?.urgency || 'low',
      priority: m.priority || 3,
      owner: m.lifecycle?.owner || null,
      createdAt: m.timestamps?.createdAt || m.createdAt,
      ideatedAt: m.timestamps?.ideatedAt || m.ideatedAt,
      reviewedAt: m.timestamps?.reviewedAt || null,
      activatedAt: m.timestamps?.activatedAt || m.activatedAt,
      completedAt: m.timestamps?.completedAt || m.completedAt,
      heritageSource: m.heritage?.source || null,
    };
  }

  // V1 format
  const statusMap = {
    'PENDING': 'BRAINSTORM', 'IDEATED': 'IDEATED', 'APPROVED': 'ACTIVATED',
    'ARCHIVED': 'ARCHIVED', 'FLAGGED': 'PARKED', 'RESEARCH': 'ACTIVATED',
    'COMPLETED': 'COMPLETED', 'FAILED': 'DISCARDED',
  };

  return {
    id: m.jobId || m.id,
    slug: m.slug || '',
    status: statusMap[m.status] || 'BRAINSTORM',
    title: m.sourceArticle?.title || m.title || m.slug || 'Untitled',
    directive: m.athenaOutput?.directive || '',
    sourceType: 'flipboard_rss',
    sourceUrl: m.sourceArticle?.url || '',
    categories: m.categories || [],
    tags: [],
    domain: guessDomain(m.categories || []),
    relevance: m.cleRelevance || 0,
    urgency: (m.cleRelevance || 0) >= 90 ? 'critical' : (m.cleRelevance || 0) >= 70 ? 'high' : 'low',
    priority: 3,
    owner: null,
    createdAt: m.createdAt,
    ideatedAt: m.ideatedAt,
    activatedAt: m.activatedAt,
    completedAt: m.completedAt,
    heritageSource: null,
  };
}

function guessDomain(categories) {
  const cat = (categories || []).join(' ').toLowerCase();
  if (cat.includes('infra') || cat.includes('devops') || cat.includes('docker')) return 'infrastructure';
  if (cat.includes('business') || cat.includes('market')) return 'business';
  if (cat.includes('creative') || cat.includes('art') || cat.includes('music')) return 'creative';
  if (cat.includes('security') || cat.includes('crypto')) return 'security';
  if (cat.includes('research') || cat.includes('ai') || cat.includes('ml')) return 'research';
  return 'operations';
}

// ── Stats builder ──
function buildStatsFromArray(ideations) {
  const byStatus = {};
  const byDomain = {};
  const bySource = {};
  let totalRelevance = 0;

  ideations.forEach(i => {
    byStatus[i.status] = (byStatus[i.status] || 0) + 1;
    byDomain[i.domain] = (byDomain[i.domain] || 0) + 1;
    const src = i.heritageSource || i.sourceType || 'unknown';
    bySource[src] = (bySource[src] || 0) + 1;
    totalRelevance += (i.relevance || 0);
  });

  return {
    total: ideations.length,
    byStatus, byDomain, bySource,
    avgRelevance: ideations.length ? Math.round(totalRelevance / ideations.length) : 0,
    needsReview: ideations.filter(i => i.status === 'IDEATED').length,
    active: ideations.filter(i => ACTIVE_STATUSES.includes(i.status)).length,
    terminal: ideations.filter(i => TERMINAL_STATUSES.includes(i.status)).length,
  };
}

// ── API: Get stats ──
function getStats() {
  const reg = readRegistry();
  if (reg.stats) return reg.stats;
  return buildStatsFromArray(reg.ideations || []);
}

// ── API: Get ideations with filters ──
function getIdeations(query) {
  const reg = readRegistry();
  let items = reg.ideations || [];

  // Status filter
  if (query.status) {
    items = items.filter(i => i.status === query.status.toUpperCase());
  }

  // Domain filter
  if (query.domain) {
    items = items.filter(i => i.domain === query.domain);
  }

  // Source filter
  if (query.source) {
    if (query.source === 'sentinel') {
      items = items.filter(i => !i.heritageSource && (i.sourceType === 'flipboard_rss' || i.sourceType === 'unknown'));
    } else if (query.source === 'heritage') {
      items = items.filter(i => !!i.heritageSource);
    }
  }

  // Search
  if (query.q) {
    const q = query.q.toLowerCase();
    items = items.filter(i =>
      (i.title || '').toLowerCase().includes(q) ||
      (i.directive || '').toLowerCase().includes(q) ||
      (i.id || '').toLowerCase().includes(q)
    );
  }

  // Sort
  const sort = query.sort || 'newest';
  items.sort((a, b) => {
    if (sort === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    if (sort === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    if (sort === 'relevance') return (b.relevance || 0) - (a.relevance || 0);
    if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
    if (sort === 'priority') return (a.priority || 3) - (b.priority || 3);
    return 0;
  });

  // Pagination
  const limit = parseInt(query.limit) || 50;
  const offset = parseInt(query.offset) || 0;
  const total = items.length;
  items = items.slice(offset, offset + limit);

  return { items, total, limit, offset };
}

// ── API: Get single ideation ──
function getIdeation(id) {
  // Try individual file first for full data
  try {
    const files = fs.readdirSync(QUEUE_DIR).filter(f => f.startsWith(id) && f.endsWith('.json'));
    if (files.length > 0) {
      const raw = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, files[0]), 'utf8'));
      return raw.version === 2 ? raw : normalizeToV2(raw);
    }
  } catch { /* fall through to registry */ }

  // Fallback to registry entry
  const reg = readRegistry();
  return (reg.ideations || []).find(i => i.id === id) || null;
}

// ── API: Transition status ──
function transitionStatus(id, newStatus, reason, operator) {
  if (!V2_STATUSES.includes(newStatus)) return { error: `Invalid status: ${newStatus}` };

  // Find and update the individual file
  try {
    const files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json'));
    const file = files.find(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, f), 'utf8'));
        return data.id === id || data.jobId === id;
      } catch { return false; }
    });

    if (!file) return { error: 'Ideation not found' };

    const filePath = path.join(QUEUE_DIR, file);
    const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const oldStatus = manifest.status;
    manifest.status = newStatus;

    // Update timestamps
    const now = new Date().toISOString();
    if (manifest.version === 2) {
      if (!manifest.lifecycle) manifest.lifecycle = {};
      if (!manifest.lifecycle.transitions) manifest.lifecycle.transitions = [];
      manifest.lifecycle.transitions.push({
        from: oldStatus, to: newStatus, at: now, by: operator || 'operator', reason: reason || ''
      });

      if (!manifest.timestamps) manifest.timestamps = {};
      if (newStatus === 'REVIEWED') manifest.timestamps.reviewedAt = now;
      if (newStatus === 'ACTIVATED') manifest.timestamps.activatedAt = now;
      if (newStatus === 'COMPLETED') manifest.timestamps.completedAt = now;
    } else {
      // V1 compat
      if (newStatus === 'ACTIVATED') manifest.activatedAt = now;
      if (newStatus === 'COMPLETED') manifest.completedAt = now;
    }

    fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2));

    // Invalidate registry cache
    registryCache = null;

    return { ok: true, id, from: oldStatus, to: newStatus, at: now };
  } catch (e) {
    return { error: e.message };
  }
}

// ── API: Submit review verdict ──
function submitReview(id, verdict, notes, operator) {
  const verdictStatusMap = {
    'activate_now': 'ACTIVATED',
    'still_relevant': null, // Keep current status
    'needs_update': 'BRAINSTORM',
    'superseded': 'ARCHIVED',
    'deprioritized': 'PARKED',
    'discard': 'DISCARDED',
  };

  if (!verdictStatusMap.hasOwnProperty(verdict)) return { error: `Invalid verdict: ${verdict}` };

  const newStatus = verdictStatusMap[verdict];

  // Find and update
  try {
    const files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json'));
    const file = files.find(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, f), 'utf8'));
        return data.id === id || data.jobId === id;
      } catch { return false; }
    });

    if (!file) return { error: 'Ideation not found' };

    const filePath = path.join(QUEUE_DIR, file);
    const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const now = new Date().toISOString();

    // Record review
    if (manifest.version === 2) {
      if (!manifest.review) manifest.review = {};
      manifest.review.lastReviewedAt = now;
      manifest.review.lastVerdict = verdict;
      manifest.review.reviewCount = (manifest.review.reviewCount || 0) + 1;
      manifest.review.nextReviewDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      if (!manifest.lifecycle) manifest.lifecycle = {};
      if (!manifest.lifecycle.notes) manifest.lifecycle.notes = [];
      if (notes) {
        manifest.lifecycle.notes.push({ text: notes, at: now, by: operator || 'operator', type: 'review' });
      }
    }

    // Transition if verdict maps to a new status
    if (newStatus && manifest.status !== newStatus) {
      const oldStatus = manifest.status;
      manifest.status = newStatus;

      if (manifest.version === 2) {
        if (!manifest.lifecycle.transitions) manifest.lifecycle.transitions = [];
        manifest.lifecycle.transitions.push({
          from: oldStatus, to: newStatus, at: now, by: operator || 'operator',
          reason: `Review verdict: ${verdict}${notes ? ' — ' + notes : ''}`
        });
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2));
    registryCache = null;

    return { ok: true, id, verdict, newStatus: newStatus || manifest.status, at: now };
  } catch (e) {
    return { error: e.message };
  }
}

// ── API: Star/unstar ──
function toggleStar(id) {
  try {
    const files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json'));
    const file = files.find(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, f), 'utf8'));
        return data.id === id || data.jobId === id;
      } catch { return false; }
    });

    if (!file) return { error: 'Not found' };
    const filePath = path.join(QUEUE_DIR, file);
    const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    manifest.starred = !manifest.starred;
    fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2));
    registryCache = null;
    return { ok: true, starred: manifest.starred };
  } catch (e) {
    return { error: e.message };
  }
}

// ── Chat proxy to Genkit ──
async function proxyChat(message, contextId) {
  const ideation = contextId ? getIdeation(contextId) : null;

  const prompt = `You are ATHENA, the strategic intelligence layer of the Creative Liberation Engine.
${ideation ? `Context: Ideation ${ideation.id} — "${ideation.title}"
Status: ${ideation.status} | Domain: ${ideation.domain} | Relevance: ${ideation.relevance}/100
Directive: ${ideation.directive || 'N/A'}` : 'No specific ideation context.'}

USER: ${message}

Respond as ATHENA with strategic, actionable guidance. Be concise but thorough.`;

  try {
    const url = `${GENKIT_URL}/sentinel/ideate`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': GENKIT_KEY },
      body: JSON.stringify({ topic: ideation?.title || 'General inquiry', context: prompt }),
    });
    if (!resp.ok) throw new Error(`Genkit ${resp.status}`);
    const data = await resp.json();
    return { reply: data.directive || data.rationale || JSON.stringify(data).substring(0, 2000) };
  } catch (e) {
    return { reply: `[ATHENA offline: ${e.message}] — Genkit endpoint unreachable.` };
  }
}

// ── Scholar Hive data builder ──
function buildScholarHive() {
  const hive = { transcripts: [], airtable: { realms: [], totalTemplates: 0 }, cortexBrowser: CORTEX_CDP };

  try {
    const transcriptDir = path.join(RAG_DIR, 'academy', 'udemy', 'transcripts');
    const dirs = fs.readdirSync(transcriptDir, { withFileTypes: true }).filter(d => d.isDirectory());
    hive.transcripts = dirs.map(d => {
      const courseDir = path.join(transcriptDir, d.name);
      const files = fs.readdirSync(courseDir).filter(f => f.endsWith('.json') || f.endsWith('.txt') || f.endsWith('.md'));
      return { slug: d.name, files: files.length, hasContent: files.length > 0 };
    });
  } catch (e) { hive.transcriptError = e.message; }

  try {
    const academyDir = path.join(RAG_DIR, 'academy', 'udemy');
    const courseJsons = fs.readdirSync(academyDir).filter(f => f.endsWith('.json'));
    hive.courseManifests = courseJsons.length;
  } catch { hive.courseManifests = 0; }

  try {
    const airtableDir = path.join(RAG_DIR, 'academy', 'airtable');
    const files = fs.readdirSync(airtableDir).filter(f => f.endsWith('.json'));
    files.forEach(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(airtableDir, f), 'utf8'));
        const count = Array.isArray(data) ? data.length : (data.templates?.length || 0);
        hive.airtable.realms.push({ name: f.replace('.json', ''), count });
        hive.airtable.totalTemplates += count;
      } catch { /* skip corrupt */ }
    });
  } catch (e) { hive.airtableError = e.message; }

  return hive;
}

// ── Parse query string ──
function parseQuery(url) {
  const q = {};
  const idx = url.indexOf('?');
  if (idx === -1) return q;
  url.substring(idx + 1).split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    q[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  return q;
}

// ── Router ──
async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const urlPath = req.url.split('?')[0];
  const query = parseQuery(req.url);

  // ── V2 Ideation Lifecycle API ──

  if (urlPath === '/api/stats' && req.method === 'GET') {
    return json(res, getStats());
  }

  if (urlPath === '/api/ideations' && req.method === 'GET') {
    return json(res, getIdeations(query));
  }

  if (urlPath.startsWith('/api/ideations/') && req.method === 'GET') {
    const id = urlPath.split('/api/ideations/')[1].split('/')[0];

    // /api/ideations/:id/timeline
    if (urlPath.endsWith('/timeline')) {
      const ideation = getIdeation(id);
      if (!ideation) return json(res, { error: 'Not found' }, 404);
      return json(res, { transitions: ideation.lifecycle?.transitions || [] });
    }

    const ideation = getIdeation(id);
    return ideation ? json(res, ideation) : json(res, { error: 'Not found' }, 404);
  }

  if (urlPath === '/api/ideations/search' && req.method === 'GET') {
    return json(res, getIdeations(query));
  }

  // Status transition
  if (urlPath.match(/^\/api\/ideations\/[^/]+\/status$/) && req.method === 'PATCH') {
    const id = urlPath.split('/')[3];
    const body = await readBody(req);
    return json(res, transitionStatus(id, body.status, body.reason, body.operator));
  }

  // Review verdict
  if (urlPath.match(/^\/api\/ideations\/[^/]+\/review$/) && req.method === 'PATCH') {
    const id = urlPath.split('/')[3];
    const body = await readBody(req);
    return json(res, submitReview(id, body.verdict, body.notes, body.operator));
  }

  // Star toggle
  if (urlPath.match(/^\/api\/ideations\/[^/]+\/star$/) && req.method === 'POST') {
    const id = urlPath.split('/')[3];
    return json(res, toggleStar(id));
  }

  // ── Legacy compat endpoints ──
  if (urlPath === '/api/manifests') {
    const reg = readRegistry();
    return json(res, (reg.ideations || []).map(i => ({
      ...i,
      // Legacy field mapping for old clients
      jobId: i.id, date: i.createdAt, category: i.domain,
      summary: i.directive, source: i.heritageSource ? 'heritage' : 'sentinel',
    })));
  }

  if (urlPath === '/api/action' && req.method === 'POST') {
    const body = await readBody(req);
    const actionStatusMap = {
      'approve': 'ACTIVATED', 'archive': 'ARCHIVED', 'flag': 'PARKED',
      'review': 'REVIEWED', 'star': null
    };
    if (body.action === 'star') return json(res, toggleStar(body.id || body.jobId));
    const newStatus = actionStatusMap[body.action];
    if (newStatus) return json(res, transitionStatus(body.id || body.jobId, newStatus, body.reason, 'operator'));
    return json(res, { error: 'Unknown action' }, 400);
  }

  // ── Chat ──
  if (urlPath === '/api/chat' && req.method === 'POST') {
    const body = await readBody(req);
    return json(res, await proxyChat(body.message, body.contextId));
  }

  // ── Health ──
  if (urlPath === '/api/health') {
    const reg = readRegistry();
    return json(res, {
      status: 'ok', version: '2.0.0', uptime: process.uptime(),
      ideations: (reg.ideations || []).length,
      registryVersion: reg.version || 'unknown',
    });
  }

  // ── Scholar Hive ──
  if (urlPath === '/api/scholar-hive') return json(res, buildScholarHive());
  if (urlPath === '/api/cortex-status') {
    try {
      const resp = await fetch(`${CORTEX_CDP}/json/version`, { signal: AbortSignal.timeout(3000) });
      const data = await resp.json();
      return json(res, { status: 'online', browser: data.Browser || 'Chromium', wsUrl: data.webSocketDebuggerUrl || null });
    } catch (e) {
      return json(res, { status: 'offline', error: e.message });
    }
  }

  // ── Static files ──
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(__dirname, 'public', filePath);
  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2', '.ico': 'image/x-icon'
  };

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

http.createServer(handleRequest).listen(PORT, () => {
  const reg = readRegistry();
  const count = (reg.ideations || []).length;
  console.log(`[SENTINEL-COMMAND] V2 Lifecycle Server live at http://0.0.0.0:${PORT}`);
  console.log(`[SENTINEL-COMMAND] Registry: ${REGISTRY_PATH} (${count} ideations, v${reg.version || '?'})`);
  console.log(`[SENTINEL-COMMAND] Queue fallback: ${QUEUE_DIR}`);
  console.log(`[SENTINEL-COMMAND] Genkit: ${GENKIT_URL}`);
  console.log(`[SENTINEL-COMMAND] CORTEX: ${CORTEX_CDP}`);
});
