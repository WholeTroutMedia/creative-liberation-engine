/**
 * Vector Store — ChromaDB integration for semantic memory search.
 *
 * Provides embedding-based retrieval over memory records.
 * Uses ChromaDB for storage and Ollama/Genkit for embeddings.
 */

import { getConfig } from '@cle/config';

export class VectorStore {
  constructor(opts = {}) {
    this.chromaUrl = opts.chromaUrl || getConfig('CHROMA_URL', 'http://localhost:8000');
    this.collectionName = opts.collection || 'cle_memory';
  }

  /** Index a memory record for semantic search. */
  async index(record, embedding) {
    const res = await fetch(`${this.chromaUrl}/api/v1/collections/${this.collectionName}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: [record.memoryId],
        embeddings: [embedding],
        metadatas: [{ kind: record.kind, provider: record.provider, title: record.title }],
        documents: [record.summary || record.title],
      }),
    });
    if (!res.ok) throw new Error(`ChromaDB index failed: ${res.status}`);
    return res.json();
  }

  /** Search for similar memory records. */
  async search(queryEmbedding, nResults = 5) {
    const res = await fetch(`${this.chromaUrl}/api/v1/collections/${this.collectionName}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query_embeddings: [queryEmbedding],
        n_results: nResults,
      }),
    });
    if (!res.ok) throw new Error(`ChromaDB search failed: ${res.status}`);
    return res.json();
  }
}

export async function search(queryEmbedding, nResults) {
  return new VectorStore().search(queryEmbedding, nResults);
}

export async function index(record, embedding) {
  return new VectorStore().index(record, embedding);
}
