import { z } from 'genkit';
import { ai } from '../index.js';
import { defaultMiddleware } from '../middleware/fallback-chain.js';
import { TaskSpecSchema } from './spec-compiler.js';

export const CriticValidationSchema = z.object({
    passed: z.boolean().describe('True if all acceptance criteria were observed to be met.'),
    feedback: z.string().describe('Detailed reasoning explaining why it passed or failed.'),
    missing_criteria: z.array(z.string()).describe('List of any acceptance criteria that were not satisfied or missing.'),
});

/**
 * Adversarial Critic Node (VALIDATE Mesh)
 * 
 * Invoked using the local NAS model llama3.2:3b to validate payload execution
 * against the formal TaskSpec acceptance criteria.
 */
export const criticNodeValidateFlow = ai.defineFlow(
    {
        name: 'criticNodeValidate',
        inputSchema: z.object({
            taskSpec: TaskSpecSchema,
            executionPayload: z.string().describe('The raw output or summary payload delivered by the executing agent.'),
        }),
        outputSchema: CriticValidationSchema,
    },
    async (input) => {
        // Enforce the routing to the BIOS VALIDATE tier model
        const validationModel = 'ollama-nas/llama3.2:3b'; // Provider + Model alias defined in genkit config
        const acceptanceBulletList = (input.taskSpec.acceptance as string[]).map((c) => `- ${c}`).join('\n');

        const { output } = await ai.generate({
            model: validationModel,
            prompt: `You are the Critic Node for the Creative Liberation Engine. Your role is adversarial validation.

You are evaluating the results of a task execution against its strict acceptance criteria.

TASK GOAL:
${input.taskSpec.goal}

ACCEPTANCE CRITERIA:
${acceptanceBulletList}

EXECUTION DELIVERABLE PAYLOAD:
${input.executionPayload}

—— INSTRUCTIONS ——
1. Methodically evaluate the deliverable against EACH acceptance criterion.
2. If ANY criterion is missing, incomplete, or violated, the validation FAILS (passed: false) and you must list the missing criteria.
3. If ALL criteria are demonstrably met in the payload, validation PASSES (passed: true).
4. Provide constructive feedback that the executing agent could use to fix the issue if it failed.
`,
            output: {
                schema: CriticValidationSchema,
            },
            config: {
                temperature: 0.05, // High determinant accuracy
            },
            use: defaultMiddleware(),
        });

        if (!output) {
            throw new Error('[CRITIC NODE] Failed to run validation — LLM returned null output');
        }

        return output;
    }
);
