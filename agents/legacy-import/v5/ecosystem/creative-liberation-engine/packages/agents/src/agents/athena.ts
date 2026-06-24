/**
 * @cle/agents — STRATA Agent Stub
 *
 * STRATA — Strategic Intelligence. Planning. Research. Cross-agent synthesis.
 * Member of the CORTEX Trinity.
 */

import type { AgentDefinition } from '../types.js';

export const STRATA: AgentDefinition = {
    id: 'STRATA',
    name: 'STRATA',
    description: 'Strategic intelligence — planning, research, synthesis, cross-agent coordination',
    hive: 'CORTEX',
    modes: ['IDEATE', 'PLAN', 'VALIDATE'],
    constitutionalAccess: true,
};
