/**
 * Vectorization Hook — Auto-embeds Scholar Hive documents into Qdrant on save.
 * Connects to the EventBus and listens for doc:created and doc:updated events.
 */
import fs from 'fs';
import path from 'path';
import { EventBus } from './events.js';

const QDRANT_URL = process.env.QDRANT_URL || 'http://127.0.0.1:6333';
const COLLECTION = process.env.QDRANT_COLLECTION || 'scholar_hive';
const EMBEDDING_DIM = 384; // all-MiniLM-L6-v2 dimension
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const EMBED_MODEL = process.env.EMBED_MODEL || 'all-minilm';

interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, any>;
}

async function ensureCollection(): Promise<void> {
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`);
    if (res.status === 404) {
      await fetch(`${QDRANT_URL}/collections/${COLLECTION}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vectors: { size: EMBEDDING_DIM, distance: 'Cosine' },
        }),
      });
      console.log(`[Vectorize] Created Qdrant collection: ${COLLECTION}`);
    }
  } catch (err) {
    console.warn(`[Vectorize] Qdrant unavailable at ${QDRANT_URL} — vectorization will retry on next event.`);
  }
}

async function embed(text: string): Promise<number[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
    });
    const data = await res.json() as any;
    return data.embedding || [];
  } catch (err) {
    console.warn('[Vectorize] Ollama embedding failed, falling back to zero vector.');
    return new Array(EMBEDDING_DIM).fill(0);
  }
}

async function upsertPoint(doc: any): Promise<string | null> {
  const text = `${doc.title}\n\n${doc.content}`;
  const vector = await embed(text);

  if (vector.every((v: number) => v === 0)) {
    console.warn(`[Vectorize] Skipping ${doc.id} — zero vector (embedding service down).`);
    return null;
  }

  const pointId = doc.id.replace(/[^a-zA-Z0-9-]/g, '');
  try {
    await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [{
          id: pointId,
          vector,
          payload: {
            title: doc.title,
            document_type: doc.document_type,
            author: doc.author,
            tags: doc.tags,
            source: doc.source,
            created_at: doc.created_at,
            content_preview: doc.content?.slice(0, 500),
          },
        }],
      }),
    });
    console.log(`[Vectorize] Upserted ${doc.id} → Qdrant point ${pointId}`);
    return pointId;
  } catch (err) {
    console.warn(`[Vectorize] Failed to upsert ${doc.id}:`, err);
    return null;
  }
}

async function deletePoint(doc: any): Promise<void> {
  const pointId = doc.id.replace(/[^a-zA-Z0-9-]/g, '');
  try {
    await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: [pointId] }),
    });
    console.log(`[Vectorize] Deleted Qdrant point ${pointId}`);
  } catch (err) {
    console.warn(`[Vectorize] Failed to delete point ${pointId}:`, err);
  }
}

export async function semanticSearch(query: string, limit: number = 5): Promise<any[]> {
  const vector = await embed(query);
  if (vector.every((v: number) => v === 0)) return [];

  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vector, limit, with_payload: true }),
    });
    const data = await res.json() as any;
    return data.result || [];
  } catch (err) {
    console.warn('[Vectorize] Semantic search failed:', err);
    return [];
  }
}

export function initVectorization(eventBus: EventBus, dataDir: string): void {
  const DOCS_FILE = path.join(dataDir, 'docs.json');

  // Ensure collection exists on startup
  ensureCollection();

  // Hook into doc events
  eventBus.on('doc:created', async (doc: any) => {
    const ref = await upsertPoint(doc);
    if (ref) {
      // Update the doc's vector_reference in the JSON store
      try {
        const docs = JSON.parse(fs.readFileSync(DOCS_FILE, 'utf-8'));
        const idx = docs.findIndex((d: any) => d.id === doc.id);
        if (idx !== -1) {
          docs[idx].vector_reference = ref;
          fs.writeFileSync(DOCS_FILE, JSON.stringify(docs, null, 2));
        }
      } catch {}
    }
  });

  eventBus.on('doc:updated', async (doc: any) => {
    const ref = await upsertPoint(doc);
    if (ref) {
      try {
        const docs = JSON.parse(fs.readFileSync(DOCS_FILE, 'utf-8'));
        const idx = docs.findIndex((d: any) => d.id === doc.id);
        if (idx !== -1) {
          docs[idx].vector_reference = ref;
          fs.writeFileSync(DOCS_FILE, JSON.stringify(docs, null, 2));
        }
      } catch {}
    }
  });

  eventBus.on('doc:deleted', async (doc: any) => {
    await deletePoint(doc);
  });

  console.log('[Vectorize] Scholar Hive vectorization hooks initialized.');
}
