/**
 * ChromaDB Memory Provider for Creative Liberation Engine V6
 * Replaces/augments the JSONL-based MemoryBus with vector search.
 */
import { ChromaClient } from 'chromadb';
const CHROMA_URL = process.env['CHROMA_URL'] ?? 'http://localhost:8000';
const EMBED_URL = process.env['OLLAMA_URL'] ?? 'http://192.168.2.20:11434';
class OllamaEmbeddingFunction {
    async generate(texts) {
        const embeddings = [];
        for (const text of texts) {
            const res = await fetch(`${EMBED_URL}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
            });
            if (!res.ok)
                throw new Error(`Embedding failed: ${res.statusText}`);
            const data = await res.json();
            embeddings.push(data.embedding);
        }
        return embeddings;
    }
}
export class ChromaMemoryClient {
    client;
    embedFn;
    collections = new Map();
    constructor() {
        // Use CHROMA_URL directly
        this.client = new ChromaClient({ path: CHROMA_URL });
        this.embedFn = new OllamaEmbeddingFunction();
    }
    async getCollection(agentName, tier = 'mid-term') {
        const safeAgent = agentName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const key = `${safeAgent}_${tier.toLowerCase()}`;
        if (this.collections.has(key))
            return this.collections.get(key);
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
    async persist(entry) {
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
        }
        catch (err) {
            console.warn(`[CHROMA] ⚠️ Persist failed: ${String(err).slice(0, 100)}`);
        }
    }
    async recall(agentName, query, nResults = 5, category, tags) {
        try {
            const tier = category ?? 'mid-term';
            const collection = await this.getCollection(agentName, tier);
            const count = await collection.count();
            if (count === 0)
                return [];
            const conditions = [];
            if (tags && tags.length > 0) {
                for (const t of tags)
                    conditions.push({ tags: { $contains: t } });
            }
            let where = undefined;
            if (conditions.length === 1) {
                where = conditions[0];
            }
            else if (conditions.length > 1) {
                where = { $and: conditions };
            }
            const results = await collection.query({
                queryTexts: [query],
                nResults: Math.min(nResults, count),
                ...(where ? { where } : {}),
            });
            return (results.metadatas[0] ?? []).map((meta, i) => ({
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
        }
        catch {
            return [];
        }
    }
    async crossAgentRecall(excludeAgent, query, nResults = 3, category, tags) {
        const tier = category ?? 'mid-term';
        const allAgents = [
            'AURORA', 'BOLT', 'COMET', 'VERA', 'IRIS', 'KEEPER',
            'ARCH', 'CODEX', 'LEX', 'COMPASS', 'RELAY', 'SENTINEL',
            'ATLAS', 'OMNIMEDIA',
        ].filter(a => a !== excludeAgent);
        const crossResults = await Promise.allSettled(allAgents.map(agent => this.recall(agent, query, 2, category, tags)));
        return crossResults
            .filter((r) => r.status === 'fulfilled')
            .flatMap(r => r.value)
            .slice(0, nResults);
    }
    async isOnline() {
        try {
            await this.client.heartbeat();
            return true;
        }
        catch {
            return false;
        }
    }
}
export const chromaMemory = new ChromaMemoryClient();
