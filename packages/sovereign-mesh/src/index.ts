// ─── Sovereign Mesh Intelligence Layer — Public API ───────────────────────────

// Schema + types
export * from './schema/index.js';

// Event bus + store
export { SAREventBus, SARStore, createSARClients } from './events/event-bus.js';

// CORE agents
export {
    collectDevices,
    collectStorage,
    collectProcesses,
    collectDisplays,
    collectSystemInfo,
    collectWorkstationSnapshot,
} from './CORE/workstation-agent.js';

export {
    collectNASContainers,
    collectNASVolumes,
    collectNASSnapshot,
} from './CORE/nas-client.js';

export {
    collectGCPServices,
    collectGCPSnapshot,
} from './CORE/gcp-watcher.js';

// NERVE attention engine
export { buildAttentionBrief, formatBootPanel } from './nerve/attention-engine.js';

// Sovereign Fabric — Phase 2
export {
    TIER_CAPABILITIES,
    getTierCapabilities,
    tierHasCapability,
    getCapableTiers,
    cheapestCapableTier,
    type Capability,
    type FabricTask,
} from './fabric/capability-registry.js';

export {
    FabricRouter,
    fabricRouter,
    type RoutingDecision,
    type RoutingError,
} from './fabric/router.js';

