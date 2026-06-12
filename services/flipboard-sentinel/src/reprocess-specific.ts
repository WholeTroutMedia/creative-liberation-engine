/**
 * One-shot script: Re-process SPECIFIC ideations through CORTEX + ATHENA + email.
 * 
 * Usage: tsx src/reprocess-specific.ts
 */

import 'dotenv/config';
import { CONFIG } from './config.js';
import { loadManifest, updateManifest, SourceArticle } from './job-registry.js';
import { sendIdeationEmail } from './email-dispatcher.js';
import { applyCrossReferences } from './cross-reference.js';
import { extractArticleText } from './article-extractor.js';

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
    const targetIds = ['IE-IDX-0301', 'IE-IDX-0302', 'IE-IDX-0303'];
    console.log(`[REPROCESS] 🔄 Re-processing specific target ideations: ${targetIds.join(', ')}`);
    console.log(`[REPROCESS] 🧠 ATHENA endpoint: ${CONFIG.genkitBaseUrl}/sentinel/ideate`);
    console.log(`[REPROCESS] 📧 Email target: ${CONFIG.notifyEmail}`);
    console.log();

    let success = 0;
    let failed = 0;

    for (const targetId of targetIds) {
        const manifest = loadManifest(targetId);
        if (!manifest) {
            console.error(`[REPROCESS] ❌ ${targetId} not found in queue`);
            failed++;
            continue;
        }

        console.log(`[REPROCESS] ═══════════════════════════════════════════`);
        console.log(`[REPROCESS] 🔄 ${targetId}: ${manifest.sourceArticle?.title}`);
        console.log(`[REPROCESS]    URL: ${manifest.sourceArticle?.url}`);
        console.log(`[REPROCESS]    Status: ${manifest.status}`);

        try {
            // Force status to PENDING/re-eval
            manifest.status = 'PENDING';

            // Step 1: Extract article text via CORTEX (which resolves the actual Twitter thread)
            console.log(`[REPROCESS] 📄 Extracting article text...`);
            const fullText = await extractArticleText(
                manifest.sourceArticle?.url || '',
                '' // no description fallback
            );
            console.log(`[REPROCESS] 📄 Extracted ${fullText.length} chars`);

            if (fullText.length < 50 || fullText.includes('Everything App')) {
                console.warn(`[REPROCESS] ⚠️ Warning: Extracted text is short or contains fallback keywords. Length: ${fullText.length}`);
            }

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
                manifest.athenaOutput = {
                    directive: athenaResult.directive,
                    rationale: athenaResult.rationale,
                    options: athenaResult.options || [],
                    suggestedAgents: athenaResult.suggestedAgents || [],
                    nextMode: athenaResult.nextMode || 'PLAN',
                    constitutionalFlags: athenaResult.constitutionalFlags || [],
                };

                if (athenaResult.nextMode === 'DISCARD') {
                    manifest.status = 'DISCARDED';
                } else {
                    manifest.status = 'IDEATED';
                }
                manifest.ideatedAt = new Date().toISOString();

                // Step 4: Cross-reference
                console.log(`[REPROCESS] 🔗 Building cross-references...`);
                const crossRefs = applyCrossReferences(manifest);

                // Step 5: Save updated manifest
                updateManifest(manifest);
                console.log(`[REPROCESS] 💾 Manifest updated → ${manifest.status}`);

                // Step 6: Send email (only if not discarded)
                if (manifest.status !== 'DISCARDED') {
                    console.log(`[REPROCESS] 📧 Sending ideation email...`);
                    await sendIdeationEmail(manifest, crossRefs);
                    console.log(`[REPROCESS] ✅ ${targetId} — Complete! Email sent.`);
                } else {
                    console.log(`[REPROCESS] 🛑 ${targetId} — DISCARDED by ATHENA`);
                }
                success++;
            } else {
                console.error(`[REPROCESS] ❌ ${targetId} — ATHENA returned null`);
                failed++;
            }
        } catch (err: any) {
            console.error(`[REPROCESS] ❌ ${targetId} — Failed: ${err.message}`);
            console.error(err.stack);
            failed++;
        }

        // Delay between dispatches
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log();
    console.log(`[REPROCESS] ═══════════════════════════════════════════`);
    console.log(`[REPROCESS] 🏁 Complete: ${success} succeeded, ${failed} failed`);
}

main().catch(err => {
    console.error(`[REPROCESS] Fatal: ${err.message}`);
    process.exit(1);
});
