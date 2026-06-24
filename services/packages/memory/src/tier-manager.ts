/**
 * MemoryTierManager — Tiered Memory Architecture (Direction 02: Memory Card)
 * packages/memory/src/tier-manager.ts
 *
 * Adds a three-tier hierarchy on top of the existing MemoryBus:
 *
 *   working   → In-process Map + JSONL    TTL: 24h   Fidelity: full
 *   mid-term  → ChromaDB (NAS)            TTL: 90d   Fidelity: signal-only (post-consolidation)
 *   long-term → VAULT JSONL + git commit  TTL: ∞     Fidelity: pattern-indexed
 *
 * The REM consolidation job (genkit/src/flows/rem-consolidation.ts) calls
 * promote() nightly to move entries up the tier stack based on signal score.
 *
 * All writes are still forwarded through MemoryBus.commit() so ChromaDB and
 * JSONL fan-out continue to work. The tier field is stored as metadata.
 */

import { memoryBus } from './bus.js';
import type { MemoryEntry, MemoryWrite } from './bus.js';
import { chromaMemory } from './chroma.js';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type MemoryTier = 'working' | 'mid-term' | 'long-term';

export interface TieredMemoryEntry extends MemoryEntry {
    /** Memory tier at time of last promotion */
    tier: MemoryTier;
    /** ISO8601 — set when promoted from working → mid-term by consolidation job */
    consolidatedAt?: string;
    /** ISO8601 — set when promoted from mid-term → long-term */
    archivedAt?: string;
    /**
     * Signal score 0-1 assigned by the REM consolidation job.
     * Higher = more semantically unique + important.
     * Entries below threshold are pruned during consolidation.
     */
    signalScore?: number;
}

export interface TieredMemoryWrite extends MemoryWrite {
    tier?: MemoryTier; // defaults to 'working'
    signalScore?: number;
}

export interface TierRecallOptions {
    query: string;
    tier?: MemoryTier;
    agentName?: string;
    limit?: number;
    successOnly?: boolean;
}

export interface PromoteOptions {
    /** New tier to promote to */
    toTier: MemoryTier;
    /** Signal score to record on the promoted entry */
    signalScore?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKING TIER CACHE (in-process)
// Keyed by entry ID. Entries older than TTL_MS are evicted on next LRU sweep.
// ─────────────────────────────────────────────────────────────────────────────

const WORKING_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface WorkingEntry {
    entry: TieredMemoryEntry;
    expiresAt: number;
}

class WorkingTierCache {
    private map: Map<string, WorkingEntry> = new Map();

    set(entry: TieredMemoryEntry): void {
        this.map.set(entry.id, {
            entry,
            expiresAt: Date.now() + WORKING_TTL_MS,
        });
    }

    get(id: string): TieredMemoryEntry | undefined {
        const item = this.map.get(id);
        if (!item) return undefined;
        if (Date.now() > item.expiresAt) {
            this.map.delete(id);
            return undefined;
        }
        return item.entry;
    }

    all(): TieredMemoryEntry[] {
        const now = Date.now();
        const alive: TieredMemoryEntry[] = [];
        for (const [id, item] of this.map) {
            if (now > item.expiresAt) {
                this.map.delete(id);
            } else {
                alive.push(item.entry);
            }
        }
        return alive;
    }

    /** Drain all entries older than ageMs. Returns evicted entries. */
    evictOlderThan(ageMs: number): TieredMemoryEntry[] {
        const cutoff = Date.now() - ageMs;
        const evicted: TieredMemoryEntry[] = [];
        for (const [id, item] of this.map) {
            const entryTs = new Date(item.entry.timestamp).getTime();
            if (entryTs < cutoff) {
                evicted.push(item.entry);
                this.map.delete(id);
            }
        }
        return evicted;
    }

