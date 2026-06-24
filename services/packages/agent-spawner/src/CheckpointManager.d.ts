import type { Result } from '../../cle-core/src/utils/result.ts';
export interface CheckpointState {
    agentId: string;
    resumeToken: string;
    hibernatedAt: string;
    context: any;
}
/**
 * Checkpoint Manager
 * Handles multi-day orchestration by persisting agent execution context
 * to the NAS, allowing agents to hibernate and safely resume later.
 */
export declare class CheckpointManager {
    private readonly stateDir;
    /**
     * Persist an agent's current state to the NAS and generate a resume token.
     */
    hibernateAgent(agentId: string, context: any): Promise<Result<{
        resumeToken: string;
    }, string>>;
    /**
     * Reload an agent's state from the NAS.
     */
    resumeAgent(agentId: string, resumeToken: string): Promise<Result<CheckpointState, string>>;
}
//# sourceMappingURL=CheckpointManager.d.ts.map