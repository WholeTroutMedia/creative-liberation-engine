/**
 * Knowledge Fabric Genkit Tools
 *
 * Exposes the WS-2 Post-RAG Knowledge Fabric to the Genkit agent framework.
 * Agents can: ingest pointers, compile knowledge, and query compiled contexts.
 */

import { ai, z } from '../ai.js';
import { KnowledgeFabric, ScholarHiveBridge } from '@cle/memory/knowledge-fabric';

// Singleton fabric instance
let _fabric: KnowledgeFabric | null = null;
function getFabric(): KnowledgeFabric {
  if (!_fabric) {
    _fabric = new KnowledgeFabric({
      qdrantUrl: process.env.QDRANT_URL || 'http://127.0.0.1:6333',
    });
  }
  return _fabric;
}

// ─── Compile Knowledge Tool ──────────────────────────────────────────────────

export const compileKnowledgeTool = ai.defineTool(
  {
    name: 'compileKnowledge',
    description:
      'Compile multiple knowledge sources into a pre-synthesized CompiledContext record. ' +
      'This creates a citation-linked, temporally-valid knowledge artifact that agents can ' +
      'consume directly without runtime RAG retrieval.',
    inputSchema: z.object({
      domain: z.enum(['academy', 'tech', 'strategy', 'operations', 'creative', 'spatial', 'legal', 'finance']),
      query: z.string().describe('The knowledge query to compile sources for'),
      maxSources: z.number().optional().default(10).describe('Maximum source documents to include'),
    }),
    outputSchema: z.object({
      contextId: z.string(),
      synthesizedText: z.string(),
      citationCount: z.number(),
      confidence: z.number(),
      validUntil: z.string(),
    }),
  },
  async (input) => {
    const fabric = getFabric();

    // This would use a real embedding in production
    const mockEmbedding = new Array(768).fill(0).map(() => Math.random());

    const pointers = await fabric.retrievePointers(mockEmbedding, {
      domain: input.domain,
      limit: input.maxSources,
    });

    if (pointers.length === 0) {
      return {
        contextId: 'ctx_empty',
        synthesizedText: 'No relevant sources found for compilation.',
        citationCount: 0,
        confidence: 0,
        validUntil: new Date().toISOString(),
      };
    }

    const compiled = await fabric.compile(
      { domain: input.domain, query: input.query, maxSources: input.maxSources },
      pointers,
      async (prompt: string) => {
        // In production, this calls the compilation model (gemini-2.5-pro)
        // For now, return a structured placeholder that the orchestrator fills
        return `[COMPILATION PENDING] Query: ${input.query} | Sources: ${pointers.length}`;
      }
    );

    return {
      contextId: compiled.contextId,
      synthesizedText: compiled.synthesizedText,
      citationCount: compiled.citations.length,
      confidence: compiled.confidence,
      validUntil: compiled.validUntil,
    };
  }
);

// ─── Query Compiled Context Tool ─────────────────────────────────────────────

export const queryCompiledContextTool = ai.defineTool(
  {
    name: 'queryCompiledContext',
    description:
      'Query pre-compiled knowledge from the Knowledge Fabric. ' +
      'Returns pre-synthesized, citation-linked knowledge without runtime RAG overhead. ' +
      'Falls through to raw ProxyPointer retrieval if no compiled context exists.',
    inputSchema: z.object({
      domain: z.enum(['academy', 'tech', 'strategy', 'operations', 'creative', 'spatial', 'legal', 'finance']),
      query: z.string().describe('Natural language knowledge query'),
    }),
    outputSchema: z.object({
      hasCompiled: z.boolean(),
      compiledCount: z.number(),
      synthesizedTexts: z.array(z.string()),
      needsCompilation: z.boolean(),
      fallthroughCount: z.number(),
    }),
  },
  async (input) => {
    const fabric = getFabric();
    const bridge = new ScholarHiveBridge(fabric);

    const mockEmbedding = new Array(768).fill(0).map(() => Math.random());

    const result = await bridge.retrieve(mockEmbedding, input.domain);

    return {
      hasCompiled: result.compiled.length > 0,
      compiledCount: result.compiled.length,
      synthesizedTexts: result.compiled.map((c) => c.synthesizedText),
      needsCompilation: result.needsCompilation,
      fallthroughCount: result.fallthrough.length,
    };
  }
);

// ─── Find Stale Knowledge Tool ───────────────────────────────────────────────

export const findStaleKnowledgeTool = ai.defineTool(
  {
    name: 'findStaleKnowledge',
    description:
      'Identify CompiledContext records that have expired and need recompilation. ' +
      'Use this to maintain knowledge freshness proactively.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      staleContextIds: z.array(z.string()),
      count: z.number(),
    }),
  },
  async () => {
    const fabric = getFabric();
    const stale = await fabric.findStaleContexts();
    return { staleContextIds: stale, count: stale.length };
  }
);
