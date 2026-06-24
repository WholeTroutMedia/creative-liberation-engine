export type Result<T, E> = {
    success: true;
    value: T;
} | {
    success: false;
    error: E;
};
export declare function okResult<T>(value: T): Result<T, any>;
export declare function errResult<E>(error: E): Result<any, E>;
export interface MemoryContract {
    memoryId: string;
    topic: string;
    lifecycleState: 'draft' | 'active' | 'canonical' | 'superseded' | 'archived' | 'deprecated';
    retentionClass: 'ephemeral' | 'working' | 'durable' | 'canonical' | 'archived';
    confidence: number;
    provenance: {
        recordedAt: string;
        recordedBy: string;
        source: 'SCRIBE' | 'VAULT' | 'KI' | 'HANDOFF' | 'DISPATCH' | 'MANUAL' | 'RAG';
    };
    content: Record<string, any>;
    relations?: Array<{
        targetMemoryId: string;
        type: 'depends_on' | 'supersedes' | 'duplicates' | 'relates_to' | 'derived_from';
    }>;
}
/**
 * 1. EdgeSyncBridge
 * Handles continuous context caching on handheld edges (SQLite DB files)
 * and bidirectional synchronization of local SCRIBE chunks with the Synology NAS primary vault.
 */
export declare class EdgeSyncBridge {
    private localDbPath;
    private nasVaultPath;
    constructor(localDbPath?: string, nasVaultPath?: string);
    /**
     * Cache raw active context snapshots locally on SQLite spoke database.
     */
    cacheSnapshotLocally(records: MemoryContract[]): Promise<Result<number, string>>;
    /**
     * Flush and synchronize local edge memory chunks with the authoritative NAS core collections.
     */
    synchronizeWithNAS(): Promise<Result<{
        synced: number;
        errors: string[];
    }, string>>;
}
/**
 * 2. SubquadraticContextCompactor
 * Dynamically condenses massive conversational threads or large DOM blocks into highly dense JSON briefs
 * matching the MEMORY_CONTRACT schema to fit inside edge token windows.
 */
export declare class SubquadraticContextCompactor {
    private readonly ollamaHost;
    constructor();
    /**
     * Compress redundant dialogue turns and intermediate context arrays into a single compacted brief.
     */
    compactDialogue(dialogueHistory: Array<{
        role: string;
        content: string;
    }>, maxTurns?: number): Promise<Result<MemoryContract, string>>;
}
/**
 * 3. StaticESMCompiler
 * Compiles markdown Obsidian knowledge files into tree-shakable ECMAScript Modules (ESM)
 * stored directly in memory, yielding sub-millisecond local RAG lookups without DB index latency.
 */
export declare class StaticESMCompiler {
    private sourceDir;
    private outputDir;
    constructor(sourceDir?: string, outputDir?: string);
    /**
     * Crawls the docs/ and wiki/ folders and compiles the metadata frontmatter into tree-shakable TypeScript ESM files.
     */
    compileKnowledgeLayer(): Promise<Result<{
        compiledFiles: string[];
        totalRecords: number;
    }, string>>;
}
