/**
 * Flipboard Sentinel â€” Job Registry
 * Manages job numbering (IE-IDX-NNNN), manifest persistence, and state tracking.
 * All state persisted to NAS for sovereignty.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
// â”€â”€â”€ V2 Schema Normalization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Normalize a V2 ideation registry manifest into V1 Sentinel format.
 * V2 uses: id, source, classification, athena
 * V1 uses: jobId, sourceArticle, categories, athenaOutput
 */
function normalizeManifest(raw) {
    // Silently skip non-ideation documents (heartbeat manifests, HRT records, etc.)
    const id = raw.id || raw.jobId || '';
    if (id.startsWith('IE-HRT-') || id.startsWith('IE-SYS-') || id.startsWith('IE-BEAT-')) {
        return null;
    }
    // Already V1 format
    if (raw.sourceArticle && raw.jobId)
        return raw;
    // V2 format detection
    if (raw.version === 2 || (raw.source && raw.id)) {
        const src = raw.source || {};
        const cls = raw.classification || {};
        const ath = raw.athena || null;
        const manifest = {
            jobId: raw.id || '',
            jobNumber: parseInt((raw.id || '').replace(/\D/g, ''), 10) || 0,
            slug: raw.slug || '',
            filename: `${raw.id}_${raw.slug || 'unknown'}`,
            status: raw.status || 'PENDING',
            sourceArticle: {
                guid: src.guid || '',
                title: src.title || 'Untitled',
                url: src.url || '',
                author: src.author || 'Unknown',
                pubDate: src.publishedAt || src.pubDate || '',
                imageUrl: src.imageUrl || null,
                categories: cls.categories || [],
            },
            categories: (cls.categories || []).filter(Boolean),
            inceptionRelevance: cls.inceptionRelevance ?? 0,
            athenaOutput: ath ? {
                directive: ath.directive || '',
                rationale: ath.rationale || '',
                options: (ath.options || []).filter((o) => o && typeof o === 'object'),
                suggestedAgents: ath.suggestedAgents || [],
                nextMode: ath.nextMode || 'PLAN',
                constitutionalFlags: ath.constitutionalFlags || [],
            } : null,
            relatedJobs: raw.relatedJobs || [],
            obsidianPath: raw.obsidianPath || '',
            comments: raw.comments || [],
            createdAt: raw.createdAt || src.ingestedAt || '',
            ideatedAt: raw.ideatedAt || null,
            activatedAt: raw.activatedAt || null,
            completedAt: raw.completedAt || null,
            digestBatchId: raw.digestBatchId || null,
        };
        return manifest;
    }
    // Must have both sourceArticle AND a valid jobId to be considered a V1 ideation
    if (raw.sourceArticle?.title && raw.jobId?.startsWith('IE-IDX-'))
        return raw;
    // Anything else is an unknown format â€” warn and skip
    console.warn(`[SENTINEL] âš ï¸ Skipping unrecognized manifest format: ${JSON.stringify(raw).slice(0, 100)}`);
    return null;
}
// â”€â”€â”€ Slug Generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Generate a URL-safe coded description from an article title.
 * Max 40 chars, lowercase, hyphenated.
 */
export function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/['']/g, '') // Remove apostrophes
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-') // Spaces â†’ hyphens
        .replace(/-+/g, '-') // Collapse multiple hyphens
        .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
        .slice(0, 40) // Cap length
        .replace(/-$/, ''); // Trim trailing hyphen from slice
}
function readCounter() {
    try {
        if (fs.existsSync(CONFIG.counterFile)) {
            return JSON.parse(fs.readFileSync(CONFIG.counterFile, 'utf-8'));
        }
    }
    catch { /* Start fresh */ }
    return { lastJobNumber: 0, lastUpdated: new Date().toISOString() };
}
function writeCounter(state) {
    fs.mkdirSync(path.dirname(CONFIG.counterFile), { recursive: true });
    fs.writeFileSync(CONFIG.counterFile, JSON.stringify(state, null, 2));
}
/**
 * Atomically increment and return the next job number.
 */
export function nextJobNumber() {
    const state = readCounter();
    state.lastJobNumber += 1;
    state.lastUpdated = new Date().toISOString();
    writeCounter(state);
    return state.lastJobNumber;
}
/**
 * Format a job ID: IE-IDX-0042
 */
