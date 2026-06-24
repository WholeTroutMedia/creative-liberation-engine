/**
 * composeHardenerFlow — Autonomous Compose DevOps Hardener
 * FORGE agent | SWITCHBOARD hive
 *
 * Route: POST /api/composeHardenerFlow
 * Called by: Genkit REST API, Dashboards
 */

import { ai, z } from '../index.js';
import { recordAgentCall } from './index.js';
import { hardenComposeFile } from '@cle/compose-hardener';

const ComposeHardenerInputSchema = z.object({
    taskId: z.string().optional().describe('Dispatch task ID (optional)'),
    yamlString: z.string().describe('The raw docker-compose.yml content to process'),
});

const ComposeHardenerOutputSchema = z.object({
    taskId: z.string().optional(),
    hardenedYaml: z.string().describe('The output YAML with injected healthchecks and limits'),
    summary: z.string().describe('Description of applied patches'),
});

export type ComposeHardenerInput = z.infer<typeof ComposeHardenerInputSchema>;
export type ComposeHardenerOutput = z.infer<typeof ComposeHardenerOutputSchema>;

export const composeHardenerFlow = ai.defineFlow(
    {
        name: 'composeHardenerFlow',
        inputSchema: ComposeHardenerInputSchema,
        outputSchema: ComposeHardenerOutputSchema,
    },
    async (input) => {
        const start = Date.now();
        recordAgentCall('RELAY'); // Route through RELAY

        console.log(`[FORGE:HARDENER] ▶ Task ID: ${input.taskId || 'ad-hoc'}`);

        let hardenedYaml = '';
        let errorMsg = null;
        try {
            hardenedYaml = await hardenComposeFile(input.yamlString);
        } catch (e: any) {
            console.error(`[FORGE:HARDENER] ✖ Hardening failed:`, e.message);
            errorMsg = e.message;
            hardenedYaml = input.yamlString; // fallback to original
        }

        const durationMs = Date.now() - start;
        console.log(`[FORGE:HARDENER] ✔ Task completed in ${durationMs}ms`);

        return {
            taskId: input.taskId,
            hardenedYaml,
            summary: errorMsg ? `Hardening failed: ${errorMsg}` : 'Successfully injected AST DevOps patches.',
        };
    }
);
