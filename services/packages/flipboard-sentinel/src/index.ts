/**
 * Flipboard Sentinel â€” Main Orchestration Loop
 * 
 * The autonomous ideation pipeline:
 *   1. Poll Flipboard RSS for new articles
 *   2. Extract, classify, and cross-reference
 *   3. Dispatch ATHENA IDEATION for each new article
 *   4. PAUSE â€” deliver results to Obsidian + email
 *   5. Await operator activation for PLAN/SHIP/VALIDATE
 * 
 * Usage:
 *   pnpm dev          â€” Single-run poll (for testing)
 *   pnpm start        â€” Continuous cron loop
 *   pnpm run poll     â€” One-shot poll
 * 
 * Constitutional: Article IX (No MVPs), Article XX (No human wait time)
 */

import 'dotenv/config';
import cron from 'node-cron';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { pollRSSFeed, type FeedArticle } from './rss-poller.js';
import { extractArticleText, classifyArticle, isTwitterUrl } from './article-extractor.js';
import {
    filterNewArticles,
    createManifest,
    saveManifest,
    updateManifest,
    sweepStaleIdeations,
    loadAllManifests,
    type JobManifest,
    type SourceArticle,
} from './job-registry.js';
import { applyCrossReferences, type CrossRefResult } from './cross-reference.js';
import { writeObsidianNote, writeSentinelDashboard, readOperatorComments } from './obsidian-writer.js';
import { sendIdeationEmail, sendHealthAlert } from './email-dispatcher.js';

// â”€â”€â”€ ATHENA Dispatch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface AthenaResponse {
    directive: string;
    rationale: string;
    options: Array<{
        title: string;
        description: string;
        tradeoffs: string;
        recommendation: 'preferred' | 'viable' | 'avoid';
        realWorldExamples?: string[];
        implementationDetails?: string;
    }>;
    suggestedAgents: string[];
    nextMode: string;
    constitutionalFlags: string[];
    athenaSignature: string;
}

/**
 * Call ATHENA IDEATION via the Genkit server.
 */
export async function dispatchAthena(
    article: SourceArticle,
    articleText: string,
    depth: 'surface' | 'deep' | 'exhaustive',
): Promise<AthenaResponse | null> {
    console.log(`[SENTINEL] ðŸ§  Dispatching ATHENA (${depth}) for: ${article.title}`);

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
            console.error(`[SENTINEL] âŒ ATHENA dispatch failed (${response.status}): ${errText}`);
            return null;
        }

        const result = await response.json() as any;
        // The mesh/execute endpoint wraps the output
        return result.athena || result.output || result;
    } catch (err: any) {
        console.error(`[SENTINEL] âŒ ATHENA connection failed: ${err.message}`);
        return null;
    }
}

// â”€â”€â”€ Core Pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Process a single article through the full ideation pipeline.
 */
