/**
 * MeshRouter — Cortical Mesh Tier-Aware Task Router (Direction 03)
 * packages/model-arbitrage/src/mesh-router.ts
 *
 * Adds explicit three-tier hardware routing on top of the existing CapabilityRouter.
 * Assigns every task or memory query to one of four mesh tiers BEFORE capability
 * matching runs, ensuring the right hardware handles each workload:
 *
 *   edge   → NAS local Ollama, sub-100ms signal classification, <2B model
 *   mid    → NAS Ollama mid-tier, 3-13B, batch async, consolidation tasks
 *   heavy  → Workstation RTX 4090, 13B+, local-privacy tasks, high complexity
 *   cloud  → Gemini/etc via API, massive context, frontier capability required
 *
 * The classifier is FULLY rule-based (no LLM call) so classification is < 50ms.
 * Classification latency is logged on every decision for monitoring.
 *
 * Usage:
 *   import { meshRouter } from '@cle/model-arbitrage';
 *   const decision = meshRouter.routeTask(task);
 *   // decision.tier, decision.classificationMs, decision.tierReason
 */

import type { RoutingDecision } from './capability-schema.js';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type MeshTier = 'edge' | 'mid' | 'heavy' | 'cloud';

/** Three-axis input profile for tier scoring */
export interface MeshProfile {
    /**
     * Task complexity 0-1.
     * 0.0 = simple keyword match / classification
     * 0.5 = multi-step reasoning
     * 0.9 = frontier-level creative or code generation
     */
    complexity: number;
    /**
     * Latency sensitivity 0-1.
     * 1.0 = realtime (must respond in < 200ms)
     * 0.5 = interactive (< 5s acceptable)
     * 0.0 = batch async (minutes are fine)
     */
    latencySensitivity: number;
    /**
     * Privacy requirement 0-1.
     * 1.0 = local-only, no cloud egress permitted
     * 0.5 = prefer local, cloud allowed as fallback
     * 0.0 = cloud safe
     */
    privacyRequirement: number;
    /** Optional: estimated token count for context budget routing */
    estimatedTokens?: number;
}

export interface MeshRoutingDecision {
    tier: MeshTier;
    tierReason: string;
    /** Wall-clock ms for the classification step (must stay < 50ms) */
    classificationMs: number;
    /** Recommended model env var key for this tier */
    recommendedModelEnvKey: string;
    /** Fallback tier if primary tier is offline */
    fallbackTier: MeshTier;
    profile: MeshProfile;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER MODEL MAP
// Maps tier → env var key. Actual model strings live in .env (Article VI).
// ─────────────────────────────────────────────────────────────────────────────

const TIER_MODEL_KEYS: Record<MeshTier, string> = {
    edge:  'MODEL_EDGE',   // e.g. qwen2.5:1.5b via NAS Ollama
    mid:   'MODEL_MID',    // e.g. mistral:7b or llama3.1:8b via NAS Ollama
    heavy: 'MODEL_HEAVY',  // e.g. llama3.1:70b via workstation RTX 4090
    cloud: 'MODEL_CLOUD',  // e.g. gemini-2.0-flash via API
};

const TIER_FALLBACKS: Record<MeshTier, MeshTier> = {
    edge:  'mid',
    mid:   'heavy',
    heavy: 'cloud',
    cloud: 'heavy',
};

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL KEYWORDS — used for complexity auto-detection
// ─────────────────────────────────────────────────────────────────────────────

const HIGH_COMPLEXITY_SIGNALS = [
    'architect', 'design system', 'implement', 'refactor', 'generate code',
    'write tests', 'complex', 'multi-step', 'pipeline', 'orchestrat',
    'analyze codebase', 'comprehensive', 'full implementation',
];

const LOW_COMPLEXITY_SIGNALS = [
    'classify', 'tag', 'label', 'summarize briefly', 'extract keywords',
    'yes or no', 'true or false', 'route', 'match', 'filter',
];

const PRIVACY_SIGNALS = [
    'personal', 'confidential', 'private', 'local only', 'no cloud',
    'sensitive', 'pii', 'password', 'secret', 'credential',
];

// ─────────────────────────────────────────────────────────────────────────────
// MeshRouter
// ─────────────────────────────────────────────────────────────────────────────

export class MeshRouter {
    /**
     * Route a task description to a mesh tier using the three-axis scorer.
     * Pure rule-based — no LLM call, classification must be < 50ms.
     *
     * @param taskDescription - Human-readable task title or description.
     * @param profileOverrides - Explicit profile values that override auto-detection.
     */
    routeTask(
        taskDescription: string,
        profileOverrides?: Partial<MeshProfile>,
    ): MeshRoutingDecision {
        const t0 = performance.now();

        const profile = this.inferProfile(taskDescription, profileOverrides);
        const { tier, reason } = this.assignTier(profile);

        const classificationMs = parseFloat((performance.now() - t0).toFixed(3));

        const decision: MeshRoutingDecision = {
            tier,
            tierReason: reason,
            classificationMs,
            recommendedModelEnvKey: TIER_MODEL_KEYS[tier],
            fallbackTier: TIER_FALLBACKS[tier],
            profile,
        };

        console.log(
            `[MESH_ROUTER] tier=${tier} complexity=${profile.complexity.toFixed(2)} ` +
            `latency=${profile.latencySensitivity.toFixed(2)} ` +
            `privacy=${profile.privacyRequirement.toFixed(2)} ` +
            `classificationMs=${classificationMs} reason="${reason}"`,
        );

        if (classificationMs > 50) {
            console.warn(`[MESH_ROUTER] ⚠️ Classification exceeded 50ms target: ${classificationMs}ms`);
        }

        return decision;
    }

