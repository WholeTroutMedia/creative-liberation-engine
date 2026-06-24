// packages/design-governance/src/token-analytics.ts
// DS-701: Token usage analytics — orphan detection, usage frequency tracking

import type { TokenUsageRecord, TokenUsageSummary } from './types.js';

// ─── CSS var(--token) scanner ─────────────────────────────────────────────────

/** Regex that captures CSS custom property references: var(--inc-...) */
const CSS_VAR_PATTERN = /var\(\s*(--inc-[\w-]+)\s*(?:,\s*[^)]+)?\)/g;

/** Regex that captures CSS custom property definitions: --inc-...: */
const CSS_PROP_PATTERN = /(--inc-[\w-]+)\s*:/g;

/**
 * Scan file content for CSS variable usage (`var(--inc-...)` references).
 * Works on CSS, TSX, and any text that contains CSS variable references.
 */
export function scanTokenUsage(
    files: Array<{ path: string; content: string }>,
): TokenUsageRecord[] {
    const usageMap = new Map<string, { count: number; files: Set<string> }>();

    for (const file of files) {
        const matches = file.content.matchAll(CSS_VAR_PATTERN);
        for (const match of matches) {
            const token = match[1]!;
            const existing = usageMap.get(token);
            if (existing) {
                existing.count++;
                existing.files.add(file.path);
            } else {
                usageMap.set(token, { count: 1, files: new Set([file.path]) });
            }
        }
    }

    return Array.from(usageMap.entries())
        .map(([token, { count, files }]) => ({
            token,
            count,
            files: Array.from(files),
        }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Scan file content for CSS custom property definitions (--inc-...: value).
 * This finds tokens that are _defined_ in the codebase.
 */
export function scanTokenDefinitions(
    files: Array<{ path: string; content: string }>,
): string[] {
    const definitions = new Set<string>();

    for (const file of files) {
        const matches = file.content.matchAll(CSS_PROP_PATTERN);
        for (const match of matches) {
            definitions.add(match[1]!);
        }
    }

    return Array.from(definitions).sort();
}

// ─── Orphan & Unregistered Token Detection ────────────────────────────────────

/**
 * Find orphan tokens — tokens defined in the registry but never consumed in the codebase.
 */
export function findOrphanTokens(
    definedTokens: string[],
    usedTokens: TokenUsageRecord[],
): string[] {
    const usedSet = new Set(usedTokens.map((u) => u.token));
    return definedTokens.filter((t) => !usedSet.has(t));
}

/**
 * Find unregistered tokens — tokens consumed in the codebase but not in the registry.
 * These may indicate drift or ad-hoc token creation.
 */
export function findUnregisteredTokens(
    definedTokens: string[],
    usedTokens: TokenUsageRecord[],
): string[] {
    const definedSet = new Set(definedTokens);
    return usedTokens
        .filter((u) => !definedSet.has(u.token))
        .map((u) => u.token);
}

/**
 * Build a full token usage summary.
 */
export function buildTokenUsageSummary(
    definedTokens: string[],
    files: Array<{ path: string; content: string }>,
): TokenUsageSummary {
    const frequency = scanTokenUsage(files);
    const orphans = findOrphanTokens(definedTokens, frequency);
    const unregistered = findUnregisteredTokens(definedTokens, frequency);

    return {
        totalUsed: frequency.length,
        totalDefined: definedTokens.length,
        orphans,
        unregistered,
        frequency,
    };
}
