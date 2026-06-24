export interface Skill {
    name: string;
}
export interface SkillManifest {
    agent: string;
    skills: Skill[];
}
export interface SpawnOptions {
    targetDir?: string;
    port?: number;
    /** If true, attempt to resume from a prior NAS checkpoint */
    resumeFromCheckpoint?: boolean;
    /** Resume token from a prior hibernation */
    resumeToken?: string;
}
/** Returned after a successful spawn */
export interface SpawnResult {
    pid: number;
    port: number;
    agentId: string;
    /** Present if a checkpoint was created or resumed */
    resumeToken?: string;
    /** Present if a prior checkpoint was restored */
    resumedFrom?: string;
}
/**
 * Agent Spawner
 * Self-replication and horizontal scaling layer for the Creative Liberation Engine.
 *
 * V6 Cognitive Upgrades:
 *   - Auto-checkpoints agent state to NAS on spawn (multi-day persistence)
 *   - Context compression via local Ollama before handoff
 *   - State cleanup policy: purges expired checkpoints (>7 days)
 */
export declare class AgentSpawner {
    private baseDir;
    private readonly checkpoint;
    private readonly compressor;
    constructor(baseDir?: string);
    /**
     * Dynamically spin up a new operational agent based on a SkillManifest.
     * If resumeFromCheckpoint is true, attempts to restore prior execution state.
     */
    spawnFromManifest(manifest: SkillManifest, options?: SpawnOptions): Promise<SpawnResult>;
    /**
     * Compress raw observational context before passing to an agent.
     * Uses the local Ollama instance (qwen3-coder) for sovereign inference.
     */
    compressContext(rawInput: string, strategy?: 'dom' | 'terminal'): Promise<string>;
    /**
     * Hibernate an active agent, persisting its full execution context to NAS.
     */
    hibernateAgent(agentId: string, context: any): Promise<{
        resumeToken: string;
    } | null>;
    /**
     * Resume a hibernated agent from NAS checkpoint.
     */
    resumeAgent(agentId: string, resumeToken: string): Promise<any | null>;
    /**
     * State cleanup policy: purge NAS checkpoints older than maxAgeDays.
     * Constitutional compliance: prevents unbounded state accumulation.
     */
    purgeExpiredCheckpoints(maxAgeDays?: number): Promise<{
        purged: string[];
        errors: string[];
    }>;
    private generateEntrypoint;
    private findAvailablePort;
}
//# sourceMappingURL=spawner.d.ts.map