async function processArticle(article: FeedArticle): Promise<JobManifest | null> {
    console.log(`[SENTINEL] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•`);
    console.log(`[SENTINEL] Processing: ${article.title}`);
    console.log(`[SENTINEL] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•`);

    // Step 1: Extract full text
    const fullText = await extractArticleText(article.link, article.description);

    // Step 2: Classify
    const { categories, cleRelevance } = classifyArticle(article.title, fullText);
    console.log(`[SENTINEL] ðŸ“Š Classification: [${categories.join(', ')}] Relevance: ${cleRelevance}`);

    // Step 3: Create manifest
    const sourceArticle: SourceArticle = {
        guid: article.guid,
        title: article.title,
        url: article.link,
        author: article.author,
        pubDate: article.pubDate,
        imageUrl: article.imageUrl,
        categories: article.categories,
    };

    const manifest = createManifest(sourceArticle, categories, cleRelevance);

    // Source classification â€” tag manifests for source-specific handling
    const isTweet = isTwitterUrl(article.link);
    manifest.sourceType = isTweet ? 'twitter' : 'article';

    // Content quality gate for Twitter sources
    // If extraction returned thin content, mark for retry instead of sending garbage to ATHENA
    if (isTweet && fullText.length < 100) {
        manifest.status = 'PENDING_RETRY';
        manifest.retryCount = 0;
        manifest.extractionQuality = {
            method: 'cortex_exhausted',
            charCount: fullText.length,
            qualityPass: false,
        };
        saveManifest(manifest);
        console.log(`[SENTINEL] ðŸš¨ ${manifest.jobId} â€” Twitter quality gate failed (${fullText.length} chars). Queued for retry.`);
        return manifest;
    }

    saveManifest(manifest);

    // Step 4: Determine depth based on relevance
    // Operator curated = always exhaustive depth (no relevance gating)
    const depth = 'exhaustive';

    // Step 5: Dispatch ATHENA
    const athenaResult = await dispatchAthena(sourceArticle, fullText, depth);

    if (athenaResult) {
        manifest.athenaOutput = {
            directive: athenaResult.directive,
            rationale: athenaResult.rationale,
            options: athenaResult.options || [],
            suggestedAgents: athenaResult.suggestedAgents || [],
            nextMode: athenaResult.nextMode || 'PLAN',
            constitutionalFlags: athenaResult.constitutionalFlags || [],
        };
        
        // ATHENA advises but never vetoes operator-curated content
        if (athenaResult.nextMode === 'DISCARD') {
            console.log(`[SENTINEL] \u2139\uFE0F ATHENA advisory: DISCARD \u2014 but operator curated, overriding to IDEATED`);
        }
        manifest.status = 'IDEATED';
        manifest.ideatedAt = new Date().toISOString();
    }

    // Step 6: Cross-reference with existing ideations
    const crossRefs = applyCrossReferences(manifest);

    // Step 7: Save updated manifest
    updateManifest(manifest);

    // Always deliver — operator curated = no DISCARD veto
    // Step 8: Write to Obsidian
    writeObsidianNote(manifest, crossRefs);

    // Step 9: Send email
    await sendIdeationEmail(manifest, crossRefs);
    
    console.log(`[SENTINEL] âœ… ${manifest.jobId} complete â†’ Status: ${manifest.status} (Email Sent)`);

    return manifest;
}

/**
 * Process a batch of articles (digest mode for 3+ articles).
 */
async function processBatch(articles: FeedArticle[]): Promise<JobManifest[]> {
    const manifests: JobManifest[] = [];

    if (articles.length >= CONFIG.digestThreshold) {
        console.log(`[SENTINEL] ðŸ“¦ Digest mode: ${articles.length} articles in batch`);
        // Process sequentially to avoid overwhelming ATHENA
        for (const article of articles) {
            try {
                const manifest = await processArticle(article);
                if (manifest) manifests.push(manifest);
            } catch (err: any) {
                console.error(`[SENTINEL] âŒ Article processing failed (${article.title}): ${err.message}`);
            }
            // Small delay between dispatches
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } else {
        for (const article of articles) {
            try {
                const manifest = await processArticle(article);
                if (manifest) manifests.push(manifest);
            } catch (err: any) {
                console.error(`[SENTINEL] âŒ Article processing failed (${article.title}): ${err.message}`);
                // Continue processing remaining articles
            }
        }
    }

    return manifests;
}

// â”€â”€â”€ Main Poll Cycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getHealthStatePath(): string {
    return path.join(CONFIG.stateDir, 'sentinel-health.json');
}

interface HealthState {
    consecutiveFailures: number;
    lastFailureMessage?: string;
}

function readHealthState(): HealthState {
    try {
        const filePath = getHealthStatePath();
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
    } catch { /* fresh start */ }
    return { consecutiveFailures: 0 };
}

function writeHealthState(state: HealthState): void {
    try {
        const filePath = getHealthStatePath();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
    } catch { /* non-fatal */ }
}

// ─── Main Poll Cycle ───────────────────────────────────────────────────────────

