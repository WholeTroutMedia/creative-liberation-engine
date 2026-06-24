/**
 * Ambient type declarations for planned packages that haven't been published yet.
 * These stubs prevent TypeScript compilation failures while the packages are in development.
 */

declare module '@cle/memory' {
    export interface MemoryEntry {
        id?: string;
        agentName?: string;
        task?: string;
        outcome?: string;
        tags?: string[];
        timestamp?: string;
        success?: boolean;
        metadata?: Record<string, any>;
        pattern?: string;
    }
    export interface TieredMemoryEntry {
        id?: string;
        agentName?: string;
        task?: string;
        outcome?: string;
        tags?: string[];
        timestamp?: string;
        success?: boolean;
        metadata?: Record<string, any>;
        pattern?: string;
        tier?: string;
    }
    export const memoryBus: any;
    export const memoryTierManager: any;
    export const chromaMemory: any;
    export const MemoryEntrySchema: any;
    export const MemoryQuerySchema: any;
    export const MemoryWriteSchema: any;
    export const MemoryBus: any;
}

declare module '@cle/observability' {
    export const traceStorage: any;
    export const pulse: any;
    export const telemetry: any;
    export const hardener: any;
}


declare module '@cle/agent-spawner' {
    export class AgentSpawner {
        hibernateAgent(agentId: string, context: Record<string, unknown>): Promise<{ checkpointId: string; storagePath: string } | null>;
        resumeAgent(agentId: string, resumeToken: string): Promise<Record<string, unknown> | null>;
        compressContext(rawInput: string, strategy: 'dom' | 'terminal'): Promise<string>;
        purgeExpiredCheckpoints(maxAgeDays?: number): Promise<{ purged: number; remaining: number }>;
    }
}
