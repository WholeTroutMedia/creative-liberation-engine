/**
 * @cle/ouroboros — Public Package Index
 *
 * The self-optimization layer for the Creative Liberation Engine.
 * Provides observability infrastructure for ARCHAEON, SPECTRE-D, CODEX-DELTA, and FUSE.
 */

// Inference I/O Ledger — ARCHAEON data feed
export {
  appendInference,
  readRecentInferences,
  summarizeLedger,
} from './ledger.js';

export type {
  InferenceSample,
  LedgerSummary,
} from './ledger.js';

// Sequential Agent Pair Tracker — FUSE data feed
export {
  recordAgentTransition,
  getTopPairs,
  getFuseCandidates,
} from './pair-tracker.js';

export type {
  AgentPairEvent,
  PairCount,
} from './pair-tracker.js';

// Code Lens — SPECTRE-D and CODEX-DELTA data feed
export {
  scanPackageGraph,
  scanGenkitFlows,
  runCodeLens,
} from './code-lens.js';

export type {
  PackageInfo,
  FlowInfo,
  CodeLensReport,
} from './code-lens.js';
