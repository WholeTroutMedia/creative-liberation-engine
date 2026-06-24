// packages/design-governance/src/index.ts
// Barrel export for @cle/design-governance

export * from './types.js';
export {
    scanTokenUsage,
    scanTokenDefinitions,
    findOrphanTokens,
    findUnregisteredTokens,
    buildTokenUsageSummary,
} from './token-analytics.js';
export {
    detectDrift,
    computeDriftScore,
    type DriftDetectionOptions,
} from './drift-detector.js';
export {
    buildCensusEntry,
    buildComponentCensus,
    type ComponentFileInfo,
} from './component-census.js';
export { DeprecationPipeline } from './deprecation.js';
