// packages/design-governance/src/types.ts
// DS-701–DS-705: Core types for the design governance layer

// ─── Token Analytics ──────────────────────────────────────────────────────────

export interface TokenUsageRecord {
    /** CSS custom property name (e.g. `--inc-color-primary`) */
    token: string;
    /** Number of times this token appears across scanned files */
    count: number;
    /** Files where this token is used */
    files: string[];
}

export interface TokenUsageSummary {
    /** Total unique tokens found in use */
    totalUsed: number;
    /** Total tokens defined in the registry */
    totalDefined: number;
    /** Tokens defined but never consumed */
    orphans: string[];
    /** Tokens used but not found in the registry */
    unregistered: string[];
    /** Sorted frequency map — most used first */
    frequency: TokenUsageRecord[];
}

// ─── Component Census ─────────────────────────────────────────────────────────

export interface ComponentCensusEntry {
    /** Component name (e.g. `Button`, `Input`) */
    name: string;
    /** File path where the component is defined */
    filePath: string;
    /** Whether a JSON schema exists for this component */
    hasSchema: boolean;
    /** Number of props defined in the TypeScript interface */
    propCount: number;
    /** Number of props covered by the JSON schema (0 if no schema) */
    schemaPropCount: number;
    /** Deviation score: 0 = perfect match, 100 = no schema at all */
    deviationScore: number;
}

export interface ComponentCensusReport {
    /** Total components scanned */
    totalComponents: number;
    /** Components with no JSON schema */
    missingSchemas: string[];
    /** Components where schema doesn't fully match TS interface */
    partialSchemas: string[];
    /** Average deviation score across all components */
    averageDeviation: number;
    /** Per-component entries */
    entries: ComponentCensusEntry[];
}

// ─── Drift Detection ──────────────────────────────────────────────────────────

export type DriftSeverity = 'info' | 'warning' | 'error';

export interface DriftAlert {
    /** Token path that drifted (e.g. `color.primary`) */
    tokenPath: string;
    /** Expected value from the registered theme */
    expected: string;
    /** Actual value found in the codebase */
    actual: string;
    /** Severity level */
    severity: DriftSeverity;
    /** Human-readable description */
    message: string;
}

// ─── Deprecation ──────────────────────────────────────────────────────────────

export type DeprecationPhase = 'flagged' | 'migrating' | 'removal-ready' | 'removed';

export interface DeprecationEntry {
    /** Token path being deprecated */
    tokenPath: string;
    /** Why this token is being deprecated */
    reason: string;
    /** Suggested replacement token path */
    replacement?: string;
    /** Current lifecycle phase */
    phase: DeprecationPhase;
    /** When this token was first flagged */
    flaggedAt: string;
    /** When it will be removed (sprint target) */
    removalTarget?: string;
    /** Number of remaining usages found in the codebase */
    remainingUsages: number;
}

// ─── Governance Report (Aggregate) ────────────────────────────────────────────

export interface GovernanceReport {
    /** ISO timestamp of report generation */
    generatedAt: string;
    /** Token usage analytics */
    tokenUsage: TokenUsageSummary;
    /** Component census */
    componentCensus: ComponentCensusReport;
    /** Active drift alerts */
    driftAlerts: DriftAlert[];
    /** Deprecation pipeline state */
    deprecations: DeprecationEntry[];
    /** Overall health score (0-100) */
    healthScore: number;
}
