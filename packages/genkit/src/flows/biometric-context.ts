/**
 * BiometricContextFlow — ANTITRUST Sensor Mesh Agent
 *
 * Exposes the live HumanStateContext as a Genkit flow.
 * Any agent in the mesh can call this to get the current operator state.
 *
 * Endpoints:
 *   POST /biometric-context → BiometricContextOutputSchema
 *
 * Constitutional:
 *   Article III (Human Supremacy) — operator state takes priority over AI defaults
 *   Article XX  (Zero Wait)       — 2s timeout, never blocks flow execution
 *   Article XXIV (Biometric Privacy — pending) — consent gate enforced
 *
 * @package @cle/genkit
 * @since 1.1.0
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import {
    getHumanStateContext,
} from '@cle/sensor-mesh';
import {
    HumanStateContextSchema,
    serializeHumanStateForPrompt,
} from '@cle/sensor-mesh';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const BiometricContextInputSchema = z.object({
    /**
     * When true, forces a cache-busted fresh fetch from BiometricBridge.
     * Use sparingly — cache is 10s for performance.
     */
    forceRefresh: z.boolean().default(false).describe(
        'Force bypass of the in-memory biometric cache'
    ),
    /**
     * If provided, return the serialized prompt string in the output.
     * Useful for debugging what gets injected into agent prompts.
     */
    includePromptString: z.boolean().default(false),
});

const BiometricContextOutputSchema = z.object({
    humanState: HumanStateContextSchema,
    /** Pre-serialized system prompt fragment (only if includePromptString=true) */
    promptFragment: z.string().optional(),
    /** Bridge reachability at time of call */
    bridgeOnline: z.boolean(),
    /** ISO8601 timestamp of this observation */
    observedAt: z.string(),
    contextSignature: z.literal('ANTITRUST').default('ANTITRUST'),
});

export type BiometricContextInput = z.infer<typeof BiometricContextInputSchema>;
export type BiometricContextOutput = z.infer<typeof BiometricContextOutputSchema>;

// ─── Flow ─────────────────────────────────────────────────────────────────────

export const BiometricContextFlow = ai.defineFlow(
    {
        name: 'biometric-context',
        inputSchema: BiometricContextInputSchema,
        outputSchema: BiometricContextOutputSchema,
    },
    async (input): Promise<BiometricContextOutput> => {
        const observedAt = new Date().toISOString();
        console.log(`[ANTITRUST] 🫀 Fetching operator state | forceRefresh=${input.forceRefresh}`);

        // Fetch HumanStateContext (always resolves — never throws)
        const humanState = await getHumanStateContext();
        const bridgeOnline = humanState.isFresh;

        const promptFragment = input.includePromptString
            ? serializeHumanStateForPrompt(humanState)
            : undefined;

        console.log(
            `[ANTITRUST] State: mood=${humanState.mood ?? 'unknown'} ` +
            `load=${humanState.cognitiveLoad ?? '?'} ` +
            `routing=${humanState.routingHint ?? 'standard'} ` +
            `consent=${humanState.consentMode} ` +
            `bridge=${bridgeOnline ? '🟢 online' : '🔴 offline'}`
        );

        return {
            humanState,
            promptFragment,
            bridgeOnline,
            observedAt,
            contextSignature: 'ANTITRUST',
        };
    }
);

// ─── Utility: inject human state into any generate() call ────────────────────

/**
 * Augment an existing Genkit generate options object with the current
 * HumanStateContext appended to the system prompt.
 *
 * Usage:
 *   const { output } = await ai.generate(
 *     await withHumanState({ model, system, prompt, output: { schema } })
 *   );
 *
 * The human state is always safe to inject — if sensors are offline or
 * consent mode is 'silent', the system prompt is returned unchanged.
 */
export async function withHumanState<T extends Record<string, any>>(
    opts: T
): Promise<T & { system?: string }> {
    try {
        const humanState = await getHumanStateContext();
        const fragment = serializeHumanStateForPrompt(humanState);
        if (!fragment) return opts; // consent=silent or offline

        return {
            ...opts,
            system: opts.system
                ? `${opts.system}\n\n${fragment}`
                : fragment,
        };
    } catch (err) {
        // Article XX: never block
        console.warn('[ANTITRUST] withHumanState failed silently:', err);
        return opts;
    }
}
