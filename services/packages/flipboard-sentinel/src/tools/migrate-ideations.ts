#!/usr/bin/env npx tsx
/**
 * Ideation Lifecycle Migration — V1 → V2
 * 
 * Migrates all existing flat-schema ideation files to the new
 * IDEATION_LIFECYCLE.schema.json format with:
 *   - Full lifecycle tracking (transitions audit trail)
 *   - Source provenance
 *   - Classification metadata
 *   - Notification tracking
 *   - Review schedule initialization
 *   - Central registry generation
 * 
 * Usage:
 *   npx tsx src/tools/migrate-ideations.ts [--dry-run] [--dir /path/to/queue]
 * 
 * The script is idempotent — already-migrated files (version >= 2) are skipped.
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_QUEUE_DIR = '/app/genesis-deploy/runtime/ideation-queue';
const DEFAULT_REGISTRY_DIR = '/app/genesis-deploy/runtime/registry';
const REVIEW_CADENCE_DAYS = 30;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dirArg = args.find((_, i) => args[i - 1] === '--dir');
const QUEUE_DIR = dirArg || DEFAULT_QUEUE_DIR;
const REGISTRY_DIR = DEFAULT_REGISTRY_DIR;

// ─── V1 Types (what exists now) ──────────────────────────────────────────────

interface V1Manifest {
    jobId: string;
    jobNumber: number;
    slug: string;
    filename: string;
    status: string;
    sourceArticle: {
        guid: string;
        title: string;
        url: string;
        author: string;
        pubDate: string;
        imageUrl: string | null;
        categories: string[];
    };
    categories: string[];
    cleRelevance: number;
    athenaOutput: any | null;
    relatedJobs: string[];
    obsidianPath: string;
    comments: string[];
    createdAt: string;
    ideatedAt: string | null;
    activatedAt: string | null;
    completedAt: string | null;
    digestBatchId: string | null;
}

// ─── V2 Types (new lifecycle schema) ─────────────────────────────────────────

interface V2Ideation {
    id: string;
    version: number;
    slug: string;
    status: string;
    source: {
        type: string;
        feedId: string | null;
        guid: string | null;
        title: string;
        url: string;
        author: string | null;
        publishedAt: string | null;
        imageUrl: string | null;
        excerpt: string | null;
        fullText: string | null;
        ingestedAt: string;
        ingestedBy: string;
    };
    classification: {
        categories: string[];
        tags: string[];
        cleRelevance: number;
        urgency: string;
        domain: string | null;
    };
    athena: any | null;
    lifecycle: {
        transitions: Array<{
            from: string;
            to: string;
            at: string;
            by: string;
            reason: string | null;
        }>;
        owner: string | null;
        priority: number;
        blockedBy: string[];
        notes: Array<{
            text: string;
            at: string;
            by: string;
        }>;
    };
    timestamps: {
        createdAt: string;
        brainstormedAt: string | null;
        ideatedAt: string | null;
        reviewedAt: string | null;
        activatedAt: string | null;
        shippedAt: string | null;
        validatedAt: string | null;
        completedAt: string | null;
        archivedAt: string | null;
        lastModifiedAt: string;
        lastReviewedAt: string | null;
        nextReviewDue: string | null;
    };
    relations: {
        crossRefs: Array<{
            targetId: string;
            similarity: number;
            relationship: string;
        }>;
        parentId: string | null;
        childIds: string[];
        projectId: string | null;
        conversationIds: string[];
    };
    deliverables: {
        obsidianPath: string | null;
        artifacts: any[];
    };
    notifications: {
        emailSentAt: string | null;
        emailTo: string | null;
        digestBatchId: string | null;
        slackSentAt: string | null;
        chatSentAt: string | null;
    };
    review: {
        reviews: any[];
        reviewCadence: string;
        improvementSuggestions: string[];
    };
    metadata: {
        v1Filename: string;
        migratedAt: string;
        migratedFrom: string;
    };
}

// ─── Domain Classification ───────────────────────────────────────────────────

function inferDomain(categories: string[], title: string): string | null {
    const lower = [...categories.map(c => (typeof c === 'string' ? c : String(c)).toLowerCase()), title.toLowerCase()].join(' ');
    if (lower.match(/infra|deploy|docker|kubernetes|server|nas|devops/)) return 'infrastructure';
    if (lower.match(/design|ui|ux|figma|css|animation/)) return 'creative';
    if (lower.match(/security|auth|tls|mtls|cert|encrypt/)) return 'security';
    if (lower.match(/business|vc|startup|funding|revenue|market/)) return 'business';
    if (lower.match(/research|paper|study|academic|experiment/)) return 'research';
    if (lower.match(/govern|policy|compliance|legal|copyright/)) return 'governance';
    if (lower.match(/product|feature|launch|release|ship/)) return 'product';
    if (lower.match(/ops|monitor|alert|log|pipeline|cron/)) return 'operations';
    return null;
}

function inferUrgency(relevance: number): string {
    if (relevance >= 80) return 'high';
    if (relevance >= 60) return 'medium';
    if (relevance >= 40) return 'low';
    return 'informational';
}

// ─── Status Mapping ──────────────────────────────────────────────────────────

function mapStatus(v1Status: string): string {
    switch (v1Status) {
        case 'PENDING': return 'BRAINSTORM';
        case 'IDEATED': return 'IDEATED';
        case 'PLANNED': return 'ACTIVATED';
        case 'SHIPPED': return 'SHIPPED';
        case 'VALIDATED': return 'VALIDATED';
        case 'ARCHIVED': return 'ARCHIVED';
        case 'DISCARDED': return 'DISCARDED';
        default: return 'BRAINSTORM';
    }
}

// ─── Transition Reconstruction ───────────────────────────────────────────────

function reconstructTransitions(v1: V1Manifest, v2Status: string): V2Ideation['lifecycle']['transitions'] {
    const transitions: V2Ideation['lifecycle']['transitions'] = [];

    // Every ideation was ingested
    transitions.push({
        from: 'INGESTED',
        to: 'BRAINSTORM',
        at: v1.createdAt,
        by: 'flipboard-sentinel',
        reason: 'RSS article ingested and queued for ATHENA analysis'
    });

    // If it was ideated
    if (v1.ideatedAt) {
        transitions.push({
            from: 'BRAINSTORM',
            to: 'IDEATED',
            at: v1.ideatedAt,
            by: 'ATHENA',
            reason: 'ATHENA strategic analysis complete'
        });
    }

    // If it was activated
    if (v1.activatedAt) {
        transitions.push({
            from: 'IDEATED',
            to: 'ACTIVATED',
            at: v1.activatedAt,
            by: 'operator',
            reason: null
        });
    }

    // If it was completed
    if (v1.completedAt) {
        transitions.push({
            from: v1.activatedAt ? 'ACTIVATED' : 'IDEATED',
            to: 'COMPLETED',
            at: v1.completedAt,
            by: 'operator',
            reason: null
        });
    }

    // If archived/discarded
    if (v2Status === 'ARCHIVED' || v2Status === 'DISCARDED') {
        const lastTransition = transitions[transitions.length - 1];
        transitions.push({
            from: lastTransition?.to || 'BRAINSTORM',
            to: v2Status,
            at: new Date().toISOString(),
            by: 'migration-script',
            reason: 'Status carried from V1'
        });
    }

    return transitions;
}

// ─── Migration Transform ─────────────────────────────────────────────────────

function migrateV1toV2(v1: V1Manifest): V2Ideation {
    const v2Status = mapStatus(v1.status);
    const now = new Date().toISOString();
    const nextReview = new Date(Date.now() + REVIEW_CADENCE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Merge and deduplicate categories — sourceArticle.categories may be RSS XML objects
    const normalizeCat = (c: any): string => {
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object' && typeof c._ === 'string') return c._; // RSS XML { _: 'text', $: {...} }
        return String(c);
    };
    const allCategories = [...new Set([
        ...(v1.categories || []).map(normalizeCat),
        ...(v1.sourceArticle?.categories || []).map(normalizeCat)
    ])].filter(Boolean);

    // Build cross-refs from relatedJobs
    const crossRefs = v1.relatedJobs.map(jobId => ({
        targetId: jobId,
        similarity: 0.4, // Default — V1 didn't store similarity
        relationship: 'similar' as const
    }));

    // Convert comments to notes
    const notes = v1.comments.map(text => ({
        text,
        at: v1.createdAt,
        by: 'operator'
    }));

    // Build ATHENA output with enhanced fields
    let athena: V2Ideation['athena'] = null;
    if (v1.athenaOutput) {
        athena = {
            ...v1.athenaOutput,
            depth: 'exhaustive', // V1 didn't track depth, assume exhaustive
            analyzedAt: v1.ideatedAt || v1.createdAt
        };
    }

    return {
        id: v1.jobId,
        version: 2,
        slug: v1.slug,
        status: v2Status,
        source: {
            type: 'flipboard_rss',
            feedId: 'ai-hk2mtjn0z',
            guid: v1.sourceArticle?.guid || null,
            title: v1.sourceArticle?.title || '',
            url: v1.sourceArticle?.url || '',
            author: v1.sourceArticle?.author || null,
            publishedAt: v1.sourceArticle?.pubDate || null,
            imageUrl: v1.sourceArticle?.imageUrl || null,
            excerpt: null,
            fullText: null,
            ingestedAt: v1.createdAt,
            ingestedBy: 'flipboard-sentinel'
        },
        classification: {
            categories: allCategories,
            tags: [], // V1 had no tags
            cleRelevance: v1.cleRelevance,
            urgency: inferUrgency(v1.cleRelevance),
            domain: inferDomain(allCategories, v1.sourceArticle?.title || '')
        },
        athena,
        lifecycle: {
            transitions: reconstructTransitions(v1, v2Status),
            owner: null,
            priority: v1.cleRelevance >= 70 ? 2 : v1.cleRelevance >= 40 ? 3 : 4,
            blockedBy: [],
            notes
        },
        timestamps: {
            createdAt: v1.createdAt,
            brainstormedAt: v1.createdAt,
            ideatedAt: v1.ideatedAt,
            reviewedAt: null,
            activatedAt: v1.activatedAt,
            shippedAt: null,
            validatedAt: null,
            completedAt: v1.completedAt,
            archivedAt: v2Status === 'ARCHIVED' ? now : null,
            lastModifiedAt: v1.ideatedAt || v1.createdAt,
            lastReviewedAt: null,
            nextReviewDue: v2Status === 'IDEATED' ? nextReview : null
        },
        relations: {
            crossRefs,
            parentId: null,
            childIds: [],
            projectId: null,
            conversationIds: []
        },
        deliverables: {
            obsidianPath: v1.obsidianPath || null,
            artifacts: []
        },
        notifications: {
            emailSentAt: v1.ideatedAt || null, // Infer email sent when ideated
            emailTo: v1.ideatedAt ? 'inquiries@creativeliberationengine.org' : null,
            digestBatchId: v1.digestBatchId,
            slackSentAt: null,
            chatSentAt: null
        },
        review: {
            reviews: [],
            reviewCadence: 'monthly',
            improvementSuggestions: []
        },
        metadata: {
            v1Filename: v1.filename,
            migratedAt: now,
            migratedFrom: 'V1-flat-schema'
        }
    };
}

// ─── Registry Generation ─────────────────────────────────────────────────────

interface RegistryEntry {
    id: string;
    slug: string;
    status: string;
    title: string;
    directive: string | null;
    sourceType: string;
    sourceUrl: string;
    categories: string[];
    tags: string[];
    domain: string | null;
    relevance: number;
    urgency: string | null;
    priority: number | null;
    owner: string | null;
    createdAt: string;
    ideatedAt: string | null;
    lastModifiedAt: string;
    nextReviewDue: string | null;
    crossRefCount: number;
    deliverableCount: number;
    filePath: string;
}

function toRegistryEntry(v2: V2Ideation, filename: string): RegistryEntry {
    return {
        id: v2.id,
        slug: v2.slug,
        status: v2.status,
        title: v2.source.title,
        directive: v2.athena?.directive?.slice(0, 200) || null,
        sourceType: v2.source.type,
        sourceUrl: v2.source.url,
        categories: v2.classification.categories,
        tags: v2.classification.tags,
        domain: v2.classification.domain,
        relevance: v2.classification.cleRelevance,
        urgency: v2.classification.urgency,
        priority: v2.lifecycle.priority,
        owner: v2.lifecycle.owner,
        createdAt: v2.timestamps.createdAt,
        ideatedAt: v2.timestamps.ideatedAt,
        lastModifiedAt: v2.timestamps.lastModifiedAt,
        nextReviewDue: v2.timestamps.nextReviewDue,
        crossRefCount: v2.relations.crossRefs.length,
        deliverableCount: v2.deliverables.artifacts.length,
        filePath: `ideation-queue/${filename}`
    };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n╔══════════════════════════════════════════════════╗`);
    console.log(`║  IDEATION LIFECYCLE MIGRATION — V1 → V2         ║`);
    console.log(`║  ${new Date().toISOString()}            ║`);
    console.log(`╚══════════════════════════════════════════════════╝\n`);

    if (dryRun) console.log('🔍 DRY RUN — no files will be modified\n');

    // Read all files
    if (!fs.existsSync(QUEUE_DIR)) {
        console.error(`❌ Queue directory not found: ${QUEUE_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json')).sort();
    console.log(`📂 Found ${files.length} ideation files in ${QUEUE_DIR}\n`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    const registryEntries: RegistryEntry[] = [];
    const statusCounts: Record<string, number> = {};
    const domainCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    let totalRelevance = 0;

    for (const file of files) {
        const filePath = path.join(QUEUE_DIR, file);
        try {
            const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            // Skip already-migrated files
            if (raw.version && raw.version >= 2) {
                skipped++;
                registryEntries.push(toRegistryEntry(raw, file));
                // Count stats
                statusCounts[raw.status] = (statusCounts[raw.status] || 0) + 1;
                if (raw.classification?.domain) domainCounts[raw.classification.domain] = (domainCounts[raw.classification.domain] || 0) + 1;
                sourceCounts[raw.source?.type || 'unknown'] = (sourceCounts[raw.source?.type || 'unknown'] || 0) + 1;
                totalRelevance += raw.classification?.cleRelevance || 0;
                continue;
            }

            // Migrate V1 → V2
            const v2 = migrateV1toV2(raw as V1Manifest);

            if (!dryRun) {
                fs.writeFileSync(filePath, JSON.stringify(v2, null, 2));
            }

            registryEntries.push(toRegistryEntry(v2, file));

            // Count stats
            statusCounts[v2.status] = (statusCounts[v2.status] || 0) + 1;
            if (v2.classification.domain) domainCounts[v2.classification.domain] = (domainCounts[v2.classification.domain] || 0) + 1;
            sourceCounts[v2.source.type] = (sourceCounts[v2.source.type] || 0) + 1;
            totalRelevance += v2.classification.cleRelevance;

            migrated++;
            console.log(`  ✅ ${v2.id} → ${v2.status} | ${v2.source.title.slice(0, 50)}`);

        } catch (err: any) {
            failed++;
            console.error(`  ❌ ${file}: ${err.message}`);
        }
    }

    // Generate registry
    const totalCount = registryEntries.length;
    const activatedCount = registryEntries.filter(e => ['ACTIVATED', 'IN_PROGRESS', 'SHIPPED', 'VALIDATED', 'COMPLETED'].includes(e.status)).length;
    const completedCount = registryEntries.filter(e => e.status === 'COMPLETED').length;

    const registry = {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        lastJobNumber: Math.max(...registryEntries.map(e => parseInt(e.id.split('-')[2]))),
        stats: {
            total: totalCount,
            byStatus: statusCounts,
            byDomain: domainCounts,
            bySource: sourceCounts,
            avgRelevance: totalCount > 0 ? Math.round(totalRelevance / totalCount) : 0,
            activationRate: totalCount > 0 ? Math.round((activatedCount / totalCount) * 100) : 0,
            completionRate: activatedCount > 0 ? Math.round((completedCount / activatedCount) * 100) : 0,
            oldestUnreviewed: registryEntries
                .filter(e => !e.nextReviewDue && e.status === 'IDEATED')
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.createdAt || null,
            nextReviewDue: registryEntries
                .filter(e => e.nextReviewDue)
                .sort((a, b) => (a.nextReviewDue || '').localeCompare(b.nextReviewDue || ''))[0]?.nextReviewDue || null
        },
        ideations: registryEntries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        sources: {
            feeds: [{
                feedId: 'ai-hk2mtjn0z',
                name: 'AI — Flipboard',
                url: 'https://flipboard.com/@jaharoni/ai-hk2mtjn0z.rss',
                totalIngested: sourceCounts['flipboard_rss'] || 0,
                lastIngestedAt: registryEntries
                    .filter(e => e.sourceType === 'flipboard_rss')
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt || null,
                avgRelevance: totalCount > 0 ? Math.round(totalRelevance / totalCount) : 0
            }],
            seenGuids: [],  // Will be populated from sentinel-seen.json
            lastPollAt: null,
            totalPolls: 0
        },
        reviewSchedule: {
            nextMonthlyReview: new Date(2026, 4, 1).toISOString(), // May 1, 2026
            lastMonthlyReview: null,
            overdueReviews: registryEntries
                .filter(e => e.nextReviewDue && new Date(e.nextReviewDue) < new Date())
                .map(e => e.id),
            upcomingReviews: registryEntries
                .filter(e => e.nextReviewDue)
                .sort((a, b) => (a.nextReviewDue || '').localeCompare(b.nextReviewDue || ''))
                .slice(0, 20)
                .map(e => ({ id: e.id, dueAt: e.nextReviewDue! }))
        }
    };

    if (!dryRun) {
        fs.mkdirSync(REGISTRY_DIR, { recursive: true });
        const registryPath = path.join(REGISTRY_DIR, 'ideations.canonical.json');
        fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
        console.log(`\n📋 Registry written: ${registryPath}`);
    }

    // Summary
    console.log(`\n╔══════════════════════════════════════════════════╗`);
    console.log(`║  MIGRATION COMPLETE                              ║`);
    console.log(`╠══════════════════════════════════════════════════╣`);
    console.log(`║  Migrated:  ${String(migrated).padStart(4)}                                ║`);
    console.log(`║  Skipped:   ${String(skipped).padStart(4)} (already V2)                    ║`);
    console.log(`║  Failed:    ${String(failed).padStart(4)}                                ║`);
    console.log(`╠══════════════════════════════════════════════════╣`);
    console.log(`║  Registry Stats:                                 ║`);
    for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`║    ${status.padEnd(14)} ${String(count).padStart(4)}                            ║`);
    }
    console.log(`║  Avg Relevance:  ${registry.stats.avgRelevance}%                            ║`);
    console.log(`╚══════════════════════════════════════════════════╝\n`);
}

main().catch(err => {
    console.error('Fatal migration error:', err);
    process.exit(1);
});
