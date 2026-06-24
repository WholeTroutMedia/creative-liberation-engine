import Database from 'better-sqlite3';
import pino from 'pino';

const logger = pino({ name: 'qdrant-spine' });

const QDRANT_URL = process.env.QDRANT_URL || 'http://127.0.0.1:6333';
const isMockMode = process.env.QDRANT_MOCK === 'true';

let qdrantOnline = false;

// We initialize the SQLite backup database connection
let db: Database.Database;

export function initQdrantSpine(sqliteDb: Database.Database) {
    db = sqliteDb;
    db.exec(`
        CREATE TABLE IF NOT EXISTS crdt_vectors (
            vector_id TEXT PRIMARY KEY,
            doc_id TEXT NOT NULL,
            collection TEXT NOT NULL,
            vector_json TEXT NOT NULL,
            payload_json TEXT NOT NULL
        );
    `);
    logger.info('Sovereign SQLite Vector storage table initialized.');
    checkQdrantStatus();
}

async function checkQdrantStatus(): Promise<boolean> {
    if (isMockMode) {
        qdrantOnline = false;
        return false;
    }
    try {
        const res = await fetch(`${QDRANT_URL}/telemetry`, { signal: AbortSignal.timeout(2000) });
        qdrantOnline = res.ok;
    } catch {
        qdrantOnline = false;
    }
    return qdrantOnline;
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 1. Initialize Collection
export async function initializeCollection(collectionName: string, vectorSize: number = 1536): Promise<boolean> {
    await checkQdrantStatus();
    
    if (!qdrantOnline) {
        logger.warn({ collectionName }, 'Qdrant offline or mock active. Collection initialized in Local SQLite fallback mode.');
        return true;
    }

    try {
        const res = await fetch(`${QDRANT_URL}/collections/${collectionName}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vectors: {
                    size: vectorSize,
                    distance: 'Cosine'
                }
            })
        });
        const data = await res.json() as any;
        logger.info({ collectionName, success: res.ok, data }, 'Qdrant collection setup executed.');
        return res.ok;
    } catch (err: any) {
        logger.error(err, `Failed to setup collection '${collectionName}' in Qdrant. Falling back locally.`);
        return true;
    }
}

// 2. Insert Vector Point
export async function insertVector(
    vectorId: string,
    docId: string,
    collection: string,
    vector: number[],
    payload: Record<string, any>
): Promise<boolean> {
    // Audit vector locally inside secure SQLite database
    try {
        const stmt = db.prepare(`
            INSERT INTO crdt_vectors (vector_id, doc_id, collection, vector_json, payload_json)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(vector_id) DO UPDATE SET
                vector_json = excluded.vector_json,
                payload_json = excluded.payload_json
        `);
        stmt.run(vectorId, docId, collection, JSON.stringify(vector), JSON.stringify(payload));
    } catch (err: any) {
        logger.error(err, 'Failed to save vector to SQLite backup');
    }

    await checkQdrantStatus();
    if (!qdrantOnline) {
        logger.info({ vectorId }, 'Saved vector locally (Qdrant offline).');
        return true;
    }

    try {
        const res = await fetch(`${QDRANT_URL}/collections/${collection}/points?wait=true`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                points: [{
                    id: vectorId,
                    vector,
                    payload: {
                        doc_id: docId,
                        ...payload
                    }
                }]
            })
        });
        return res.ok;
    } catch (err: any) {
        logger.warn(err, `Failed to replicate vector point ${vectorId} to Qdrant. Cached in SQLite fallback.`);
        return true;
    }
}

// 3. Search Vector Points
export async function searchVectors(
    collection: string,
    queryVector: number[],
    limit: number = 10
): Promise<any[]> {
    await checkQdrantStatus();

    if (qdrantOnline) {
        try {
            const res = await fetch(`${QDRANT_URL}/collections/${collection}/points/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vector: queryVector,
                    limit,
                    with_payload: true
                })
            });
            if (res.ok) {
                const data = await res.json() as any;
                return (data.result || []).map((p: any) => ({
                    id: p.id,
                    score: p.score,
                    payload: p.payload,
                    source: 'qdrant'
                }));
            }
        } catch (err: any) {
            logger.warn(err, 'Qdrant search fetch failed. Switching automatically to local SQLite fallback.');
        }
    }

    // High-Reliability Local Cosine Similarity Fallback Engine
    logger.info({ collection }, 'Executing local SQLite-based cosine similarity search...');
    try {
        const localVectors = db.prepare('SELECT * FROM crdt_vectors WHERE collection = ?').all(collection) as any[];
        const results = localVectors.map(item => {
            const vec = JSON.parse(item.vector_json) as number[];
            const pay = JSON.parse(item.payload_json);
            const score = cosineSimilarity(queryVector, vec);
            return {
                id: item.vector_id,
                score,
                payload: {
                    doc_id: item.doc_id,
                    ...pay
                },
                source: 'sqlite_fallback'
            };
        });

        // Sort descending by score, limit results
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    } catch (err: any) {
        logger.error(err, 'Local SQLite vector search failed');
        return [];
    }
}
