/**
 * reprocess-override.ts
 * Manually overrides the titles and contents of the Twitter jobs that fell back
 * to "X - The Everything App" and executes full Athena ideation, Obsidian writing,
 * and email dispatch.
 * 
 * Usage: tsx src/reprocess-override.ts
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { loadManifest, updateManifest, generateSlug, JobManifest, SourceArticle } from './job-registry.js';
import { dispatchAthena } from './index.js';
import { applyCrossReferences } from './cross-reference.js';
import { writeObsidianNote, writeSentinelDashboard } from './obsidian-writer.js';
import { sendIdeationEmail } from './email-dispatcher.js';

interface OverrideData {
    title: string;
    author: string;
    url: string;
    text: string;
}

const OVERRIDES: Record<string, OverrideData> = {
    'IE-IDX-0303': {
        title: 'The 2-7 Problem: AI Limitations in Creative Quality',
        author: 'Emmett Shine (@emmettshine)',
        url: 'https://x.com/emmettshine/status/2054539694097015171?utm_source=flipboard&utm_content=jaharoni%2Fmagazine%2FAI',
        text: 'Emmett Shine (@emmettshine) presents the "2-7 problem" of AI-generated content on a quality scale of 1 to 10. AI easily raises the floor of creative quality to a competent, average, and forgettable middle ground (5), but is trapped within the 2-7 range. It is currently unable to produce either the characteristically human failures and flaws (1s) that make art memorable and interesting, or the truly transcendent, elite creative work (8-10). Because 7s are inexpensive and easy to generate, creators are tempted to settle for them, but true competitive advantage still lies at the edges (the 1s and the 9s/10s) which require human perspectives and intent.'
    }
};

async function main() {
    console.log(`[OVERRIDE] Starting manifest content overwrite and reprocessing...`);
    
    for (const [jobId, data] of Object.entries(OVERRIDES)) {
        console.log(`\n[OVERRIDE] ═══════════════════════════════════════════`);
        console.log(`[OVERRIDE] Processing Job ID: ${jobId}`);
        
        const manifest = loadManifest(jobId);
        if (!manifest) {
            console.error(`[OVERRIDE] ❌ Manifest not found for ${jobId}`);
            continue;
        }
        
        const oldFilename = manifest.filename;
        const oldObsidianPath = manifest.obsidianPath;
        
        console.log(`[OVERRIDE] Found old manifest: ${oldFilename}`);
        
        // 1. Apply overrides
        const slug = generateSlug(data.title);
        manifest.slug = slug;
        manifest.filename = `${jobId}_${slug}`;
        manifest.obsidianPath = `${CONFIG.obsidianSentinelDir}\\${manifest.filename}.md`;
        
        manifest.sourceArticle = {
            guid: manifest.sourceArticle.guid,
            title: data.title,
            url: data.url,
            author: data.author,
            pubDate: manifest.sourceArticle.pubDate,
            imageUrl: manifest.sourceArticle.imageUrl,
            categories: manifest.sourceArticle.categories
        };
        
        manifest.sourceType = 'twitter';
        manifest.cleRelevance = 100;
        
        // 2. Dispatch Athena
        console.log(`[OVERRIDE] Dispatching to ATHENA with custom text...`);
        const athenaResult = await dispatchAthena(manifest.sourceArticle, data.text, 'exhaustive');
        
        if (!athenaResult) {
            console.error(`[OVERRIDE] ❌ Athena returned null for ${jobId}. Aborting this job.`);
            continue;
        }
        
        manifest.athenaOutput = {
            directive: athenaResult.directive,
            rationale: athenaResult.rationale,
            options: athenaResult.options || [],
            suggestedAgents: athenaResult.suggestedAgents || [],
            nextMode: athenaResult.nextMode || 'PLAN',
            constitutionalFlags: athenaResult.constitutionalFlags || [],
        };
        
        manifest.status = 'IDEATED';
        manifest.ideatedAt = new Date().toISOString();
        
        // 3. Delete old manifest file and old Obsidian file if filename changed
        if (oldFilename !== manifest.filename) {
            const oldManifestPath = path.join(CONFIG.queueDir, `${oldFilename}.json`);
            if (fs.existsSync(oldManifestPath)) {
                fs.unlinkSync(oldManifestPath);
                console.log(`[OVERRIDE] Deleted old manifest: ${oldManifestPath}`);
            }
            if (oldObsidianPath && fs.existsSync(oldObsidianPath)) {
                fs.unlinkSync(oldObsidianPath);
                console.log(`[OVERRIDE] Deleted old Obsidian file: ${oldObsidianPath}`);
            }
        }
        
        // 4. Save manifest and generate artifacts
        updateManifest(manifest);
        console.log(`[OVERRIDE] Manifest updated successfully.`);
        
        const crossRefs = applyCrossReferences(manifest);
        
        console.log(`[OVERRIDE] Writing Obsidian note...`);
        writeObsidianNote(manifest, crossRefs);
        
        console.log(`[OVERRIDE] Sending ideation email...`);
        await sendIdeationEmail(manifest, crossRefs);
        
        console.log(`[OVERRIDE] ✅ ${jobId} reprocessed successfully!`);
    }
    
    console.log(`\n[OVERRIDE] Updating Sentinel Dashboard...`);
    writeSentinelDashboard();
    console.log(`[OVERRIDE] Dashboard updated. Reprocessing complete!`);
}

main().catch(err => {
    console.error(`[OVERRIDE] Fatal:`, err);
});
