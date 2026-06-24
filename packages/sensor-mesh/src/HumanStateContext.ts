/**
 * @cle/sensor-mesh — HumanStateContext
 *
 * The sovereign biometric envelope. Promotes BiometricBrief from a
 * media-performance input to a first-class Genkit system context type.
 *
 * Architecture:
 *   BiometricBridge.getLatestBrief()
 *     → HumanStateContext (this schema)
 *       → Genkit ai.generate({ system }) middleware
 *         → Every agent flow inherits body-state awareness
 *
 * Consent Gate:
 *   BIOMETRIC_CONSENT_MODE=silent   → data is collected but NOT injected into LLM prompts
 *   BIOMETRIC_CONSENT_MODE=advisory → injected as a soft hint (default)
 *   BIOMETRIC_CONSENT_MODE=full     → injected with routing authority (affects task routing)
 *
 * Constitutional: Article XXIV (Biometric Privacy — pending ratification)
 *
 * @package @cle/sensor-mesh
 * @since 1.1.0
 */

import { z } from 'zod';
import { BiometricBriefSchema } from './types.js';

// ─── Consent Mode ────────────────────────────────────────────────────────────

export const BIOMETRIC_CONSENT_MODES = ['silent', 'advisory', 'full'] as const;
export type BiometricConsentMode = typeof BIOMETRIC_CONSENT_MODES[number];

/**
 * Read the configured consent mode from the environment.
 * Defaults to 'advisory' if unset or invalid.
 */
export function getConsentMode(): BiometricConsentMode {
    const raw = process.env.BIOMETRIC_CONSENT_MODE ?? 'advisory';
    if (BIOMETRIC_CONSENT_MODES.includes(raw as BiometricConsentMode)) {
        return raw as BiometricConsentMode;
    }
    console.warn(`[HumanState] Unknown BIOMETRIC_CONSENT_MODE="${raw}" — defaulting to "advisory"`);
    return 'advisory';
}

// ─── HumanStateContext Schema ─────────────────────────────────────────────────

/**
 * The canonical operator state envelope.
 *
 * Every agent that accepts a HumanStateContext can adapt its tone, routing
 * decisions, and model tier to the operator's current biological state.
 *
 * Fields intentionally mirror BiometricBrief + add agentic metadata.
 */
export const HumanStateContextSchema = z.object({
    // ── Core biometrics ─────────────────────────────────────────────────────
    biometrics: BiometricBriefSchema.optional().describe(
        'Raw biometric snapshot from BiometricBridge.getLatestBrief()'
    ),

    // ── Derived state ──────────────────────────────────────────────────────
    /**
     * Inferred cognitive load: 0.0 (idle/calm) → 1.0 (peak intensity).
     * Computed from HRV (inverse) + BPM deviation + motion intensity.
     */
    cognitiveLoad: z.number().min(0).max(1).optional().describe(
        'Normalized cognitive load estimate (0=calm, 1=peak intensity)'
    ),

    /**
     * Operator mood at time of context capture.
     * Mirrors BiometricBrief.mood but hoisted for direct agent access.
     */
    mood: z.enum(['calm', 'focused', 'energized', 'stressed', 'neutral']).optional(),

    /**
     * Agent routing recommendation derived from biometrics.
     * 'standard'     → Normal agent routing, no modification.
     * 'lightweight'  → High cognitive load detected; prefer simpler, faster flows.
     * 'deep'         → Calm + focused; engage high-capacity reasoning (cloud:max).
     * 'protect'      → Stressed state; avoid high-stakes automated actions.
     */
    routingHint: z.enum(['standard', 'lightweight', 'deep', 'protect']).optional().describe(
        'Routing recommendation for SWITCHBOARD based on operator biometrics'
    ),

    // ── Consent + Privacy ──────────────────────────────────────────────────
    /**
     * The consent mode active when this context was captured.
     * Agents MUST check this before acting on biometric data.
     * 'silent'   → Do NOT include biometrics in LLM prompts.
     * 'advisory' → Include as soft context hint only.
     * 'full'     → Allow biometrics to influence routing decisions.
     */
    consentMode: z.enum(['silent', 'advisory', 'full']).default('advisory'),

    // ── Provenance ─────────────────────────────────────────────────────────
    /** ISO8601 — when this context snapshot was captured */
    capturedAt: z.string().optional(),

    /** Active sensor sources at capture time */
    activeSources: z.array(z.string()).default([]),

    /**
     * True if all biometric fields are populated with live data.
     * False if this is a degraded/offline snapshot (watch offline, etc.).
     */
    isFresh: z.boolean().default(false),
});

