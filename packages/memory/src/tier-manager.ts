import { MemoryBus } from './bus.mjs';
import { chromaMemory } from './chroma.js';
import type { TieredMemoryEntry, MemoryTier } from './types.js';
import * as path from 'path';

export class MemoryTierManager {
    private memoryDir: string;
    private bus: any;

    constructor() {
        this.memoryDir = process.env['MEMORY_DIR'] ?? path.join(process.cwd(), 'runtime/memory');
        this.bus = new MemoryBus(this.memoryDir);
    }

    /**
     * Drains working-tier entries from sessions.index.json older than minAgeMs.
     * Draining means we extract them and remove them from sessions.index.json.
     */
    public drainWorking(minAgeMs: number): TieredMemoryEntry[] {
        try {
            const data = this.bus.loadCollection('sessions');
            if (!data || !data.entries) return [];

            const now = Date.now();
            const drained: TieredMemoryEntry[] = [];
            const remaining: any[] = [];

            for (const entry of data.entries) {
                // If it doesn't have a timestamp, or it's not working tier, keep it
                const timestamp = entry.timestamp || entry.createdAt;
                const isWorking = entry.retentionClass === 'working' || !entry.retentionClass;
                
                if (isWorking && timestamp) {
                    const age = now - new Date(timestamp).getTime();
                    if (age >= minAgeMs) {
                        drained.push({
                            ...entry,
                            tier: 'working'
                        });
                        continue;
                    }
                }
                remaining.push(entry);
            }

            // Save the remaining entries back to sessions.index.json
            data.entries = remaining;
            this.bus.saveCollection('sessions', data);

            return drained;
        } catch (err) {
            console.error(`[MemoryTierManager] drainWorking failed: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }
    }

    /**
     * Promotes a memory entry to a target tier.
     * If promoting to mid-term or long-term, persists in ChromaDB.
     * If promoting to long-term, also deletes from the mid-term ChromaDB collection.
     */
    public async promote(entry: TieredMemoryEntry, opts: { toTier: MemoryTier; signalScore: number }): Promise<void> {
        try {
            const promotedEntry = {
                ...entry,
                tier: opts.toTier,
                signalScore: opts.signalScore,
                ...(opts.toTier === 'mid-term' ? { consolidatedAt: new Date().toISOString() } : {}),
                ...(opts.toTier === 'long-term' ? { archivedAt: new Date().toISOString() } : {})
            };

            // 1. Persist to the new tier in ChromaDB
            await chromaMemory.persist({
                ...promotedEntry,
                metadata: {
                    tier: opts.toTier,
                    signalScore: String(opts.signalScore),
                    ...(promotedEntry.consolidatedAt ? { consolidatedAt: promotedEntry.consolidatedAt } : {}),
                    ...(promotedEntry.archivedAt ? { archivedAt: promotedEntry.archivedAt } : {})
                }
            });

            // 2. If promoting to long-term, delete from mid-term
            if (opts.toTier === 'long-term') {
                const midTermCollection = await chromaMemory.getCollection(entry.agentName, 'mid-term');
                await midTermCollection.delete({ ids: [entry.id] });
                console.log(`[MemoryTierManager] Deleted entry ${entry.id} from mid-term collection for agent ${entry.agentName}`);
            }
        } catch (err) {
            console.error(`[MemoryTierManager] promote failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Drains mid-term memories older than midTermAgeMs from all agent collections.
     * It scans ChromaDB for all mid-term collections, fetches all entries,
     * filters by age, and returns them.
     */
    public async drainMidTermOlderThan(midTermAgeMs: number): Promise<TieredMemoryEntry[]> {
        const candidates: TieredMemoryEntry[] = [];
        try {
            const collections = await chromaMemory.client.listCollections();
            const now = Date.now();

            for (const col of collections) {
                const colName = typeof col === 'string' ? col : (col as any)?.name;
                if (colName && colName.startsWith('cle_') && colName.endsWith('_mid-term')) {
                    // Extract agent name
                    const parts = colName.split('_');
                    // "cle", agentName, "mid-term"
                    const agentName = parts.slice(1, parts.length - 1).join('_');
                    
                    const collection = await chromaMemory.client.getCollection({
                        name: colName,
                        embeddingFunction: (chromaMemory as any).embedFn
                    });
                    const results = await collection.get();
                    if (!results || !results.ids) continue;

                    for (let i = 0; i < results.ids.length; i++) {
                        const id = results.ids[i];
                        const meta = results.metadatas[i];
                        
                        const timestamp = meta?.timestamp;
                        if (timestamp) {
                            const age = now - new Date(timestamp as string).getTime();
                            if (age >= midTermAgeMs) {
                                candidates.push({
                                    id,
                                    agentName: (meta.agentName as string) || agentName,
                                    timestamp: String(timestamp),
                                    task: (meta.task as string) || '',
                                    outcome: (meta.outcome as string) || '',
                                    pattern: (meta.pattern as string) || undefined,
                                    tags: meta.tags ? String(meta.tags).split(',').filter(Boolean) : [],
                                    sessionId: (meta.sessionId as string) || '',
                                    success: meta.success === 'true',
                                    durationMs: meta.durationMs ? Number(meta.durationMs) : undefined,
                                    tier: 'mid-term',
                                    signalScore: meta.signalScore ? Number(meta.signalScore) : undefined,
                                    consolidatedAt: meta.consolidatedAt ? String(meta.consolidatedAt) : undefined
                                });
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error(`[MemoryTierManager] drainMidTermOlderThan failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        return candidates;
    }
}

export const memoryTierManager = new MemoryTierManager();
