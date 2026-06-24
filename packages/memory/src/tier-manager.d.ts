import type { TieredMemoryEntry, MemoryTier } from './types.js';
export declare class MemoryTierManager {
    private memoryDir;
    private bus;
    constructor();
    /**
     * Drains working-tier entries from sessions.index.json older than minAgeMs.
     * Draining means we extract them and remove them from sessions.index.json.
     */
    drainWorking(minAgeMs: number): TieredMemoryEntry[];
    /**
     * Promotes a memory entry to a target tier.
     * If promoting to mid-term or long-term, persists in ChromaDB.
     * If promoting to long-term, also deletes from the mid-term ChromaDB collection.
     */
    promote(entry: TieredMemoryEntry, opts: {
        toTier: MemoryTier;
        signalScore: number;
    }): Promise<void>;
    /**
     * Drains mid-term memories older than midTermAgeMs from all agent collections.
     * It scans ChromaDB for all mid-term collections, fetches all entries,
     * filters by age, and returns them.
     */
    drainMidTermOlderThan(midTermAgeMs: number): Promise<TieredMemoryEntry[]>;
}
export declare const memoryTierManager: MemoryTierManager;
