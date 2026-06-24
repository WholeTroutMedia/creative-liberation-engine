/**
 * Qdrant RAG Retriever — Project-Scoped
 *
 * Genkit retriever for semantic search against Qdrant.
 * 
 * Constitutional: Article X (Compound Learning), Article XX (Zero Day GTM)
 */

import { z } from 'genkit';
import { ai, LOCAL_MODEL_IDS } from '../index.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const QDRANT_URL = process.env.QDRANT_URL || 'http://127.0.0.1:6333';
const OLLAMA_HOST = process.env.OLLAMA_HOST && process.env.OLLAMA_HOST !== '0.0.0.0' 
    ? process.env.OLLAMA_HOST 
    : 'http://127.0.0.1:11434';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get embeddings directly from Ollama REST API */
async function getEmbedding(text: string): Promise<number[]> {
    const res = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: LOCAL_MODEL_IDS.embed || 'nomic-embed-text',
            prompt: text
        })
    });
    
    if (!res.ok) {
        throw new Error(`Ollama embedding failed: ${res.status}`);
    }
    
    const data: any = await res.json();
    return data.embedding;
}

// ---------------------------------------------------------------------------
// Retriever
// ---------------------------------------------------------------------------

export const qdrantRetriever = ai.defineRetriever(
    {
        name: 'cle/qdrant',
        configSchema: z.object({
            collection: z.string().describe('Qdrant collection name to search'),
            limit: z.number().default(10).describe('Number of results to retrieve'),
            scoreThreshold: z.number().optional().describe('Minimum similarity score'),
            filter: z.record(z.unknown()).optional().describe('Optional Qdrant filter condition'),
        }),
    },
    async (query, config) => {
        const limit = config?.limit ?? 10;
        const queryText = typeof query === 'string' ? query : query.text;
        const collectionName = config?.collection;

        if (!collectionName) {
            console.warn(`[QDRANT] Missing collection name in retriever config`);
            return { documents: [] };
        }

        try {
            // 1. Embed query text
            const vector = await getEmbedding(queryText);

            // 2. Build Qdrant Search payload
            const body: any = {
                vector: vector,
                limit: limit,
                with_payload: true,
            };

            if (config?.scoreThreshold) {
                body.score_threshold = config.scoreThreshold;
            }

            if (config?.filter) {
                body.filter = config.filter;
            }

            // 3. Search Qdrant
            const searchRes = await fetch(
                `${QDRANT_URL}/collections/${collectionName}/points/search`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }
            );

            if (!searchRes.ok) {
                const errText = await searchRes.text();
                console.warn(`[QDRANT] Query failed on "${collectionName}": ${searchRes.status} - ${errText}`);
                return { documents: [] };
            }

            const results = (await searchRes.json()) as any;
            const points = results.result || [];

            const documents = points.map((point: any) => {
                // Ensure payload has expected shape. Fallback to point.payload.text or JSON string
                const contentText = point.payload?.text || point.payload?.content || JSON.stringify(point.payload);
                return {
                    content: [{ text: contentText }],
                    metadata: {
                        id: point.id,
                        score: point.score,
                        collection: collectionName,
                        ...(point.payload || {}),
                    },
                };
            });

            console.log(
                `[QDRANT] 📖 ${documents.length} docs from "${collectionName}" for: "${queryText?.slice(0, 50)}..."`
            );
            
            return { documents };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(`[QDRANT] Connection/Search failed: ${msg}`);
            return { documents: [] };
        }
    }
);
