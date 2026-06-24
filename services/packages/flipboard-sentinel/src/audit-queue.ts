/**
 * One-shot audit: Compare RSS feed articles against queue manifests.
 * Find any articles that are in the feed but missing from the queue,
 * or articles that were queued but never emailed.
 * 
 * Usage: tsx src/audit-queue.ts
 */

import 'dotenv/config';
import { CONFIG } from './config.js';
import { loadAllManifests } from './job-registry.js';
import fs from 'fs';
import path from 'path';

interface AuditResult {
    totalManifests: number;
    byStatus: Record<string, number>;
    totalSeenGuids: number;
    totalRssArticles: number;
    inRssNotSeen: string[];
    inSeenNoManifest: string[];
    pendingJobs: Array<{ jobId: string; title: string; status: string }>;
    noEmailJobs: Array<{ jobId: string; title: string; status: string; ideatedAt?: string }>;
    recentJobs: Array<{ jobId: string; title: string; status: string; createdAt?: string; emailedAt?: string }>;
}

async function main() {
    console.log(`[AUDIT] 🔍 Sentinel Queue Audit`);
    console.log(`[AUDIT] ════════════════════════════════════════════`);
    
    // 1. Load all manifests
    const manifests = loadAllManifests();
    console.log(`[AUDIT] 📦 Loaded ${manifests.length} manifests`);
    
    // 2. Count by status
    const byStatus: Record<string, number> = {};
    for (const m of manifests) {
        byStatus[m.status] = (byStatus[m.status] || 0) + 1;
    }
    console.log(`[AUDIT] 📊 Status breakdown:`);
    for (const [status, count] of Object.entries(byStatus).sort()) {
        console.log(`[AUDIT]    ${status}: ${count}`);
    }
    
    // 3. Load seen GUIDs
    const seenPath = path.resolve(CONFIG.queueDir, '../state/sentinel-seen.json');
    let seenGuids: string[] = [];
    try {
        const raw = fs.readFileSync(seenPath, 'utf-8');
        const parsed = JSON.parse(raw);
        seenGuids = parsed.guids || [];
    } catch (err) {
        console.error(`[AUDIT] ⚠️ Could not load seen state: ${err}`);
    }
    console.log(`[AUDIT] 👁️ Seen GUIDs: ${seenGuids.length}`);
    
    // 4. Fetch live RSS feed
    console.log(`[AUDIT] 📡 Fetching RSS feed: ${CONFIG.rssUrl}`);
    let rssArticles: Array<{ title: string; guid: string; link: string; pubDate: string }> = [];
    try {
        const resp = await fetch(CONFIG.rssUrl);
        const xml = await resp.text();
        
        // Simple XML parsing for items
        const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
        for (const item of items) {
            const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || 'untitled';
            const guid = item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim() || '';
            const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || '';
            const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || '';
            rssArticles.push({ title, guid, link, pubDate });
        }
    } catch (err) {
        console.error(`[AUDIT] ❌ Failed to fetch RSS: ${err}`);
    }
    console.log(`[AUDIT] 📰 Current RSS feed: ${rssArticles.length} articles`);
    
    // 5. Find articles in RSS but NOT in seen list
    const seenSet = new Set(seenGuids);
    const manifestGuidSet = new Set(manifests.map(m => m.sourceArticle?.guid).filter(Boolean));
    
    const inRssNotSeen = rssArticles.filter(a => !seenSet.has(a.guid));
    if (inRssNotSeen.length > 0) {
        console.log(`\n[AUDIT] ⚠️  MISSED ARTICLES (in RSS, not in seen-list): ${inRssNotSeen.length}`);
        for (const a of inRssNotSeen) {
            const inQueue = manifestGuidSet.has(a.guid) ? '✅ in queue' : '❌ NOT in queue';
            console.log(`[AUDIT]    • ${a.title}`);
            console.log(`[AUDIT]      GUID: ${a.guid}`);
            console.log(`[AUDIT]      ${inQueue}`);
            console.log(`[AUDIT]      Published: ${a.pubDate}`);
        }
    } else {
        console.log(`\n[AUDIT] ✅ All current RSS articles are in the seen-list`);
    }
    
    // 6. Find PENDING jobs
    const pendingJobs = manifests.filter(m => m.status === 'PENDING');
    if (pendingJobs.length > 0) {
        console.log(`\n[AUDIT] ⚠️  PENDING JOBS (not yet processed by ATHENA): ${pendingJobs.length}`);
        for (const m of pendingJobs) {
            console.log(`[AUDIT]    • ${m.jobId}: ${m.sourceArticle?.title || 'unknown'}`);
        }
    } else {
        console.log(`\n[AUDIT] ✅ No PENDING jobs — all have been processed`);
    }
    
    // 7. Find IDEATED jobs with no email
    const noEmailJobs = manifests.filter(m => 
        m.status === 'IDEATED' && !m.emailedAt
    );
    if (noEmailJobs.length > 0) {
        console.log(`\n[AUDIT] ⚠️  IDEATED BUT NO EMAIL: ${noEmailJobs.length}`);
        for (const m of noEmailJobs) {
            console.log(`[AUDIT]    • ${m.jobId}: ${m.sourceArticle?.title || 'unknown'}`);
            console.log(`[AUDIT]      Ideated: ${m.ideatedAt || 'unknown'}`);
        }
    } else {
        console.log(`\n[AUDIT] ✅ All IDEATED jobs have been emailed`);
    }
    
    // 8. Show the 15 most recent jobs
    const sorted = [...manifests].sort((a, b) => {
        const aTime = a.createdAt || a.ideatedAt || '';
        const bTime = b.createdAt || b.ideatedAt || '';
        return bTime.localeCompare(aTime);
    });
    
    console.log(`\n[AUDIT] 📋 15 Most Recent Jobs:`);
    console.log(`[AUDIT]    ${'ID'.padEnd(14)} | ${'Status'.padEnd(10)} | ${'Emailed?'.padEnd(10)} | Title`);
    console.log(`[AUDIT]    ${'-'.repeat(14)}-+-${'-'.repeat(10)}-+-${'-'.repeat(10)}-+-${'-'.repeat(40)}`);
    for (const m of sorted.slice(0, 15)) {
        const emailed = m.emailedAt ? '✅' : '❌';
        const title = (m.sourceArticle?.title || 'unknown').substring(0, 55);
        console.log(`[AUDIT]    ${m.jobId.padEnd(14)} | ${m.status.padEnd(10)} | ${emailed.padEnd(10)} | ${title}`);
    }
    
    // 9. Check how many GUIDs are in seen but have no corresponding manifest
    const seenNoManifest = seenGuids.filter(g => !manifestGuidSet.has(g));
    if (seenNoManifest.length > 0) {
        console.log(`\n[AUDIT] ℹ️  ${seenNoManifest.length} GUIDs in seen-list with no queue manifest (likely low-relevance/filtered)`);
    }
    
    console.log(`\n[AUDIT] ════════════════════════════════════════════`);
    console.log(`[AUDIT] 🏁 Audit complete`);
}

main().catch(err => {
    console.error(`[AUDIT] Fatal: ${err.message}`);
    process.exit(1);
});