async function runPollCycle(): Promise<void> {
    const cycleStart = Date.now();
    console.log(`\n[SENTINEL] â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—`);
    console.log(`[SENTINEL] â•‘  FLIPBOARD SENTINEL â€” POLL CYCLE             â•‘`);
    console.log(`[SENTINEL] â•‘  ${new Date().toISOString()}          â•‘`);
    console.log(`[SENTINEL] â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n`);

    try {
        let allArticles: FeedArticle[];
        try {
            // Poll RSS (also serves as the feed health check)
            allArticles = await pollRSSFeed();

            if (allArticles.length === 0) {
                throw new Error('RSS feed returned 0 items — may be stale or broken');
            }

            const healthState = readHealthState();
            if (healthState.consecutiveFailures > 0) {
                console.log(`[SENTINEL] ✅ RSS feed health restored after ${healthState.consecutiveFailures} failure(s)`);
                healthState.consecutiveFailures = 0;
                healthState.lastFailureMessage = undefined;
                writeHealthState(healthState);
            }
        } catch (err: any) {
            const healthErr = err.message.includes('RSS feed') ? err.message : `RSS feed error: ${err.message}`;
            const healthState = readHealthState();
            healthState.consecutiveFailures += 1;
            healthState.lastFailureMessage = healthErr;
            writeHealthState(healthState);
            console.warn(`[SENTINEL] ⚠️  Health check failed (consecutive: ${healthState.consecutiveFailures}): ${healthErr}`);

            // Only alert on exactly 3 consecutive failures (45 mins) to suppress transient hiccups,
            // or every 12 subsequent failures (3 hours) to remind if it persists.
            if (healthState.consecutiveFailures === 3 ||
                (healthState.consecutiveFailures > 3 && (healthState.consecutiveFailures - 3) % 12 === 0)) {
                console.log(`[SENTINEL] 🚨 Sending health alert email...`);
                await sendHealthAlert(`Persistent RSS feed error: ${healthErr} (Failed ${healthState.consecutiveFailures} consecutive times)`);
            }
            return;
        }

        // Filter to only new (unseen) articles
        const newArticles = filterNewArticles(allArticles);

        if (newArticles.length === 0) {
            console.log(`[SENTINEL] â„¹ï¸ No new articles detected. Feed is current.`);
        } else {
            console.log(`[SENTINEL] ðŸ†• ${newArticles.length} new article(s) detected!`);

            // Process batch
            const results = await processBatch(newArticles);

            // Update dashboard
            writeSentinelDashboard();

            console.log(`[SENTINEL] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•`);
            console.log(`[SENTINEL] ðŸ“‹ Batch Summary:`);
            for (const m of results) {
                const title = m.sourceArticle?.title || 'Unknown';
                console.log(`[SENTINEL]   ${m.jobId} | ${m.status} | ${title.slice(0, 50)}`);
            }
            console.log(`[SENTINEL] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•`);
        }

        // Sweep stale ideations
        const archived = sweepStaleIdeations();
        if (archived > 0) {
            console.log(`[SENTINEL] ðŸ—„ï¸ Archived ${archived} stale ideation(s)`);
        }

        // Auto-retry any PENDING jobs (ATHENA failures from prior cycles)
        await retryPendingJobs();

        // Sync operator comments from Obsidian
        syncOperatorComments();

    } catch (err: any) {
        console.error(`[SENTINEL] âŒ Poll cycle failed: ${err.message}`);
        await sendHealthAlert(`Poll cycle error: ${err.message}`);
    }

    const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
    console.log(`[SENTINEL] â±ï¸ Cycle complete in ${elapsed}s\n`);
}

/**
 * Automatically retry any manifests stuck in PENDING or PENDING_RETRY status.
 * Called at the end of every poll cycle â€” self-healing pipeline.
 * PENDING: ATHENA dispatch failures (>30 min old).
 * PENDING_RETRY: Twitter content quality gate failures (max 3 retries).
 */
