/**
 * Reprocess all DISCARDED ideation jobs using the upgraded ATHENAFlow.
 * Converts gatekept rejections into constructive active translation spikes,
 * updates manifests, updates Obsidian notes, and triggers ideation emails.
 *
 * Usage: tsx src/reprocess-all-discarded.ts
 */

import 'dotenv/config';
import { CONFIG } from './config.js';
import { loadAllManifests, updateManifest, JobManifest, SourceArticle } from './job-registry.js';
import { sendIdeationEmail } from './email-dispatcher.js';
import { applyCrossReferences } from './cross-reference.js';
import { extractArticleText } from './article-extractor.js';
import { writeObsidianNote, writeSentinelDashboard } from './obsidian-writer.js';

interface AthenaResponse {
    directive: string;
    rationale: string;
    options: any[];
    suggestedAgents: string[];
    nextMode: string;
    constitutionalFlags: string[];
}

async function dispatchAthena(
    article: SourceArticle,
    articleText: string,
    depth: 'surface' | 'deep' | 'exhaustive',
): Promise<AthenaResponse | null> {
    console.log(`[REPROCESS] 🧠 Dispatching ATHENA (${depth}) for: ${article.title}`);

    try {
        const apiKey = process.env.GENKIT_API_KEY || '';
        const response = await fetch(`${CONFIG.genkitBaseUrl}/sentinel/ideate`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                title: article.title,
                url: article.url,
                author: article.author,
                text: `Title: ${article.title}\nAuthor: ${article.author}\nURL: ${article.url}\nPublished: ${article.pubDate}\n\nFull Text:\n${articleText}`,
                depth,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[REPROCESS] ❌ ATHENA dispatch failed (${response.status}): ${errText}`);
            return null;
        }

        const result = await response.json() as any;
        return result.athena || result.output || result;
    } catch (err: any) {
        console.error(`[REPROCESS] ❌ ATHENA connection failed: ${err.message}`);
        return null;
    }
}

async function main() {
    const allManifests = loadAllManifests();
    console.log(`[REPROCESS] 📦 Loaded ${allManifests.length} total manifests`);

    // Filter only discarded manifests or those with gatekept/discard nextMode
    const discardedTargets = allManifests.filter(m => 
        m.status === 'DISCARDED' || 
        m.athenaOutput?.nextMode === 'DISCARD' ||
        m.jobId === 'IE-IDX-0228' || 
        m.jobId === 'IE-IDX-0229'
    );

    console.log(`[REPROCESS] 🔄 Found ${discardedTargets.length} discarded jobs to re-process.`);
    console.log(`[REPROCESS] 🧠 ATHENA endpoint: ${CONFIG.genkitBaseUrl}/sentinel/ideate`);
    console.log();

    let success = 0;
    let failed = 0;

    for (const manifest of discardedTargets) {
        const targetId = manifest.jobId;
        console.log(`[REPROCESS] ═══════════════════════════════════════════`);
        console.log(`[REPROCESS] 🔄 Processing ${targetId}: ${manifest.sourceArticle?.title}`);
        console.log(`[REPROCESS]    URL: ${manifest.sourceArticle?.url}`);
        console.log(`[REPROCESS]    Current Status: ${manifest.status}`);

        try {
            // Step 1: Extract article text
            console.log(`[REPROCESS] 📄 Extracting article text...`);
            const fullText = await extractArticleText(
                manifest.sourceArticle?.url || '',
                '' // no description fallback
            );
            console.log(`[REPROCESS] 📄 Extracted ${fullText.length} chars`);

            // Step 2: Determine depth from relevance
            const depth = manifest.inceptionRelevance >= 70 ? 'exhaustive' 
                        : manifest.inceptionRelevance >= 40 ? 'deep' 
                        : 'surface';

            // Step 3: Dispatch ATHENA
            const athenaResult = await dispatchAthena(
                manifest.sourceArticle!,
                fullText,
                depth as any
            );

            if (athenaResult) {
                console.log(`[REPROCESS] ATHENA Directive: "${athenaResult.directive.slice(0, 100)}..."`);
                console.log(`[REPROCESS] Athena Options: ${athenaResult.options?.length || 0}`);
                console.log(`[REPROCESS] Athena nextMode: ${athenaResult.nextMode}`);

                // Update manifest with new constructive outputs
                manifest.athenaOutput = {
                    directive: athenaResult.directive,
                    rationale: athenaResult.rationale,
                    options: athenaResult.options || [],
                    suggestedAgents: athenaResult.suggestedAgents || [],
                    nextMode: athenaResult.nextMode || 'PLAN',
                    constitutionalFlags: athenaResult.constitutionalFlags || [],
                };

                // Change status from DISCARDED to IDEATED
                manifest.status = 'IDEATED';
                manifest.ideatedAt = new Date().toISOString();

                // Step 4: Cross-reference
                console.log(`[REPROCESS] 🔗 Building cross-references...`);
                const crossRefs = applyCrossReferences(manifest);

                // Step 5: Save updated manifest to JSON
                updateManifest(manifest);
                console.log(`[REPROCESS] 💾 JSON Manifest updated → ${manifest.status}`);

                // Step 6: Update Obsidian Note
                console.log(`[REPROCESS] 📝 Updating Obsidian Note...`);
                writeObsidianNote(manifest, crossRefs);

                // Step 7: Send email (only for specific requested ones or highly relevant ones to avoid spam)
                const shouldSendEmail = 
                    manifest.jobId === 'IE-IDX-0228' || 
                    manifest.jobId === 'IE-IDX-0229' || 
                    manifest.inceptionRelevance >= 80;

                if (shouldSendEmail) {
                    console.log(`[REPROCESS] 📧 Sending ideation email...`);
                    await sendIdeationEmail(manifest, crossRefs);
                    console.log(`[REPROCESS] ✅ ${targetId} — Email sent successfully.`);
                } else {
                    console.log(`[REPROCESS] 🤫 Obsidian updated silently (no email sent to avoid spam).`);
                }
                success++;
            } else {
                console.error(`[REPROCESS] ❌ ${targetId} — ATHENA returned null`);
                failed++;
            }
        } catch (err: any) {
            console.error(`[REPROCESS] ❌ ${targetId} — Reprocessing failed: ${err.message}`);
            console.error(err.stack);
            failed++;
        }

        // Delay between dispatches to respect rate limits
        await new Promise(r => setTimeout(r, 2000));
    }

    // Step 8: Update Sentinel Dashboard MOC
    console.log(`[REPROCESS] 📊 Updating Sentinel MOC Dashboard...`);
    writeSentinelDashboard();

    console.log();
    console.log(`[REPROCESS] ═══════════════════════════════════════════`);
    console.log(`[REPROCESS] 🏁 Complete: ${success} succeeded, ${failed} failed`);
}

main().catch(err => {
    console.error(`[REPROCESS] Fatal: ${err.message}`);
    process.exit(1);
});