    size(): number {
        return this.map.size;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MemoryTierManager
// ─────────────────────────────────────────────────────────────────────────────

export class MemoryTierManager {
    private workingCache = new WorkingTierCache();

    // ── Write ────────────────────────────────────────────────────────────────

    /**
     * Write a memory entry.
     * Always routes through MemoryBus.commit() for JSONL + ChromaDB fan-out.
     * Additionally places the entry in the working tier cache for fast recall.
     *
     * @param write - Standard MemoryWrite fields + optional tier override.
     * @returns The committed TieredMemoryEntry.
     */
    async write(write: TieredMemoryWrite): Promise<TieredMemoryEntry> {
        const tier: MemoryTier = write.tier ?? 'working';

        // Persist via existing MemoryBus (JSONL + ChromaDB)
        const base = await memoryBus.commit({
            ...write,
            metadata: {
                ...(write.metadata ?? {}),
                tier,
                signalScore: write.signalScore ?? null,
            },
        });

        const tiered: TieredMemoryEntry = {
            ...base,
            tier,
            signalScore: write.signalScore,
        };

        // Cache working-tier entries in-process for sub-millisecond recall
        if (tier === 'working') {
            this.workingCache.set(tiered);
        }

        console.log(`[TIER-MGR] write tier=${tier} id=${tiered.id} agent=${write.agentName}`);
        return tiered;
    }

    // ── Recall ───────────────────────────────────────────────────────────────

    /**
     * Recall memory entries, optionally scoped to a specific tier.
     *
     * - working  → working cache first, falls back to memoryBus.recall()
     * - mid-term → memoryBus.recall() with tier metadata filter
     * - long-term → memoryBus.recall() with tier metadata filter
     * - undefined → memoryBus.recall() across all tiers
     */
    async recall(opts: TierRecallOptions): Promise<TieredMemoryEntry[]> {
        const { query, tier, agentName, limit = 10, successOnly = false } = opts;

        // Working tier fast path: check in-process cache first
        if (tier === 'working') {
            const cached = this.workingCache.all();
            const queryLower = query.toLowerCase();
            const matched = cached
                .filter(e => {
                    if (successOnly && !e.success) return false;
                    if (agentName && e.agentName !== agentName) return false;
                    const text = `${e.task} ${e.outcome}`.toLowerCase();
                    return queryLower.split(/\s+/).some(w => w.length > 2 && text.includes(w));
                })
                .slice(0, limit);

            if (matched.length > 0) {
                console.log(`[TIER-MGR] working cache hit: ${matched.length} entries`);
                return matched;
            }
        }

        // All other tiers go through memoryBus vector recall
        const raw = await memoryBus.recall({
            query,
            agentName,
            limit,
            successOnly,
            category: tier ? undefined : undefined, // future: tier-specific chroma collection
        });

        // Client-side tier filter (until ChromaDB multi-collection routing is in place)
        const filtered = raw.filter(e => {
            if (!tier) return true;
            const meta = (e as any).metadata ?? {};
            return meta.tier === tier;
        });

        return filtered.map(e => ({
            ...e,
            tier: (((e as any).metadata?.tier) ?? 'working') as MemoryTier,
            signalScore: (e as any).metadata?.signalScore ?? undefined,
        }));
    }

    // ── Promote ──────────────────────────────────────────────────────────────

    /**
     * Promote an existing entry to a higher memory tier.
     * Called by the REM consolidation job — not typically called directly.
     *
     * Writes a new entry at the target tier with updated metadata.
     * The original working-tier cache entry is evicted.
     *
     * @param sourceEntry - The entry to promote (must have a valid id).
     * @param opts - Target tier + optional signal score.
     */
    async promote(
        sourceEntry: TieredMemoryEntry,
        opts: PromoteOptions,
    ): Promise<TieredMemoryEntry> {
        const now = new Date().toISOString();
        const promoted: TieredMemoryEntry = {
            ...sourceEntry,
            tier: opts.toTier,
            signalScore: opts.signalScore ?? sourceEntry.signalScore,
            consolidatedAt: opts.toTier === 'mid-term' ? now : sourceEntry.consolidatedAt,
            archivedAt: opts.toTier === 'long-term' ? now : sourceEntry.archivedAt,
        };

        // Write promoted entry via MemoryBus with updated metadata
        await memoryBus.commit({
            agentName: sourceEntry.agentName,
            task: sourceEntry.task,
            outcome: sourceEntry.outcome,
            tags: [...(sourceEntry.tags ?? []), `tier:${opts.toTier}`],
            sessionId: sourceEntry.sessionId,
            success: sourceEntry.success,
            metadata: {
                tier: opts.toTier,
                signalScore: promoted.signalScore ?? null,
                consolidatedAt: promoted.consolidatedAt ?? null,
                archivedAt: promoted.archivedAt ?? null,
                promotedFromId: sourceEntry.id,
            },
        });

        // Evict from working cache
        this.workingCache.evictOlderThan(0); // will naturally fall out — no explicit delete needed

        console.log(
            `[TIER-MGR] promote ${sourceEntry.id} → ${opts.toTier}` +
            (opts.signalScore !== undefined ? ` signal=${opts.signalScore.toFixed(2)}` : ''),
        );
        return promoted;
    }

    // ── Stats ────────────────────────────────────────────────────────────────

    /** Returns working-tier entry count (in-process cache only). */
    workingCacheSize(): number {
        return this.workingCache.size();
    }

    /**
     * Drain all working-tier entries older than the given age in milliseconds.
     * Used by the REM consolidation job to enumerate entries that need processing.
     *
     * @param ageMs - Minimum age of entries to drain. Default: 24h.
     */
    drainWorking(ageMs: number = WORKING_TTL_MS): TieredMemoryEntry[] {
        return this.workingCache.evictOlderThan(ageMs);
    }

    /**
     * Scan ChromaDB mid-term collections for entries older than ageMs.
     * Used by the REM consolidation job Step 6 to find long-term archival candidates.
     *
     * @param ageMs - Minimum age of mid-term entries to return (default: 90 days).
     * @param agents - Agent roster to scan. Defaults to the 14 known GENESIS agents.
     * @returns Tiered entries from mid-term collections older than the threshold.
     */
    async drainMidTermOlderThan(
        ageMs: number = 90 * 24 * 60 * 60 * 1000,
        agents: string[] = [
            'AURORA', 'BOLT', 'COMET', 'VERA', 'IRIS', 'KEEPER',
            'ARCH', 'CODEX', 'LEX', 'COMPASS', 'RELAY', 'SENTINEL',
            'ATLAS', 'OMNIMEDIA',
        ],
    ): Promise<TieredMemoryEntry[]> {
        const cutoff = Date.now() - ageMs;
        const candidates: TieredMemoryEntry[] = [];

        await Promise.allSettled(
            agents.map(async (agentName) => {
                try {
                    // Use a broad semantic query to pull mid-term entries for this agent
                    const entries = await chromaMemory.recall(agentName, 'pattern decision learning', 100, 'mid-term');
                    for (const entry of entries) {
                        // Filter by consolidatedAt timestamp (set by promote() when moving to mid-term)
                        const consolidatedAtTs = (entry as any).metadata?.consolidatedAt
                            ? new Date((entry as any).metadata.consolidatedAt).getTime()
                            : new Date(entry.timestamp).getTime();

                        if (consolidatedAtTs < cutoff) {
                            candidates.push({
                                ...entry,
                                tier: 'mid-term',
                                signalScore: (entry as any).metadata?.signalScore ?? undefined,
                                consolidatedAt: (entry as any).metadata?.consolidatedAt ?? undefined,
                            });
                        }
                    }
                } catch (err) {
                    console.warn(`[TIER-MGR] drainMidTermOlderThan: ${agentName} failed — ${(err as Error).message}`);
                }
            }),
        );

        console.log(`[TIER-MGR] drainMidTermOlderThan: found ${candidates.length} long-term candidates across ${agents.length} agents`);
        return candidates;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

export const memoryTierManager = new MemoryTierManager();
