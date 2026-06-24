/**
 * @cle/agents — Core Types
 *
 * Shared type definitions for the Creative Liberation Engine agent runtime.
 * All agents implement AgentDefinition and produce AgentRunResult.
 */

export type AgentId =
    | 'STRATA' | 'LOGD' | 'PRISM'   // CORTEX Trinity
    | 'KEEPER' | 'ATLAS' | 'COMPASS' | 'SCRIBE' | 'RELAY'  // Supporting hive
    | 'SWITCHBOARD' | 'GENKI' | 'CLAUDE' | 'CHRONOS' | 'NEXUS' | 'ZERO';

export type AgentMode = 'IDEATE' | 'PLAN' | 'SHIP' | 'VALIDATE';

export interface AgentDefinition {
    id: AgentId;
    name: string;
    description: string;
    hive: 'CORTEX' | 'BUILDER' | 'GUARDIAN' | 'RELAY' | 'LEADERSHIP' | 'INFRASTRUCTURE' | 'MEMORY'
        | 'LEX' | 'KEEPER' | 'SWITCHBOARD' | 'BROADCAST' | 'ENHANCEMENT' | 'AURORA';
    modes: AgentMode[];
    constitutionalAccess: boolean;
}

export interface AgentRunInput {
    agentId: AgentId;
    prompt: string;
    mode?: AgentMode;
    sessionId?: string;
    context?: Record<string, unknown>;
}

export interface AgentRunResult {
    agentId: AgentId;
    output: string;
    mode: AgentMode;
    sessionId?: string;
    constitutionalApproval: boolean;
    latencyMs: number;
    timestamp: string;
}
