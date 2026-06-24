/**
 * Task Classification Flow
 *
 * Genkit flow that replaces NEXUS TaskClassifierV2.
 * Takes a user request string, uses LLM to classify intent,
 * returns structured TaskClassification.
 *
 * Constitutional: Article V (Transparency) — full reasoning in classification
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import { defaultMiddleware } from '../middleware/fallback-chain.js';
import { autoRetrieveContext } from '../memory/auto-retrieve.js';
import { withHumanState } from './biometric-context.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const MeshIntentSchema = z.enum(['EXPLORE', 'EXECUTE', 'VALIDATE']).describe('Routing mesh intent');
export const TaskClassSchema = z.enum(['ROUTINE', 'FEATURE', 'APP', 'EXPERIMENT']).describe('Routing task classification');
export const ModelRouteSchema = z.object({
    provider: z.string().describe('Model provider (e.g. vertex, ollama-nas, googleai)'),
    model: z.string().describe('Model name (e.g. googleai/gemini-2.5-flash, ollama/phi4-mini)'),
    temperature: z.number().optional().describe('Inference temperature'),
}).describe('Model route specification');

export const TaskClassificationSchema = z.object({
    primaryObjective: z.string().describe('Concise one-sentence goal'),
    requiredCapabilities: z.array(z.string()).describe('Required capabilities: code, strategy, design, search, memory, browser, media'),
    complexityScore: z.number().min(1).max(10).describe('Task complexity 1-10'),
    modeSuggestion: z.enum(['IDEATE', 'PLAN', 'SHIP', 'VALIDATE']).describe('Recommended operational mode'),
    requiresBrowser: z.boolean().describe('Whether browser automation is needed'),
    estimatedCredits: z.number().describe('Estimated API credit cost'),
    suggestedAgents: z.array(z.string()).describe('Recommended agent names: BOLT, AURORA, KEEPER, etc.'),
    reasoning: z.string().describe('Transparent reasoning for classification'),
    
    // Optional routing fields
    taskClass: TaskClassSchema.optional(),
    meshIntent: MeshIntentSchema.optional(),
    modelRoute: ModelRouteSchema.optional(),
});

export type TaskClassification = z.infer<typeof TaskClassificationSchema>;

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

export const classifyTaskFlow = ai.defineFlow(
    {
        name: 'classifyTask',
        inputSchema: z.object({
            userRequest: z.string().describe('Raw natural-language task description'),
            /** When set, used as-is (no second retrieve). Omit to auto-retrieve from Chroma. */
            memoryContext: z.string().optional().describe('Pre-fetched memory; omit for automatic SCRIBE/Chroma grounding'),
        }),
        outputSchema: TaskClassificationSchema,
    },
    async (input) => {
        let memoryContext = input.memoryContext;
        if (memoryContext === undefined) {
            memoryContext = await autoRetrieveContext(input.userRequest.trim(), 5);
        }

        const memorySection =
            memoryContext?.trim() ?
                `\n\nInstitutional memory (retrieved — use to bias mode and agents, not to override the user request):\n${memoryContext.trim()}\n`
                : '';

        const { output } = await ai.generate(
            await withHumanState({
                prompt: `You are the NEXUS task classifier for the Creative Liberation Engine agentic OS.

Analyze the following user request and classify it.

User request:
${input.userRequest}
${memorySection}
Consider the full spectrum of capabilities: code generation, strategic planning, creative design, web search, memory operations, browser automation, and media generation.

Suggest agents from: BOLT (builder), AURORA (architect), KEEPER (knowledge), ARCH (patterns), CODEX (docs), LEX (compliance), COMPASS (constitution), RELAY (routing), SIGNAL (integration), COMET (automator).`,
                output: { schema: TaskClassificationSchema },
                use: defaultMiddleware(),
            })
        );

        if (!output) {
            // Fallback classification if LLM fails
            return {
                primaryObjective: input.userRequest.slice(0, 100),
                requiredCapabilities: ['chat'],
                complexityScore: 3,
                modeSuggestion: 'SHIP' as const,
                requiresBrowser: false,
                estimatedCredits: 1,
                suggestedAgents: ['BOLT'],
                reasoning: 'Fallback classification — LLM classification unavailable',
            };
        }

        return output;
    }
);
