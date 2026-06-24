import fs from 'fs/promises';
import path from 'path';
import { okResult as Ok, errResult as Err } from '@cle/core';
import type { Result } from '@cle/core';

export interface CheckpointState {
    agentId: string;
    resumeToken: string;
    hibernatedAt: string;
    context: any; // Can be FlowContext or any serializable state
}

/**
 * Checkpoint Manager
 * Handles multi-day orchestration by persisting agent execution context
 * to the NAS, allowing agents to hibernate and safely resume later.
 */
export class CheckpointManager {
    // NAS state persistence directory
    private readonly stateDir = '\\\\127.0.0.1\\docker\\creative-liberation-engine\\runtime\\state';

    /**
     * Persist an agent's current state to the NAS and generate a resume token.
     */
    public async hibernateAgent(agentId: string, context: any): Promise<Result<{ resumeToken: string }, string>> {
        try {
            // Ensure the state directory exists
            try {
                await fs.access(this.stateDir);
            } catch {
                await fs.mkdir(this.stateDir, { recursive: true });
            }

            const resumeToken = `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const statePath = path.join(this.stateDir, `${agentId}.json`);

            const checkpoint: CheckpointState = {
                agentId,
                resumeToken,
                hibernatedAt: new Date().toISOString(),
                context
            };

            await fs.writeFile(statePath, JSON.stringify(checkpoint, null, 2), 'utf-8');

            return Ok({ resumeToken });
        } catch (err) {
            return Err(err instanceof Error ? err.message : String(err));
        }
    }

    /**
     * Reload an agent's state from the NAS.
     */
    public async resumeAgent(agentId: string, resumeToken: string): Promise<Result<CheckpointState, string>> {
        try {
            const statePath = path.join(this.stateDir, `${agentId}.json`);
            
            let data: string;
            try {
                data = await fs.readFile(statePath, 'utf-8');
            } catch (err: any) {
                if (err.code === 'ENOENT') {
                    return Err(`No active checkpoint found for agent: ${agentId}`);
                }
                throw err;
            }

            const checkpoint: CheckpointState = JSON.parse(data);

            if (checkpoint.resumeToken !== resumeToken) {
                return Err(`Invalid resume token for agent: ${agentId}`);
            }

            return Ok(checkpoint);
        } catch (err) {
            return Err(err instanceof Error ? err.message : String(err));
        }
    }
}
