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
export declare class KnowledgeFabric {
    private qdrant;
    private config;
    constructor(config?: Partial<KnowledgeFabricConfig>);
    /**
     * Index a document as a ProxyPointer.
     * This creates a text-only embedding from the summary (not the full doc),
     * keeping the raw canonical document accessible via its URI.
     */
    ingestPointer(pointer: ProxyPointer, embedding: number[]): Promise<void>;
    /**
     * Batch ingest multiple ProxyPointers.
     */
    ingestPointerBatch(pointers: Array<{
        pointer: ProxyPointer;
        embedding: number[];
    }>): Promise<{
        ingested: number;
        errors: string[];
    }>;
    /**
     * Retrieve ProxyPointers relevant to a query.
     * Returns structured pointers (not raw chunks) for the compilation pass.
     */
    retrievePointers(queryEmbedding: number[], opts?: {
        domain?: string;
        limit?: number;
        scoreThreshold?: number;
    }): Promise<Array<ProxyPointer & {
        score: number;
    }>>;
    /**
     * Compile a set of ProxyPointers into a CompiledContext record.
     * The LLM synthesizes cross-document knowledge with citations.
     */
    compile(request: CompilationRequest, pointers: ProxyPointer[], synthesizer: (prompt: string) => Promise<string>): Promise<CompiledContext>;
    /**
     * Store a CompiledContext for direct agent consumption.
     */
    storeCompiled(context: CompiledContext, embedding: number[]): Promise<void>;
    /**
     * Agent-facing: get pre-compiled knowledge. No RAG retrieval needed.
     */
    getCompiledContext(queryEmbedding: number[], opts?: {
        domain?: string;
        limit?: number;
    }): Promise<CompiledContext[]>;
    /**
     * Find stale CompiledContexts that need recompilation.
     */
    findStaleContexts(): Promise<string[]>;
    /**
     * Initialize Qdrant collections for the Knowledge Fabric.
     */
    ensureCollections(vectorSize?: number): Promise<void>;
}
/**
 * Bridge the KnowledgeFabric into Scholar Hive's existing retrieval flow.
 * Scholar Hive calls this instead of raw Qdrant search.
 */
export declare class ScholarHiveBridge {
    private fabric;
    constructor(fabric: KnowledgeFabric);
    /**
     * Scholar Hive retrieval — compilation-aware.
     * 1. Check compiled contexts first (fast, pre-synthesized)
     * 2. If none found or stale, fall through to ProxyPointer retrieval
     * 3. Optionally trigger background recompilation
     */
    retrieve(queryEmbedding: number[], domain: string, opts?: {
        allowFallthrough?: boolean;
    }): Promise<{
        compiled: CompiledContext[];
        fallthrough: ProxyPointer[];
        needsCompilation: boolean;
    }>;
}
