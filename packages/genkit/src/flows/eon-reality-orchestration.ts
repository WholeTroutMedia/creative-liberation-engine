import { ai, z } from '../index.js';
import { spatialCodexTools } from '../tools/spatial-codex-tools.js';

export const EonRealityOrchestrationInputSchema = z.object({
  hardwareQuery: z.string().describe('The target hardware to deploy to EON Reality (e.g., lawnmower, drone)'),
  dryRun: z.boolean().default(true).describe('If true, simulates the deployment without pushing to EON Live')
});

export const deployTrainingToEonFlow = ai.defineFlow(
  {
    name: 'deploy-training-to-eon',
    inputSchema: EonRealityOrchestrationInputSchema,
    outputSchema: z.unknown(),
  },
  async (input) => {
    console.log(`[EON-Orchestration] Initiating flow for: ${input.hardwareQuery} (dryRun=${input.dryRun})`);

    const { text } = await ai.generate({
      model: 'gemini-2.5-flash',
      tools: spatialCodexTools,
      system: `You are the Spatial Reality Orchestrator. 
Your objective is to deploy a 3D XR training simulation to EON Reality for a given hardware blueprint.
You have access to tools that can ingest hardware blueprints, search the codex, and deploy to EON Reality.
Try to deploy the hardware directly first using deployHardwareToEonReality. 
If it fails because it's missing from the codex, use ingestHardwareSpec to learn it, then deploy it again.
Do exactly what is asked and report the status.
`,
      prompt: `Deploy a spatial training environment for: ${input.hardwareQuery}. Dry run mode: ${input.dryRun}.`,
    });

    console.log(`[EON-Orchestration] Completion text: ${text}`);

    return {
      status: 'Flow Executed',
      agent_report: text
    };
  }
);
