import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { loadAllManifests, updateManifest, JobManifest } from './job-registry.js';
import { extractArticleText } from './article-extractor.js';
import { writeObsidianNote, writeSentinelDashboard } from './obsidian-writer.js';
import { applyCrossReferences } from './cross-reference.js';

const TARGET_JOB_IDS = [
    'IE-IDX-0379',
    'IE-IDX-0380',
    'IE-IDX-0381',
    'IE-IDX-0382',
    'IE-IDX-0383',
    'IE-IDX-0384',
    'IE-IDX-0385',
    'IE-IDX-0386',
    'IE-IDX-0387'
];

async function callCle_CorePlan(topic: string, context: string, sessionId: string) {
    const url = `${CONFIG.genkitBaseUrl}/cle_core/plan`;
    console.log(`[SCRATCH-PLAN] Calling /cle_core/plan for topic: ${topic.slice(0, 50)}...`);
    const apiKey = process.env.GENKIT_API_KEY || 'v6-local-key';
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            topic,
            context,
            depth: 'exhaustive',
            sessionId
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
    }

    return await res.json() as any;
}

async function registerTaskOnDispatch(manifest: JobManifest) {
    const url = 'http://122.0.3.1:5160/api/tasks'; // Live dispatch server URL
    
    // Auto-detect workstream based on categories
    let workstream = 'free';
    if (manifest.categories.includes('infrastructure') || manifest.categories.includes('sovereignty')) {
        workstream = 'infra-docker';
    } else if (manifest.categories.includes('agent')) {
        workstream = 'genkit-flows';
    } else if (manifest.categories.includes('creative-tools') || manifest.categories.includes('spatial')) {
        workstream = 'console-ui';
    }

    const payload = {
        title: `Plan & implement task derived from ${manifest.jobId}: ${manifest.sourceArticle.title}`,
        workstream,
        priority: 'P2',
        added_by: 'Sentinel Planner',
        status: 'queued',
        payload: {
            jobId: manifest.jobId,
            title: manifest.sourceArticle.title,
            directive: manifest.athenaOutput?.directive || '',
            suggestedAgents: manifest.athenaOutput?.suggestedAgents || []
        }
    };

    console.log(`[SCRATCH-PLAN] Queueing task on dispatch server for ${manifest.jobId}...`);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const text = await res.text();
        console.warn(`[SCRATCH-PLAN] ⚠️ Failed to register task on dispatch: ${text}`);
    } else {
        const data = await res.json();
        console.log(`[SCRATCH-PLAN] ✅ Registered dispatch task. Task ID: ${data.id || data.taskId}`);
    }
}

async function main() {
    const manifests = loadAllManifests();
    console.log(`[SCRATCH-PLAN] Loaded ${manifests.length} manifests.`);

    for (const manifest of manifests) {
        if (!TARGET_JOB_IDS.includes(manifest.jobId)) {
            continue;
        }

        console.log(`\n========================================`);
        console.log(`[SCRATCH-PLAN] Processing ${manifest.jobId}: ${manifest.sourceArticle.title}`);
        console.log(`========================================`);

        try {
            // Step 1: Extract full article text as context
            console.log(`[SCRATCH-PLAN] Extracting text for ${manifest.jobId}...`);
            const fullText = await extractArticleText(manifest.sourceArticle.url, manifest.sourceArticle.title);
            console.log(`[SCRATCH-PLAN] Extracted ${fullText.length} chars.`);

            // Step 2: Call Genkit Plan Flow
            const planResult = await callCle_CorePlan(
                manifest.sourceArticle.title,
                `URL: ${manifest.sourceArticle.url}\n\nArticle Text:\n${fullText}`,
                `sentinel_plan_${manifest.jobId}`
            );

            console.log(`[SCRATCH-PLAN] Plan response received. planApproved: ${planResult.planApproved}`);

            // Step 3: Populate manifest properties
            manifest.status = 'PLANNED';
            manifest.activatedAt = new Date().toISOString();
            manifest.athenaOutput = {
                directive: planResult.athena?.directive || '',
                rationale: planResult.athena?.rationale || '',
                options: planResult.athena?.options || [],
                suggestedAgents: planResult.athena?.suggestedAgents || [],
                nextMode: planResult.athena?.nextMode || 'SHIP',
                constitutionalFlags: planResult.athena?.constitutionalFlags || []
            };

            // Inject custom VERA validation field into JSON manifest
            (manifest as any).veraOutput = {
                verdict: planResult.vera?.verdict || '',
                confidence: planResult.vera?.confidence || 0,
                contradictions: planResult.vera?.contradictions || [],
                pattern: planResult.vera?.pattern || ''
            };

            // Save updated manifest JSON
            updateManifest(manifest);
            console.log(`[SCRATCH-PLAN] Manifest JSON updated.`);

            // Step 4: Write Obsidian Note with specs & VERA validation
            const crossRefs = applyCrossReferences(manifest);
            writeObsidianNote(manifest, crossRefs);
            console.log(`[SCRATCH-PLAN] Obsidian Note updated.`);

            // Step 5: Queue Task in V6 Dispatch Server
            await registerTaskOnDispatch(manifest);

        } catch (err: any) {
            console.error(`[SCRATCH-PLAN] ❌ Error processing ${manifest.jobId}: ${err.message}`);
            console.error(err.stack);
        }
        
        // Cooldown between requests
        console.log(`[SCRATCH-PLAN] Cooling down 2s...`);
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`\n[SCRATCH-PLAN] Rebuilding Sentinel Dashboard...`);
    writeSentinelDashboard();
    console.log(`[SCRATCH-PLAN] Done.`);
}

main().catch(err => {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
});
