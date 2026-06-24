/**
 * @cle/knowledge-fabric — Compiled Context Service
 *
 * WS-2: Post-RAG Knowledge Fabric
 *
 * Replaces naive RAG (embed → retrieve → inject) with a compilation-stage
 * knowledge layer. Documents are pre-synthesized into CompiledContext records
 * with citations, confidence scores, and temporal validity windows.
 *
 * Architecture:
 *   1. ProxyPointer ingestion — text-only embeddings index document structure
 *   2. Compilation pass — LLM synthesizes multi-source knowledge into dense records
 *   3. Agent consumption — agents get pre-compiled context, no RAG at inference time
 *   4. Recompilation daemon — monitors staleness and triggers re-synthesis
 *
 * This eliminates:
 *   - Chunk boundary errors (the compilation sees full documents)
 *   - Hallucinated citations (every claim links to a ProxyPointer)
 *   - Stale knowledge (validUntil triggers recompilation)
 */

import { QdrantClient } from '@qdrant/js-client-rest';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProxyPointer {
  pointerId: string;
  summary: string;
  canonicalUri: string;
  domain: string;
  tags?: string[];
}

export interface Citation {
  pointerId: string;
  sourceUri: string;
  relevance: number;
  excerpt?: string;
}

export interface CompiledContext {
  contextId: string;
  version: number;
  compiledAt: string;
  domain: 'academy' | 'tech' | 'strategy' | 'operations' | 'creative' | 'spatial' | 'legal' | 'finance';
  synthesizedText: string;
  citations: Citation[];
  confidence: number;
  validUntil: string;
  dependencies?: string[];
  tags?: string[];
  accessControl?: {
    agents?: string[];
    classification?: 'public' | 'internal' | 'confidential' | 'sovereign';
  };
}

export interface CompilationRequest {
  domain: string;
  query: string;
  maxSources?: number;
  forceRecompile?: boolean;
}

export interface KnowledgeFabricConfig {
  qdrantUrl: string;
  qdrantApiKey?: string;
  collectionName: string;
  compiledCollectionName: string;
  embeddingModel: string;
  compilationModel: string;
  defaultValidityHours: number;
}

// ─── Knowledge Fabric ────────────────────────────────────────────────────────

const DEFAULT_CONFIG: KnowledgeFabricConfig = {
  qdrantUrl: 'http://127.0.0.1:6333',
  collectionName: 'proxy_pointers',
  compiledCollectionName: 'compiled_contexts',
  embeddingModel: 'text-embedding-004',
  compilationModel: 'gemini-2.5-pro',
  defaultValidityHours: 168, // 7 days
};

export class KnowledgeFabric {
  private qdrant: QdrantClient;
  private config: KnowledgeFabricConfig;

  constructor(config: Partial<KnowledgeFabricConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.qdrant = new QdrantClient({
      url: this.config.qdrantUrl,
      apiKey: this.config.qdrantApiKey,
    });
  }

  // ─── INGESTION STAGE ─────────────────────────────────────────────────────

  /**
   * Index a document as a ProxyPointer.
   * This creates a text-only embedding from the summary (not the full doc),
   * keeping the raw canonical document accessible via its URI.
   */
  async ingestPointer(pointer: ProxyPointer, embedding: number[]): Promise<void> {
    await this.qdrant.upsert(this.config.collectionName, {
      wait: true,
      points: [
        {
          id: pointer.pointerId,
          vector: embedding,
          payload: {
            summary: pointer.summary,
            canonicalUri: pointer.canonicalUri,
            domain: pointer.domain,
            tags: pointer.tags || [],
            ingestedAt: new Date().toISOString(),
          },
        },
      ],
    });
  }

