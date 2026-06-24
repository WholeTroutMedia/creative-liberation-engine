import { RagRouter } from './RagRouter.js';

const EMBED_URL = process.env['OLLAMA_URL'] ?? 'http://192.168.2.20:11434';

/**
 * Generates an embedding for a string using local Ollama nomic-embed-text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${EMBED_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${res.statusText}`);
  const data = await res.json() as { embedding: number[] };
  return data.embedding;
}

/**
 * High-level function to ingest a proxy pointer document.
 */
export async function ingestDocumentAsProxyPointer(
  router: RagRouter,
  summary: string,
  canonicalUri: string,
  domain: string,
  tags: string[] = []
): Promise<void> {
  const embedding = await generateEmbedding(summary);
  router.ingestProxyPointer(summary, canonicalUri, domain, tags, embedding);
}
