// packages/design-governance/src/drift-detector.ts
// DS-703: Drift detection — compares live token values against a registered theme

import type { DriftAlert, DriftSeverity } from './types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriftDetectionOptions {
    /** Whether to treat unregistered tokens (present in live but not in registered) as drift */
    flagUnregistered?: boolean;
    /** Whether to treat missing tokens (present in registered but not in live) as drift */
    flagMissing?: boolean;
}

const DEFAULT_OPTIONS: DriftDetectionOptions = {
    flagUnregistered: true,
    flagMissing: true,
};

// ─── Severity Classification ──────────────────────────────────────────────────

/** Color tokens drifting is always an error — it can break contrast/accessibility */
const ERROR_PREFIXES = ['color.', 'shadow.'];
/** Spacing tokens drifting is a warning — it breaks rhythm but not accessibility */
const WARNING_PREFIXES = ['spacing.', 'radius.', 'font.size.'];

function classifySeverity(tokenPath: string): DriftSeverity {
    if (ERROR_PREFIXES.some((p) => tokenPath.startsWith(p))) return 'error';
    if (WARNING_PREFIXES.some((p) => tokenPath.startsWith(p))) return 'warning';
    return 'info';
}

// ─── Detector ─────────────────────────────────────────────────────────────────

/**
 * Detect drift between current (live) token values and a registered theme definition.
 *
 * @param currentTokens - Flat map of token paths → current resolved values
 * @param registeredTokens - Flat map of token paths → expected values from the registered theme
 * @param options - Detection options
 * @returns Array of drift alerts, sorted by severity (error first)
 */
export function detectDrift(
    currentTokens: Record<string, string>,
    registeredTokens: Record<string, string>,
    options: DriftDetectionOptions = {},
): DriftAlert[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const alerts: DriftAlert[] = [];

    // Check for value mismatches
    for (const [tokenPath, expectedValue] of Object.entries(registeredTokens)) {
        const actualValue = currentTokens[tokenPath];

        if (actualValue === undefined) {
            if (opts.flagMissing) {
                alerts.push({
                    tokenPath,
                    expected: expectedValue,
                    actual: '(missing)',
                    severity: classifySeverity(tokenPath),
                    message: `Token "${tokenPath}" is registered but missing from the live codebase`,
                });
            }
            continue;
        }

        // Normalize values for comparison (trim whitespace, lowercase hex)
        const normalizedExpected = normalizeValue(expectedValue);
        const normalizedActual = normalizeValue(actualValue);

        if (normalizedExpected !== normalizedActual) {
            alerts.push({
                tokenPath,
                expected: expectedValue,
                actual: actualValue,
                severity: classifySeverity(tokenPath),
                message: `Token "${tokenPath}" drifted: expected "${expectedValue}" but found "${actualValue}"`,
            });
        }
    }

    // Check for unregistered tokens
    if (opts.flagUnregistered) {
        for (const tokenPath of Object.keys(currentTokens)) {
            if (!(tokenPath in registeredTokens)) {
                alerts.push({
                    tokenPath,
                    expected: '(not registered)',
                    actual: currentTokens[tokenPath]!,
                    severity: 'warning',
                    message: `Token "${tokenPath}" exists in the codebase but is not in the registered theme`,
                });
            }
        }
    }

    // Sort by severity: error > warning > info
    const severityOrder: Record<DriftSeverity, number> = { error: 0, warning: 1, info: 2 };
    return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Normalize a token value for drift comparison.
 * - Trims whitespace
 * - Lowercases hex colors
 * - Normalizes CSS spacing (collapse multiple spaces)
 */
function normalizeValue(value: string): string {
    return value
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/#[0-9a-fA-F]{3,8}/g, (hex) => hex.toLowerCase());
}

/**
 * Compute a drift score (0 = no drift, 100 = maximum drift).
 */
export function computeDriftScore(alerts: DriftAlert[]): number {
    if (alerts.length === 0) return 0;

    const weights: Record<DriftSeverity, number> = { error: 10, warning: 3, info: 1 };
    const total = alerts.reduce((sum, a) => sum + weights[a.severity], 0);

    // Cap at 100
    return Math.min(100, total);
}