export type HumanStateContext = z.infer<typeof HumanStateContextSchema>;

// ─── Derived State Computation ────────────────────────────────────────────────

/**
 * Compute cognitive load from raw biometrics.
 *
 * Formula:
 *   - HRV contribution (inverse — low HRV = high load): (100 - hrv) / 100, clamped [0,1]
 *   - BPM deviation contribution: clamp((bpm - 70) / 60, 0, 1)
 *   - Motion intensity: raw value [0,1]
 *   Weighted average: 50% HRV + 30% BPM + 20% motion
 */
export function computeCognitiveLoad(
    hrv?: number,
    bpm?: number,
    motionIntensity?: number,
): number {
    let score = 0;
    let weight = 0;

    if (hrv !== undefined) {
        score += (Math.max(0, Math.min(100, 100 - hrv)) / 100) * 0.5;
        weight += 0.5;
    }
    if (bpm !== undefined) {
        score += Math.max(0, Math.min(1, (bpm - 70) / 60)) * 0.3;
        weight += 0.3;
    }
    if (motionIntensity !== undefined) {
        score += motionIntensity * 0.2;
        weight += 0.2;
    }

    return weight > 0 ? Math.round((score / weight) * 100) / 100 : 0;
}

/**
 * Derive the routing hint from cognitive load + mood.
 */
export function computeRoutingHint(
    cognitiveLoad: number,
    mood?: HumanStateContext['mood'],
): HumanStateContext['routingHint'] {
    if (mood === 'stressed' || cognitiveLoad > 0.8) return 'protect';
    if (cognitiveLoad < 0.3 && (mood === 'calm' || mood === 'focused')) return 'deep';
    if (cognitiveLoad > 0.6) return 'lightweight';
    return 'standard';
}

// ─── System Prompt Serializer ─────────────────────────────────────────────────

/**
 * Convert a HumanStateContext into a Genkit system prompt injection string.
 *
 * Returns:
 *   - Empty string if consentMode is 'silent' (privacy gate enforced here)
 *   - A compact context block for 'advisory' and 'full' modes
 *
 * This is the single point of truth for how biometric data enters LLM context.
 * All agents MUST use this serializer — never construct the string manually.
 */
export function serializeHumanStateForPrompt(ctx: HumanStateContext): string {
    if (ctx.consentMode === 'silent') return '';

    const lines: string[] = ['--- OPERATOR STATE CONTEXT ---'];

    if (ctx.mood) lines.push(`Mood: ${ctx.mood}`);
    if (ctx.cognitiveLoad !== undefined) {
        const pct = Math.round(ctx.cognitiveLoad * 100);
        lines.push(`Cognitive Load: ${pct}% (${pct < 30 ? 'low' : pct < 60 ? 'moderate' : pct < 80 ? 'high' : 'peak'})`);
    }
    if (ctx.routingHint && ctx.routingHint !== 'standard') {
        lines.push(`Routing advisory: ${ctx.routingHint.toUpperCase()}`);
    }

    if (ctx.consentMode === 'full' && ctx.biometrics) {
        const b = ctx.biometrics;
        if (b.bpm) lines.push(`BPM: ${b.bpm}`);
        if (b.hrv) lines.push(`HRV: ${b.hrv}ms`);
        if (b.motionIntensity !== undefined) lines.push(`Motion: ${Math.round(b.motionIntensity * 100)}%`);
    }

    if (ctx.activeSources.length > 0) {
        lines.push(`Sources: ${ctx.activeSources.join(', ')}`);
    }
    if (!ctx.isFresh) {
        lines.push('⚠ Biometric data is stale or sensors offline — use with caution');
    }

    lines.push('--- END OPERATOR STATE ---');
    return lines.join('\n');
}

// ─── Null/Offline State ───────────────────────────────────────────────────────

/**
 * Returns a safe offline HumanStateContext for when BiometricBridge is unavailable.
 */
export function offlineHumanState(): HumanStateContext {
    return {
        consentMode: getConsentMode(),
        activeSources: [],
        isFresh: false,
        capturedAt: new Date().toISOString(),
    };
}
