/**
 * ChromaDB Memory Provider for Creative Liberation Engine V6
 * Replaces/augments the JSONL-based MemoryBus with vector search.
 */
import { ChromaClient, type Collection } from 'chromadb';
export interface MemoryEntry {
    id: string;
    agentName: string;
    timestamp: string;
    task: string;
    outcome: string;
    pattern?: string;
    tags: string[];
    sessionId: string;
    success: boolean;
    durationMs?: number;
}
export declare class ChromaMemoryClient {
    client: ChromaClient;
    private embedFn;
    private collections;
    constructor();
    getCollection(agentName: string, tier?: string): Promise<Collection>;
    persist(entry: MemoryEntry & {
        metadata?: any;
    }): Promise<void>;
    recall(agentName: string, query: string, nResults?: number, category?: string, tags?: string[]): Promise<MemoryEntry[]>;
    crossAgentRecall(excludeAgent: string, query: string, nResults?: number, category?: string, tags?: string[]): Promise<MemoryEntry[]>;
    isOnline(): Promise<boolean>;
}
export declare const chromaMemory: ChromaMemoryClient;
