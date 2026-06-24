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

const CHROMA_URL = process.env['CHROMA_URL'] ?? 'http://localhost:8000';
const EMBED_URL = process.env['OLLAMA_URL'] ?? 'http://192.168.2.20:11434';

class OllamaEmbeddingFunction {
    async generate(texts: string[]): Promise<number[][]> {
        const embeddings: number[][] = [];
        for (const text of texts) {
            const res = await fetch(`${EMBED_URL}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
            });
            if (!res.ok) throw new Error(`Embedding failed: ${res.statusText}`);
            const data = await res.json() as { embedding: number[] };
            embeddings.push(data.embedding);
        }
        return embeddings;
    }
}

export class ChromaMemoryClient {
    public client: ChromaClient;
    private embedFn: OllamaEmbeddingFunction;
    private collections = new Map<string, Collection>();

    constructor() {
        // Use CHROMA_URL directly
        this.client = new ChromaClient({ path: CHROMA_URL });
        this.embedFn = new OllamaEmbeddingFunction();
    }

    public async getCollection(agentName: string, tier: string = 'mid-term'): Promise<Collection> {
        const safeAgent = agentName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const key = `${safeAgent}_${tier.toLowerCase()}`;
        if (this.collections.has(key)) return this.collections.get(key)!;

        const collection = await this.client.getOrCreateCollection({
            name: `cle_${key}`,
            embeddingFunction: this.embedFn,
            metadata: {
                description: `Memory episodes for ${agentName} (${tier})`,
                agent: agentName,
                tier: tier,
                created: new Date().toISOString(),
            },
        });

        this.collections.set(key, collection);
        return collection;
    }

    async persist(entry: MemoryEntry & { metadata?: any }): Promise<void> {
        try {
            const tier = entry.metadata?.tier ?? 'mid-term';
            const collection = await this.getCollection(entry.agentName, tier);
            const document = `Task: ${entry.task}\nOutcome: ${entry.outcome}${entry.pattern ? `\nPattern: ${entry.pattern}` : ''}`;

            await collection.upsert({
                ids: [entry.id],
                documents: [document],
                metadatas: [{
                    agentName: entry.agentName,
                    timestamp: entry.timestamp,
                    task: entry.task.slice(0, 500),
                    outcome: entry.outcome.slice(0, 500),
                    pattern: entry.pattern ?? '',
                    tags: entry.tags.join(','),
                    sessionId: entry.sessionId,
                    success: String(entry.success),
                    durationMs: String(entry.durationMs ?? 0),
                }],
            });

            console.log(`[CHROMA] 💾 ${entry.agentName} → cle_${entry.agentName.toLowerCase()} | ${entry.id.slice(0, 8)}`);
        } catch (err) {
            console.warn(`[CHROMA] ⚠️ Persist failed: ${String(err).slice(0, 100)}`);
        }
    }

    async recall(agentName: string, query: string, nResults = 5, category?: string, tags?: string[]): Promise<MemoryEntry[]> {
        try {
            const tier = category ?? 'mid-term';
            const collection = await this.getCollection(agentName, tier);
            const count = await collection.count();
            if (count === 0) return [];

            const conditions: any[] = [];
            if (tags && tags.length > 0) {
                for (const t of tags) conditions.push({ tags: { $contains: t } });
            }

            let where: any = undefined;
            if (conditions.length === 1) {
                where = conditions[0];
            } else if (conditions.length > 1) {
                where = { $and: conditions };
            }

            const results = await collection.query({
                queryTexts: [query],
                nResults: Math.min(nResults, count),
                ...(where ? { where } : {}),
            });

            return (results.metadatas[0] ?? []).map((meta: any, i: number) => ({
                id: String(results.ids[0]?.[i] ?? ''),
                agentName: String(meta?.['agentName'] ?? agentName),
                timestamp: String(meta?.['timestamp'] ?? ''),
                task: String(meta?.['task'] ?? ''),
                outcome: String(meta?.['outcome'] ?? ''),
                pattern: meta?.['pattern'] ? String(meta['pattern']) : undefined,
                tags: String(meta?.['tags'] ?? '').split(',').filter(Boolean),
                sessionId: String(meta?.['sessionId'] ?? ''),
                success: meta?.['success'] === 'true',
                durationMs: Number(meta?.['durationMs'] ?? 0),
            }));
        } catch {
            return [];
        }
    }

    async crossAgentRecall(excludeAgent: string, query: string, nResults = 3, category?: string, tags?: string[]): Promise<MemoryEntry[]> {
        const tier = category ?? 'mid-term';
        const allAgents = [
            'AURORA', 'BOLT', 'COMET', 'VERA', 'IRIS', 'KEEPER',
            'ARCH', 'CODEX', 'LEX', 'COMPASS', 'RELAY', 'SENTINEL',
            'ATLAS', 'OMNIMEDIA',
        ].filter(a => a !== excludeAgent);

        const crossResults = await Promise.allSettled(
            allAgents.map(agent => this.recall(agent, query, 2, category, tags))
        );

        return crossResults
            .filter((r): r is PromiseFulfilledResult<MemoryEntry[]> => r.status === 'fulfilled')
            .flatMap(r => r.value)
            .slice(0, nResults);
    }

    async isOnline(): Promise<boolean> {
        try {
            await this.client.heartbeat();
            return true;
        } catch {
            return false;
        }
    }
}

export const chromaMemory = new ChromaMemoryClient();
