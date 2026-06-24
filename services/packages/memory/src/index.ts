/**
 * @cle/memory — Public Package Index
 *
 * The Live Memory Bus for the Creative Liberation Engine.
 * Provides compound intelligence across all agents via:
 *   - Vector search (ChromaDB + nomic-embed-text, local Ollama)
 *   - JSONL fallback when ChromaDB is unavailable
 *   - Cross-agent recall (BOLT's learning surfaces in AURORA's next run)
 *   - SCRIBE pattern extraction (auto "The Why" after every execution)
 *
 * Constitutional Article VII: Every execution contributes to knowledge.
 */

// Core MemoryBus — the primary interface for all agents
export {
    MemoryBus,
    memoryBus,
    MemoryEntrySchema,
    MemoryQuerySchema,
    MemoryWriteSchema,
    SURFACE_TO_LAYER,
} from './bus.js';

export type { PatternExtractor } from './bus.js';

export type {
    MemoryEntry,
    MemoryQuery,
    MemoryWrite,
    MemoryLayerType,
} from './bus.js';

// ChromaDB client — direct access for advanced use cases
export {
    ChromaMemoryClient,
    chromaMemory,
} from './chroma.js';

// TRINITY-1 Protocol — HandoffService (W1)
export {
    HandoffService,
    handoffService,
} from './handoff.js';

export type {
    HandoffState,
    HandoffPhase,
    HandoffSource,
} from './handoff.js';

// MemoryFileWatcher — VERA ChromaDB sync (W7)
export {
    MemoryFileWatcher,
    memoryWatcher,
} from './watcher.js';

// Context Compaction Layer — Issue #94
export {
    compactContext,
    estimateTokens,
    RollingContextManager,
    contextManager,
} from './context-compaction.js';

export type {
    Turn,
    CompactionInput,
    CompactedContext,
} from './context-compaction.js';

// MemoryTierManager — Tiered Memory Architecture, REM consolidation support
export {
    MemoryTierManager,
    memoryTierManager,
} from './tier-manager.js';

export type {
    MemoryTier,
    TieredMemoryEntry,
    TieredMemoryWrite,
    TierRecallOptions,
    PromoteOptions,
} from './tier-manager.js';

export {
    AgentsLoader,
    type AgentsLoaderOpts,
} from './agents-loader.js';

export {
    agenticSocialGraph,
    AgenticSocialGraph,
} from './agentic-graph.js';

export {
    RagRouter,
} from './RagRouter.js';

export {
    generateEmbedding,
    ingestDocumentAsProxyPointer,
} from './rag-ingest.js';

export {
    ContextCompressor,
    type CompressionStrategy,
    type CompressOptions,
} from './ContextCompressor.js';