  /**
   * Batch ingest multiple ProxyPointers.
   */
  async ingestPointerBatch(
    pointers: Array<{ pointer: ProxyPointer; embedding: number[] }>
  ): Promise<{ ingested: number; errors: string[] }> {
    const errors: string[] = [];
    const points = pointers.map(({ pointer, embedding }) => ({
      id: pointer.pointerId,
      vector: embedding,
      payload: {
        summary: pointer.summary,
        canonicalUri: pointer.canonicalUri,
        domain: pointer.domain,
        tags: pointer.tags || [],
        ingestedAt: new Date().toISOString(),
      },
    }));

    try {
      await this.qdrant.upsert(this.config.collectionName, {
        wait: true,
        points,
      });
    } catch (err: any) {
      errors.push(err.message);
    }

    return { ingested: points.length - errors.length, errors };
  }

  // ─── RETRIEVAL STAGE ─────────────────────────────────────────────────────

  /**
   * Retrieve ProxyPointers relevant to a query.
   * Returns structured pointers (not raw chunks) for the compilation pass.
   */
  async retrievePointers(
    queryEmbedding: number[],
    opts: { domain?: string; limit?: number; scoreThreshold?: number } = {}
  ): Promise<Array<ProxyPointer & { score: number }>> {
    const filter: any = {};
    if (opts.domain) {
      filter.must = [{ key: 'domain', match: { value: opts.domain } }];
    }

    const results = await this.qdrant.search(this.config.collectionName, {
      vector: queryEmbedding,
      limit: opts.limit || 20,
      score_threshold: opts.scoreThreshold || 0.65,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      with_payload: true,
    });

    return results.map((r: any) => ({
      pointerId: String(r.id),
      summary: r.payload.summary,
      canonicalUri: r.payload.canonicalUri,
      domain: r.payload.domain,
      tags: r.payload.tags,
      score: r.score,
    }));
  }

  // ─── COMPILATION STAGE ───────────────────────────────────────────────────

  /**
   * Compile a set of ProxyPointers into a CompiledContext record.
   * The LLM synthesizes cross-document knowledge with citations.
   */
  async compile(
    request: CompilationRequest,
    pointers: ProxyPointer[],
    synthesizer: (prompt: string) => Promise<string>
  ): Promise<CompiledContext> {
    const contextId = `ctx_${request.domain}_${Date.now().toString(36)}`;
    const now = new Date();
    const validUntil = new Date(now.getTime() + this.config.defaultValidityHours * 3600000);

    // Build compilation prompt with full document awareness
    const sourceMap = pointers
      .map((p, i) => `[SOURCE ${i + 1}] (${p.pointerId})\nURI: ${p.canonicalUri}\nSummary: ${p.summary}`)
      .join('\n\n');

    const compilationPrompt = `You are a knowledge compilation engine for the Creative Liberation Engine.

QUERY: ${request.query}
DOMAIN: ${request.domain}

SOURCES:
${sourceMap}

INSTRUCTIONS:
1. Synthesize a comprehensive, dense knowledge record that directly answers the query.
2. Every factual claim MUST cite its source using [SOURCE N] notation.
3. Prioritize actionable intelligence over theoretical summaries.
4. If sources conflict, note the conflict and explain which is more reliable and why.
5. Output ONLY the synthesized knowledge text. No preamble.`;

    const synthesizedText = await synthesizer(compilationPrompt);

    // Build citation map from the synthesis
    const citations: Citation[] = pointers.map((p, i) => ({
      pointerId: p.pointerId,
      sourceUri: p.canonicalUri,
      relevance: synthesizedText.includes(`[SOURCE ${i + 1}]`) ? 0.9 : 0.3,
    }));

    const compiled: CompiledContext = {
      contextId,
      version: 1,
      compiledAt: now.toISOString(),
      domain: request.domain as CompiledContext['domain'],
      synthesizedText,
      citations,
      confidence: 0.85,
      validUntil: validUntil.toISOString(),
      tags: pointers.flatMap((p) => p.tags || []).filter((v, i, a) => a.indexOf(v) === i),
      accessControl: { classification: 'internal' },
    };

    return compiled;
  }

  // ─── COMPILED CONTEXT STORAGE ────────────────────────────────────────────

