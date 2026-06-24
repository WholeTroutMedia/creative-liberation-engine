import { VectorStore, MemoryEntry } from './VectorStore.js';

import fs from 'fs';

export class RagRouter {
  constructor(private readonly vectorStore: VectorStore) {}

  /**
   * Ingest a proxy pointer.
   * The actual chunking and semantic content is replaced by a high-level summary and the canonical URI.
   */
  ingestProxyPointer(
    summary: string,
    canonicalUri: string,
    domain: string,
    tags: string[],
    embedding: number[]
  ): MemoryEntry {
    return this.vectorStore.store({
      id: crypto.randomUUID(),
      type: 'proxy_pointer',
      content: summary,
      embedding,
      agentId: 'rag_ingestion',
      timestamp: new Date().toISOString(),
      tags: [...tags, domain],
      metadata: {
        canonicalUri,
        domain
      },
      importance: 1.0, // Proxy pointers are highly important facts
    });
  }

  /**
   * Retrieve exact documents via proxy pointers and fetch from the NAS.
   */
  async retrieveExactDocuments(
    queryEmbedding: number[],
    topK: number = 3,
    minImportance?: number
  ): Promise<{ summary: string; canonicalUri: string; content: string; score: number }[]> {
    const results = this.vectorStore.search(queryEmbedding, {
      topK,
      type: 'proxy_pointer',
      minImportance
    });

    const docs = [];
    for (const r of results) {
      const canonicalUri = r.entry.metadata.canonicalUri as string;
      let content = '';
      try {
        content = await fs.promises.readFile(canonicalUri, 'utf-8');
      } catch (err) {
        console.error(`[RAG ROUTER] Failed to read canonical document at ${canonicalUri}:`, err);
        content = 'Error reading exact document. Proxy pointer resolution failed.';
      }

      docs.push({
        summary: r.entry.content,
        canonicalUri,
        content,
        score: r.score
      });
    }

    return docs;
  }
}