async function retryPendingJobs(): Promise<void> {
    try {
        const manifests = loadAllManifests();
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        // Category 1: ATHENA dispatch failures
        const stuckJobs = manifests.filter(
            m => m.status === 'PENDING' && m.createdAt < thirtyMinutesAgo
        );

        // Category 2: Twitter quality gate failures (max 3 retries)
        const MAX_TWITTER_RETRIES = 3;
        const twitterRetryJobs = manifests.filter(
            m => m.status === 'PENDING_RETRY' && (m.retryCount || 0) < MAX_TWITTER_RETRIES
        );

        const totalRetries = stuckJobs.length + twitterRetryJobs.length;
        if (totalRetries === 0) return;

        console.log(`[SENTINEL] ðŸ”„ Auto-retry: ${stuckJobs.length} PENDING + ${twitterRetryJobs.length} PENDING_RETRY job(s)`);

        // Retry PENDING (ATHENA failures)
        for (const manifest of stuckJobs) {
            console.log(`[SENTINEL] â†©ï¸  Retrying ${manifest.jobId}: ${manifest.sourceArticle.title.slice(0, 50)}`);
            const depth = 'exhaustive' /* operator curated = always max depth */;
            const fullText = await extractArticleText(manifest.sourceArticle.url, manifest.sourceArticle.title);
            const athenaResult = await dispatchAthena(manifest.sourceArticle, fullText, depth);

            if (athenaResult) {
                manifest.athenaOutput = {
                    directive: athenaResult.directive,
                    rationale: athenaResult.rationale,
                    options: athenaResult.options || [],
                    suggestedAgents: athenaResult.suggestedAgents || [],
                    nextMode: athenaResult.nextMode || 'PLAN',
                    constitutionalFlags: athenaResult.constitutionalFlags || [],
                };
                manifest.status = 'IDEATED'; // Operator curated = always ideate
                manifest.ideatedAt = new Date().toISOString();

                const crossRefs = applyCrossReferences(manifest);
                updateManifest(manifest);

                // Always deliver — operator curated = no DISCARD veto
                writeObsidianNote(manifest, crossRefs);
                await sendIdeationEmail(manifest, crossRefs);
                console.log(`[SENTINEL] âœ… ${manifest.jobId} retry â†’ IDEATED (email sent)`);
            } else {
                console.log(`[SENTINEL] âš ï¸  ${manifest.jobId} retry failed â€” will try next cycle`);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Retry PENDING_RETRY (Twitter quality gate failures)
        for (const manifest of twitterRetryJobs) {
            manifest.retryCount = (manifest.retryCount || 0) + 1;
            console.log(`[SENTINEL] ðŸ¦â†©ï¸ Twitter retry ${manifest.retryCount}/${MAX_TWITTER_RETRIES}: ${manifest.jobId} â€” ${manifest.sourceArticle.title.slice(0, 50)}`);

            const fullText = await extractArticleText(manifest.sourceArticle.url, manifest.sourceArticle.title);

            // Re-evaluate quality
            if (fullText.length >= 100) {
                console.log(`[SENTINEL] âœ… Twitter retry succeeded (${fullText.length} chars). Proceeding to ATHENA.`);
                manifest.extractionQuality = {
                    method: `cortex_retry_${manifest.retryCount}`,
                    charCount: fullText.length,
                    qualityPass: true,
                };

                const depth = 'exhaustive' /* operator curated = always max depth */;
                const athenaResult = await dispatchAthena(manifest.sourceArticle, fullText, depth);

                if (athenaResult) {
                    manifest.athenaOutput = {
                        directive: athenaResult.directive,
                        rationale: athenaResult.rationale,
                        options: athenaResult.options || [],
                        suggestedAgents: athenaResult.suggestedAgents || [],
                        nextMode: athenaResult.nextMode || 'PLAN',
                        constitutionalFlags: athenaResult.constitutionalFlags || [],
                    };
                    manifest.status = 'IDEATED'; // Operator curated = always ideate
                    manifest.ideatedAt = new Date().toISOString();

                    const crossRefs = applyCrossReferences(manifest);
                    updateManifest(manifest);

                    // Always deliver — operator curated = no DISCARD veto
                    writeObsidianNote(manifest, crossRefs);
                    await sendIdeationEmail(manifest, crossRefs);
                    console.log(`[SENTINEL] âœ… ${manifest.jobId} Twitter retry â†’ IDEATED (email sent)`);
                } else {
                    manifest.status = 'PENDING_RETRY';
                    updateManifest(manifest);
                    console.log(`[SENTINEL] âš ï¸ ${manifest.jobId} ATHENA dispatch failed on retry`);
                }
            } else {
                // Still thin â€” check if we've exhausted retries
                manifest.extractionQuality = {
                    method: `cortex_retry_${manifest.retryCount}_failed`,
                    charCount: fullText.length,
                    qualityPass: false,
                };

                if (manifest.retryCount >= MAX_TWITTER_RETRIES) {
                    console.log(`[SENTINEL] ðŸ›‘ ${manifest.jobId} â€” Twitter retries exhausted (${MAX_TWITTER_RETRIES}). Likely media-only post. Archiving.`);
                    manifest.status = 'ARCHIVED';
                } else {
                    console.log(`[SENTINEL] âš ï¸ ${manifest.jobId} â€” Twitter still thin (${fullText.length} chars). Will retry next cycle (${manifest.retryCount}/${MAX_TWITTER_RETRIES}).`);
                }
                updateManifest(manifest);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } catch (err: any) {
        console.error(`[SENTINEL] âŒ Retry sweep error: ${err.message}`);
    }
}

/**
 * Check Obsidian notes for new operator comments and sync back to manifests.
 */
function syncOperatorComments(): void {
    try {
        const manifests = loadAllManifests();

        for (const m of manifests) {
            if (m.status === 'ARCHIVED') continue;
            const comments = readOperatorComments(m);
            if (comments.length > 0 && JSON.stringify(comments) !== JSON.stringify(m.comments)) {
                m.comments = comments;
                updateManifest(m);
                console.log(`[SENTINEL] ðŸ’¬ Synced comments for ${m.jobId}: ${comments.length} note(s)`);
            }
        }
    } catch { /* Non-fatal */ }
}

/**
 * Execute a specific job ID (Operator activation).
 */
async function executeJob(jobId: string): Promise<void> {
    console.log(`\n[SENTINEL] â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—`);
    console.log(`[SENTINEL] â•‘  âš¡ OPERATOR OVERRIDE â€” JOB EXECUTION      â•‘`);
    console.log(`[SENTINEL] â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n`);
    
    console.log(`[SENTINEL] ðŸ”Ž Locating manifest: ${jobId}`);
    const { loadManifest, updateManifest } = await import('./job-registry.js');
    const manifest = loadManifest(jobId);
    
    if (!manifest) {
        console.error(`[SENTINEL] âŒ FATAL: Job ${jobId} not found in queue.`);
        return;
    }
    
    console.log(`[SENTINEL] ðŸš€ Activating ${jobId} [${manifest.sourceArticle.title}]`);
    console.log(`[SENTINEL] ðŸ“¡ Dispatching to NEXT MODE: ${manifest.athenaOutput?.nextMode || 'PLAN'}...`);
    
    // Simulate transition
    manifest.status = 'PLANNED';
    manifest.activatedAt = new Date().toISOString();
    updateManifest(manifest);

    // Sync to Obsidian
    try {
        const crossRefs = applyCrossReferences(manifest);
        writeObsidianNote(manifest, crossRefs);
        writeSentinelDashboard();
    } catch (err: any) {
        console.warn(`[SENTINEL] ⚠️ Failed to update Obsidian note: ${err.message}`);
    }
    
    console.log(`[SENTINEL] ✅ Job ${jobId} state transitioned to ${manifest.status}.`);
}

// â”€â”€â”€ Entry Point â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const isOnce = process.argv.includes('--once');
const isRetry = process.argv.includes('--retry');
const execIndex = process.argv.indexOf('--execute');

if (execIndex > -1 && process.argv.length > execIndex + 1) {
    const jobId = process.argv[execIndex + 1];
    executeJob(jobId).then(() => process.exit(0)).catch(err => {
        console.error(`[SENTINEL] âŒ Execution failed: ${err.message}`);
        process.exit(1);
    });
} else if (isRetry) {
    console.log(`[SENTINEL] ðŸ”„ Retry mode (--retry)`);
    import('./job-registry.js').then(async ({ loadAllManifests, updateManifest }) => {
        const manifests = loadAllManifests();
        
        // Find all GUIDs that have already been processed (IDEATED, DISCARDED, etc)
        const processedGuids = new Set(
            manifests
                .filter(m => m.status !== 'PENDING' && m.status !== 'ARCHIVED')
                .map(m => m.sourceArticle.guid)
        );
        
        const pending = manifests.filter(m => m.status === 'PENDING');
        const uniquePending = [];
        
        for (const m of pending) {
            if (processedGuids.has(m.sourceArticle.guid)) {
                console.log(`[SENTINEL] ðŸ—‘ï¸ Skipping duplicate pending job: ${m.jobId}`);
                m.status = 'DISCARDED';
                updateManifest(m);
            } else {
                processedGuids.add(m.sourceArticle.guid);
                uniquePending.push(m);
            }
        }
        
        console.log(`[SENTINEL] Found ${uniquePending.length} unique PENDING jobs to retry.`);
        for (const manifest of uniquePending) {
            console.log(`[SENTINEL] Retrying job: ${manifest.jobId}`);
            const depth = 'exhaustive' /* operator curated = always max depth */;
            // We need full text. We can re-extract it.
            const fullText = await extractArticleText(manifest.sourceArticle.url, manifest.sourceArticle.title);
            const athenaResult = await dispatchAthena(manifest.sourceArticle, fullText, depth);
            if (athenaResult) {
                manifest.athenaOutput = {
                    directive: athenaResult.directive,
                    rationale: athenaResult.rationale,
                    options: athenaResult.options || [],
                    suggestedAgents: athenaResult.suggestedAgents || [],
                    nextMode: athenaResult.nextMode || 'PLAN',
                    constitutionalFlags: athenaResult.constitutionalFlags || [],
                };
                
                // Operator curated = always ideate (no DISCARD veto)
                manifest.status = 'IDEATED';
                manifest.ideatedAt = new Date().toISOString();







                
                const crossRefs = applyCrossReferences(manifest);
                updateManifest(manifest);
                
                // Always deliver — operator curated = no DISCARD veto
                writeObsidianNote(manifest, crossRefs);
                await sendIdeationEmail(manifest, crossRefs);
                console.log(`[SENTINEL] âœ… Job ${manifest.jobId} retry complete â†’ IDEATED`);
            } else {
                console.log(`[SENTINEL] âŒ Job ${manifest.jobId} retry failed.`);
            }
        }
        console.log(`[SENTINEL] ðŸ Retry run complete. Exiting.`);
        process.exit(0);
    });
} else if (isOnce) {
    // Single-run mode
    console.log(`[SENTINEL] ðŸ”§ Single-run mode (--once)`);
    runPollCycle().then(() => {
        console.log(`[SENTINEL] ðŸ Single run complete. Exiting.`);
        process.exit(0);
    }).catch(err => {
        console.error(`[SENTINEL] âŒ Fatal: ${err.message}`);
        process.exit(1);
    });
} else {
    // Continuous cron mode
    console.log(`[SENTINEL] ðŸš€ Starting continuous mode`);
    console.log(`[SENTINEL] â° Poll interval: every ${CONFIG.pollIntervalMinutes} minutes`);
    console.log(`[SENTINEL] ðŸ“¡ RSS: ${CONFIG.rssUrl}`);
    console.log(`[SENTINEL] ðŸ’¾ Queue: ${CONFIG.queueDir}`);
    console.log(`[SENTINEL] ðŸ“ Vault: ${CONFIG.obsidianSentinelDir}`);
    console.log(`[SENTINEL] ðŸ“§ Email: ${CONFIG.notifyEmail}`);
    console.log('');

    // Run immediately on start
    runPollCycle();

    // Schedule recurring polls
    cron.schedule(`*/${CONFIG.pollIntervalMinutes} * * * *`, () => {
        runPollCycle();
    });
}

