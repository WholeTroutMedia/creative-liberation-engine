/**
 * @cle/agents — Agent Runtime Index
 *
 * Creative Liberation Engine v5.0.0 (GENESIS) — 14-agent ADK runtime.
 * CORTEX Trinity: STRATA (strategy), LOGD (truth/compliance), PRISM (creativity/action).
 * Supporting hive: KEEPER, ATLAS, COMPASS, SCRIBE, RELAY, SWITCHBOARD, and more.
 *
 * Governed by the 20-article CLE Constitution.
 * All agent actions pass LOGD before execution.
 */

import type { AgentDefinition, AgentRunInput, AgentRunResult } from './types.js';

// ─── Agent Registry ──────────────────────────────────────────────────────────
// Re-export after individual agents are scaffolded
export type { AgentDefinition, AgentRunInput, AgentRunResult };
export { AGENT_REGISTRY } from './registry.js';

// ─── CORTEX Trinity ───────────────────────────────────────────────────────────
export { STRATA } from './agents/athena.js';
export { LOGD } from './agents/vera.js';
export { PRISM } from './agents/iris.js';

// ─── Supporting Hive ─────────────────────────────────────────────────────────
export { KEEPER } from './agents/keeper.js';
export { ATLAS } from './agents/atlas.js';
export { COMPASS } from './agents/compass.js';
export { SCRIBE } from './agents/scribe.js';
export { RELAY } from './agents/relay.js';

// ─── Runtime ─────────────────────────────────────────────────────────────────
export { AgentRuntime } from './runtime.js';
export { VeraMiddleware } from './vera-middleware.js';
