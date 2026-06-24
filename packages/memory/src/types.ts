import type { MemoryEntry } from './chroma.js';

export type MemoryTier = 'working' | 'mid-term' | 'long-term';

export interface TieredMemoryEntry extends MemoryEntry {
    tier: MemoryTier;
    consolidatedAt?: string;
    archivedAt?: string;
    signalScore?: number;
}
