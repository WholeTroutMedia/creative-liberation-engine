/**
 * Flipboard Sentinel — Cross-Reference Engine
 * Detects topic overlap between ideation jobs for smart merging.
 * Uses keyword intersection (lightweight, no embedding model required).
 */

import { CONFIG } from './config.js';
import { JobManifest, loadAllManifests, updateManifest } from './job-registry.js';

/**
 * Extract significant keywords from text for comparison.
 * Filters out stop words and short terms.
 */
function extractKeywords(text: string): Set<string> {
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
        'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
        'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'our',
        'you', 'your', 'he', 'she', 'him', 'her', 'his', 'not', 'no', 'nor',
        'so', 'if', 'then', 'than', 'more', 'most', 'also', 'just', 'about',
        'new', 'how', 'what', 'when', 'where', 'who', 'why', 'all', 'each',
        'every', 'both', 'few', 'many', 'some', 'any', 'other', 'into', 'over',
        'such', 'after', 'before', 'between', 'through', 'during', 'above',
        'below', 'up', 'down', 'out', 'off', 'very', 'own', 'same', 'only',
        'using', 'used', 'use', 'make', 'like', 'get', 'got', 'way', 'said',
        'one', 'two', 'first', 'last', 'still', 'even', 'back', 'well',
    ]);

    return new Set(
        text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 3 && !stopWords.has(w))
    );
}

/**
 * Calculate Jaccard similarity between two keyword sets.
 * Returns a value between 0 (no overlap) and 1 (identical).
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
}

/**
 * Category overlap bonus — articles sharing categories are more likely related.
 */
function categoryOverlap(catsA: string[], catsB: string[]): number {
    const setA = new Set(catsA);
    const shared = catsB.filter(c => setA.has(c)).length;
    const total = new Set([...catsA, ...catsB]).size;
    return total === 0 ? 0 : shared / total;
}

export interface CrossRefResult {
    relatedJobId: string;
    relatedSlug: string;
    similarityScore: number;
    sharedCategories: string[];
    sharedKeywords: string[];
}

/**
 * Find existing ideation jobs that are topically related to the given manifest.
 * Returns related jobs sorted by similarity (descending).
 */
export function findRelatedJobs(manifest: JobManifest): CrossRefResult[] {
    const existingManifests = loadAllManifests().filter(m => m.jobId !== manifest.jobId);
    if (existingManifests.length === 0) return [];

    const newKeywords = extractKeywords(
        `${manifest.sourceArticle.title} ${manifest.athenaOutput?.directive || ''} ${manifest.categories.join(' ')}`
    );

    const results: CrossRefResult[] = [];

    for (const existing of existingManifests) {
        if (existing.status === 'ARCHIVED') continue;
        if (!existing.sourceArticle?.title) continue; // Skip malformed manifests

        const existingKeywords = extractKeywords(
            `${existing.sourceArticle.title} ${existing.athenaOutput?.directive || ''} ${(existing.categories || []).join(' ')}`
        );

        const textSimilarity = jaccardSimilarity(newKeywords, existingKeywords);
        const catOverlap = categoryOverlap(manifest.categories, existing.categories);

        // Weighted score: 70% text similarity, 30% category overlap
        const score = textSimilarity * 0.7 + catOverlap * 0.3;

        if (score >= CONFIG.crossRefThreshold) {
            const sharedKeywords = [...newKeywords].filter(k => existingKeywords.has(k));
            const sharedCategories = manifest.categories.filter(c => existing.categories.includes(c));

            results.push({
                relatedJobId: existing.jobId,
                relatedSlug: existing.slug,
                similarityScore: Math.round(score * 100) / 100,
                sharedCategories,
                sharedKeywords: sharedKeywords.slice(0, 10),
            });
        }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarityScore - a.similarityScore);

    return results;
}

/**
 * Apply cross-references bidirectionally.
 * Updates both the new manifest and any related existing manifests.
 */
export function applyCrossReferences(manifest: JobManifest): CrossRefResult[] {
    const related = findRelatedJobs(manifest);

    if (related.length > 0) {
        // Add references to the new manifest
        manifest.relatedJobs = related.map(r => r.relatedJobId);

        // Update existing manifests to reference this new one
        for (const ref of related) {
            const existing = loadAllManifests().find(m => m.jobId === ref.relatedJobId);
            if (existing && !existing.relatedJobs.includes(manifest.jobId)) {
                existing.relatedJobs.push(manifest.jobId);
                updateManifest(existing);
                console.log(`[SENTINEL] 🔗 Cross-ref: ${manifest.jobId} ↔ ${ref.relatedJobId} (${ref.similarityScore})`);
            }
        }
    }

    return related;
}