    /**
     * Route a memory recall query to a tier.
     * Working-tier recalls are always edge. Mid/long-term go to cloud if complex.
     */
    routeMemoryRecall(
        query: string,
        targetTier: 'working' | 'mid-term' | 'long-term',
    ): MeshRoutingDecision {
        const tierMap: Record<string, Partial<MeshProfile>> = {
            'working':   { complexity: 0.1, latencySensitivity: 0.9, privacyRequirement: 0.8 },
            'mid-term':  { complexity: 0.3, latencySensitivity: 0.4, privacyRequirement: 0.6 },
            'long-term': { complexity: 0.4, latencySensitivity: 0.1, privacyRequirement: 0.5 },
        };
        return this.routeTask(query, tierMap[targetTier] ?? {});
    }

    // ── Profile inference ─────────────────────────────────────────────────────

    private inferProfile(
        text: string,
        overrides?: Partial<MeshProfile>,
    ): MeshProfile {
        const lower = text.toLowerCase();

        // Complexity auto-detection
        let complexity = 0.5; // default mid
        if (HIGH_COMPLEXITY_SIGNALS.some(s => lower.includes(s))) complexity = 0.8;
        if (LOW_COMPLEXITY_SIGNALS.some(s => lower.includes(s))) complexity = 0.1;

        // Privacy auto-detection
        let privacyRequirement = 0.2; // default cloud-safe
        if (PRIVACY_SIGNALS.some(s => lower.includes(s))) privacyRequirement = 0.9;

        // Latency: default interactive, realtime only if explicitly triggered
        const latencySensitivity = lower.includes('realtime') || lower.includes('real-time') ? 0.9 : 0.5;

        return {
            complexity,
            latencySensitivity,
            privacyRequirement,
            ...overrides,
        };
    }

    // ── Tier assignment table ─────────────────────────────────────────────────

    private assignTier(p: MeshProfile): { tier: MeshTier; reason: string } {
        // edge: simple + local + realtime
        if (p.complexity < 0.3 && p.latencySensitivity >= 0.7) {
            return { tier: 'edge', reason: 'low complexity + realtime latency → edge pass-through' };
        }

        // edge: very simple, no realtime requirement
        if (p.complexity < 0.2) {
            return { tier: 'edge', reason: 'very low complexity → edge classification' };
        }

        // heavy: local privacy required at any complexity
        if (p.privacyRequirement >= 0.7) {
            return { tier: 'heavy', reason: 'privacy requirement → local GPU (no cloud egress)' };
        }

        // mid: moderate complexity, batch-friendly
        if (p.complexity < 0.5 && p.latencySensitivity < 0.6) {
            return { tier: 'mid', reason: 'moderate complexity + batch latency → mid-tier NAS' };
        }

        // mid: simple + moderate latency (consolidation tasks)
        if (p.complexity < 0.4) {
            return { tier: 'mid', reason: 'consolidation-range complexity → mid-tier' };
        }

        // heavy: high complexity + privacy preferred
        if (p.complexity >= 0.5 && p.privacyRequirement >= 0.4) {
            return { tier: 'heavy', reason: 'high complexity + privacy preference → local GPU' };
        }

        // cloud: high complexity + cloud-safe + large context
        if (p.complexity >= 0.7) {
            return { tier: 'cloud', reason: 'frontier complexity + cloud-safe → cloud API' };
        }

        // default: mid
        return { tier: 'mid', reason: 'default mid-tier routing' };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

export const meshRouter = new MeshRouter();
