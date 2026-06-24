/**
 * Spec Compiler Flow — v1
 *
 * Translates raw ideation text (IDEATE output or freeform user intent) into a
 * typed TaskSpec contract before anything enters the dispatch queue.
 *
 * This is the formal seam between "thinking" and "doing" in the Creative Liberation Engine.
 *
 * Behaviour:
 *   - Always runs and surfaces the compiled spec to the operator (never silent)
 *   - `reviewPolicy` is derived from `taskClass` and controls the dispatch UI:
 *       ROUTINE     → auto_queue (compact card, 10s window, one-click override)
 *       FEATURE     → expand_review (all fields visible + editable before queue)
 *       APP         → full_brief (dispatch button disabled until required fields confirmed)
 *       EXPERIMENT  → explore_first (routes to EXPLORE mesh, not EXECUTE)
 *
 * Constitutional: Article XX (No human wait time — ROUTINE tasks are auto-approved)
 *                 Article V  (Transparency — spec always surfaced, never hidden)
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import { defaultMiddleware } from '../middleware/fallback-chain.js';
import {
    MeshIntentSchema,
    TaskClassSchema,
    ModelRouteSchema,
    type TaskClassification,
} from './classify-task.js';

// ---------------------------------------------------------------------------
// Review Policy — derived from taskClass, controls dispatch UI behaviour
// ---------------------------------------------------------------------------

export const ReviewPolicySchema = z.object({
    mode: z.enum(['auto_queue', 'expand_review', 'full_brief', 'explore_first']).describe(
        'auto_queue: compact card, 10s countdown then auto-dispatch; ' +
        'expand_review: all fields visible + editable, explicit approve required; ' +
        'full_brief: goal/constraints/acceptance all required, dispatch gated; ' +
        'explore_first: task sent to EXPLORE mesh, not EXECUTE',
    ),
    autoQueueDelayMs: z.number().optional().describe(
        'For auto_queue mode: milliseconds before auto-dispatch. Default 10000.',
    ),
    requiredFields: z.array(z.string()).optional().describe(
        'For full_brief mode: field names that must be confirmed before dispatch unlocks.',
    ),
    editableFields: z.array(z.string()).optional().describe(
        'For expand_review/full_brief: fields the operator can edit inline before dispatch.',
    ),
});

export type ReviewPolicy = z.infer<typeof ReviewPolicySchema>;

// ---------------------------------------------------------------------------
// TaskSpec — the typed contract that enters the dispatch queue
// ---------------------------------------------------------------------------

export const TaskSpecSchema = z.object({
    // Identity
    specId: z.string().describe('UUID generated at compile time — stable reference for the task throughout its lifecycle'),
    compiledAt: z.string().describe('ISO timestamp of spec compilation'),

    // Intent
    goal: z.string().describe('Single declarative sentence: what does success look like?'),
    context: z.string().optional().describe('Background, constraints, or relevant history the executing agent must know'),

    // Constraints
    constraints: z.array(z.string()).describe('Hard limits — things the executing agent must not do or exceed'),
    acceptance: z.array(z.string()).describe('Acceptance criteria — observable conditions that prove the goal was met'),

    // Routing
    meshIntent: MeshIntentSchema,
    taskClass: TaskClassSchema,
    modelRoute: ModelRouteSchema,

    // Memory
    memory_writes: z.array(z.string()).describe(
        'Keys the executing agent is expected to write to Working Memory on completion. ' +
        'These become the promotion candidates for Episodic Memory (cle-dream).',
    ),

    // Dispatch review policy — drives UI behaviour
    reviewPolicy: ReviewPolicySchema,

    // Raw input preserved for audit
    rawInput: z.string().describe('The original ideation text or intent string, unmodified'),
});

export type TaskSpec = z.infer<typeof TaskSpecSchema>;

// ---------------------------------------------------------------------------
// Review Policy derivation helper
// ---------------------------------------------------------------------------

export function deriveReviewPolicy(taskClass: z.infer<typeof TaskClassSchema>): ReviewPolicy {
    switch (taskClass) {
        case 'ROUTINE':
            return {
                mode: 'auto_queue',
                autoQueueDelayMs: 10_000,
                editableFields: ['goal', 'constraints'],
            };
        case 'FEATURE':
            return {
                mode: 'expand_review',
                editableFields: ['goal', 'constraints', 'acceptance', 'memory_writes'],
            };
        case 'APP':
            return {
                mode: 'full_brief',
                requiredFields: ['goal', 'constraints', 'acceptance'],
                editableFields: ['goal', 'context', 'constraints', 'acceptance', 'memory_writes'],
            };
        case 'EXPERIMENT':
            return {
                mode: 'explore_first',
                editableFields: ['goal', 'context'],
            };
    }
}

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

export const specCompilerFlow = ai.defineFlow(
    {
        name: 'specCompiler',
        inputSchema: z.object({
            /** Raw ideation text — IDEATE output, AVERI conversation segment, or freeform intent */
            rawInput: z.string().describe('The ideation text or intent to compile'),
            /** Optional pre-classification. If omitted, spec compiler infers its own routing. */
            classification: z.custom<TaskClassification>().optional(),
        }),
        outputSchema: TaskSpecSchema,
    },
    async (input) => {
        const specId = crypto.randomUUID();
        const compiledAt = new Date().toISOString();

        // Determine which model to use for compilation:
        //   ROUTINE / EXECUTE → fast local (phi4-mini on NAS)
        //   FEATURE / APP / EXPERIMENT → Gemini Flash
        const taskClass = input.classification?.taskClass;
        const useLocalForCompilation = taskClass === 'ROUTINE';
        const compilationModel = useLocalForCompilation
            ? 'ollama/phi4-mini'
            : (process.env.GENKIT_DEFAULT_MODEL ?? 'googleai/gemini-2.5-flash');

        const classificationContext = input.classification
            ? `\n\nPre-classification context:\n` +
              `  meshIntent: ${input.classification.meshIntent}\n` +
              `  taskClass: ${input.classification.taskClass}\n` +
              `  primaryObjective: ${input.classification.primaryObjective}\n` +
              `  suggestedAgents: ${input.classification.suggestedAgents.join(', ')}\n` +
              `  modelRoute: ${input.classification.modelRoute.provider} → ${input.classification.modelRoute.model}`
            : '';

        const { output } = await ai.generate({
            model: compilationModel,
            prompt: `You are the Spec Compiler for the Creative Liberation Engine agentic OS.

Transform the following ideation text into a precise, executable TaskSpec.

IDEATION INPUT:
${input.rawInput}
${classificationContext}

—— SPEC COMPILER RULES ——

goal:
  Write a single declarative sentence that states what success looks like.
  Start with a verb. Be specific enough that any agent can execute without asking follow-up questions.

constraints:
  List 3–7 hard limits. Start each with "Must not" or "Must". Be concrete.
  Include: scope limits, budget/credit limits, systems not to touch, output format requirements.

acceptance:
  List 3–5 observable conditions that prove the goal was met.
  Each criterion must be independently verifiable without asking the operator.

meshIntent: Choose ONE of EXPLORE | EXECUTE | VALIDATE
taskClass:  Choose ONE of ROUTINE | FEATURE | APP | EXPERIMENT

modelRoute: Derive from meshIntent:
  EXPLORE  → provider: vertex, model: googleai/gemini-2.5-pro, temperature: 1.0
  EXECUTE (FEATURE/APP) → provider: vertex, model: googleai/gemini-2.5-flash, temperature: 0.2
  EXECUTE (ROUTINE) → provider: ollama-nas, model: ollama/phi4-mini, temperature: 0.1
  VALIDATE → provider: ollama-nas, model: ollama/llama3.2:3b, temperature: 0.05

memory_writes:
  List the Redis Working Memory keys the executing agent should write on completion.
  Use snake_case. Examples: last_shipped_component, spec_compiler_validation_result.

context:
  Optional. Include only if context is NOT already inferable from the goal.`,
            output: {
                schema: z.object({
                    goal: z.string(),
                    context: z.string().optional(),
                    constraints: z.array(z.string()),
                    acceptance: z.array(z.string()),
                    meshIntent: MeshIntentSchema,
                    taskClass: TaskClassSchema,
                    modelRoute: ModelRouteSchema,
                    memory_writes: z.array(z.string()),
                }),
            },
            use: defaultMiddleware(),
        });

        if (!output) {
            throw new Error('[SPEC COMPILER] Failed to compile TaskSpec — LLM returned null output');
        }

        const reviewPolicy = input.classification?.taskClass
            ? deriveReviewPolicy(input.classification.taskClass)
            : deriveReviewPolicy(output.taskClass);

        return {
            specId,
            compiledAt,
            goal: output.goal,
            context: output.context,
            constraints: output.constraints,
            acceptance: output.acceptance,
            meshIntent: output.meshIntent,
            taskClass: output.taskClass,
            modelRoute: output.modelRoute,
            memory_writes: output.memory_writes,
            reviewPolicy,
            rawInput: input.rawInput,
        };
    }
);