export function formatJobId(num) {
    return `IE-IDX-${String(num).padStart(4, '0')}`;
}
function readSeen() {
    try {
        if (fs.existsSync(CONFIG.seenFile)) {
            return JSON.parse(fs.readFileSync(CONFIG.seenFile, 'utf-8'));
        }
    }
    catch { /* Start fresh */ }
    return { guids: [], lastPollAt: '', totalPolls: 0 };
}
function writeSeen(state) {
    fs.mkdirSync(path.dirname(CONFIG.seenFile), { recursive: true });
    fs.writeFileSync(CONFIG.seenFile, JSON.stringify(state, null, 2));
}
/**
 * Filter out articles we've already processed.
 * Updates the seen state with new GUIDs.
 */
export function filterNewArticles(articles) {
    const state = readSeen();
    const seenSet = new Set(state.guids);
    const newArticles = articles.filter(a => !seenSet.has(a.guid));
    if (newArticles.length > 0) {
        state.guids.push(...newArticles.map(a => a.guid));
        // Keep last 500 GUIDs to prevent unbounded growth
        if (state.guids.length > 500) {
            state.guids = state.guids.slice(-500);
        }
    }
    state.lastPollAt = new Date().toISOString();
    state.totalPolls += 1;
    writeSeen(state);
    return newArticles;
}
// â”€â”€â”€ Manifest Persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Create a new job manifest for an article.
 */
export function createManifest(article, categories, inceptionRelevance) {
    const num = nextJobNumber();
    const jobId = formatJobId(num);
    const slug = generateSlug(article.title);
    const filename = `${jobId}_${slug}`;
    const manifest = {
        jobId,
        jobNumber: num,
        slug,
        filename,
        status: 'PENDING',
        sourceArticle: article,
        categories,
        inceptionRelevance,
        athenaOutput: null,
        relatedJobs: [],
        obsidianPath: `${CONFIG.obsidianSentinelDir}\\${filename}.md`,
        comments: [],
        createdAt: new Date().toISOString(),
        ideatedAt: null,
        activatedAt: null,
        completedAt: null,
        digestBatchId: null,
    };
    return manifest;
}
/**
 * Save manifest to NAS.
 */
export function saveManifest(manifest) {
    const filePath = path.join(CONFIG.queueDir, `${manifest.filename}.json`);
    fs.mkdirSync(CONFIG.queueDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2));
    console.log(`[SENTINEL] ðŸ’¾ Manifest saved: ${manifest.filename}`);
}
/**
 * Load a manifest by job ID (e.g., "IE-IDX-0042").
 */
export function loadManifest(jobId) {
    const files = fs.readdirSync(CONFIG.queueDir);
    const match = files.find(f => f.startsWith(jobId));
    if (!match)
        return null;
    return JSON.parse(fs.readFileSync(path.join(CONFIG.queueDir, match), 'utf-8'));
}
/**
 * Load all manifests from the queue.
 */
export function loadAllManifests() {
    if (!fs.existsSync(CONFIG.queueDir))
        return [];
    const files = fs.readdirSync(CONFIG.queueDir).filter(f => f.endsWith('.json'));
    const manifests = [];
    for (const f of files) {
        try {
            const raw = JSON.parse(fs.readFileSync(path.join(CONFIG.queueDir, f), 'utf-8'));
            const normalized = normalizeManifest(raw);
            if (normalized)
                manifests.push(normalized);
        }
        catch (err) {
            console.warn(`[SENTINEL] âš ï¸ Failed to load manifest ${f}: ${err.message}`);
        }
    }
    return manifests;
}
/**
 * Update an existing manifest (e.g., add ATHENA output, change status).
 */
export function updateManifest(manifest) {
    saveManifest(manifest); // Overwrite in place
}
/**
 * Archive stale PENDING ideations older than CONFIG.staleAfterDays.
 */
export function sweepStaleIdeations() {
    const manifests = loadAllManifests();
    const now = Date.now();
    const maxAge = CONFIG.staleAfterDays * 24 * 60 * 60 * 1000;
    let archived = 0;
    for (const m of manifests) {
        if (m.status === 'PENDING' && (now - new Date(m.createdAt).getTime()) > maxAge) {
            m.status = 'ARCHIVED';
            updateManifest(m);
            archived++;
            console.log(`[SENTINEL] ðŸ—„ï¸ Archived stale job: ${m.jobId}`);
        }
    }
    return archived;
}