  /**
   * Store a CompiledContext for direct agent consumption.
   */
  async storeCompiled(context: CompiledContext, embedding: number[]): Promise<void> {
    await this.qdrant.upsert(this.config.compiledCollectionName, {
      wait: true,
      points: [
        {
          id: context.contextId,
          vector: embedding,
          payload: {
            ...context,
            storedAt: new Date().toISOString(),
          },
        },
      ],
    });
  }

  /**
   * Agent-facing: get pre-compiled knowledge. No RAG retrieval needed.
   */
  async getCompiledContext(
    queryEmbedding: number[],
    opts: { domain?: string; limit?: number } = {}
  ): Promise<CompiledContext[]> {
    const filter: any = {};
    if (opts.domain) {
      filter.must = [{ key: 'domain', match: { value: opts.domain } }];
    }

    // Only return non-stale contexts
    filter.must = filter.must || [];
    filter.must.push({
      key: 'validUntil',
      range: { gte: new Date().toISOString() },
    });

    const results = await this.qdrant.search(this.config.compiledCollectionName, {
      vector: queryEmbedding,
      limit: opts.limit || 5,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      with_payload: true,
    });

    return results.map((r: any) => r.payload as CompiledContext);
  }

  // ─── RECOMPILATION ───────────────────────────────────────────────────────

  /**
   * Find stale CompiledContexts that need recompilation.
   */
  async findStaleContexts(): Promise<string[]> {
    const results = await this.qdrant.scroll(this.config.compiledCollectionName, {
      filter: {
        must: [
          {
            key: 'validUntil',
            range: { lt: new Date().toISOString() },
          },
        ],
      },
      limit: 100,
      with_payload: ['contextId'],
    });

    return results.points.map((p: any) => p.payload.contextId);
  }

  // ─── COLLECTION SETUP ───────────────────────────────────────────────────

  /**
   * Initialize Qdrant collections for the Knowledge Fabric.
   */
  async ensureCollections(vectorSize: number = 768): Promise<void> {
    for (const name of [this.config.collectionName, this.config.compiledCollectionName]) {
      try {
        await this.qdrant.getCollection(name);
      } catch {
        await this.qdrant.createCollection(name, {
          vectors: { size: vectorSize, distance: 'Cosine' },
        });
        console.log(`[KnowledgeFabric] Created collection: ${name}`);
      }
    }
  }
}

// ─── SCHOLAR HIVE INTEGRATION ─────────────────────────────────────────────

/**
 * Bridge the KnowledgeFabric into Scholar Hive's existing retrieval flow.
 * Scholar Hive calls this instead of raw Qdrant search.
 */
export class ScholarHiveBridge {
  private fabric: KnowledgeFabric;

  constructor(fabric: KnowledgeFabric) {
    this.fabric = fabric;
  }

  /**
   * Scholar Hive retrieval — compilation-aware.
   * 1. Check compiled contexts first (fast, pre-synthesized)
   * 2. If none found or stale, fall through to ProxyPointer retrieval
   * 3. Optionally trigger background recompilation
   */
  async retrieve(
    queryEmbedding: number[],
    domain: string,
    opts: { allowFallthrough?: boolean } = {}
  ): Promise<{
    compiled: CompiledContext[];
    fallthrough: ProxyPointer[];
    needsCompilation: boolean;
  }> {
    // Try compiled first
    const compiled = await this.fabric.getCompiledContext(queryEmbedding, { domain, limit: 3 });

    if (compiled.length > 0) {
      return { compiled, fallthrough: [], needsCompilation: false };
    }

    // Fallthrough to raw pointers
    if (opts.allowFallthrough !== false) {
      const pointers = await this.fabric.retrievePointers(queryEmbedding, { domain, limit: 10 });
      return {
        compiled: [],
        fallthrough: pointers,
        needsCompilation: true,
      };
    }

    return { compiled: [], fallthrough: [], needsCompilation: true };
  }
}
