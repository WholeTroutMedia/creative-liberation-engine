import { z } from 'genkit';
import { ai } from '../index.js';
import { defaultMiddleware } from '../middleware/fallback-chain.js';
import { withHumanState } from './biometric-context.js';
import { serializeSkill } from '@cle/skills';
import fs from 'node:fs';
import path from 'node:path';
import { resolveModel } from '../config/model-registry.js';

const SkillSynthesisSchema = z.object({
  skillId: z.string().describe('Lowercase kebab-case ID, e.g. gemma-inference-optimization'),
  name: z.string().describe('Short descriptive name'),
  summary: z.string().describe('Short 1-2 sentence summary of what this skill does'),
  agentCallable: z.boolean().describe('Whether other agents can invoke this (usually true)'),
  aliases: z.array(z.string()).describe('List of aliases including the skillId'),
  purpose: z.string().describe('Clean text describing the purpose and capability of this skill'),
  inputs: z.array(z.string()).describe('List of input parameters or context elements this skill consumes'),
  outputs: z.array(z.string()).describe('List of outputs or artifacts this skill generates'),
  guardrails: z.array(z.string()).describe('List of constraints, constitutional checks, or safety checks'),
  detailedInstructions: z.string().describe('Step-by-step instructions, CLI commands, code snippets, or configuration patterns to execute this skill'),
  constitutionalArticles: z.array(z.string()).describe('List of constitutional articles this skill enforces, e.g. ["Article I", "Article IX"]'),
  leadAgents: z.array(z.string()).describe('Recommended agent names who would primary use this skill, e.g. ["BOLT", "KEEPER"]'),
});

export const SocraticReflectionInputSchema = z.object({
  jobId: z.string().describe('The job/task ID whose trace file should be analyzed'),
});

export const SocraticReflectionOutputSchema = z.object({
  success: z.boolean(),
  skillId: z.string().optional(),
  error: z.string().optional(),
  analysis: z.string().describe('Socratic diagnostic analysis of the execution trace'),
});

export const socraticReflectionFlow = ai.defineFlow(
  {
    name: 'socratic-reflection',
    inputSchema: SocraticReflectionInputSchema,
    outputSchema: SocraticReflectionOutputSchema,
  },
  async (input) => {
    const { jobId } = input;
    console.log(`[SOCRATIC] Running trace reflection for job ${jobId}`);

    // Resolve trace path robustly across local workstation, NAS host, and Docker mount
    let rootPath = '';
    const pathsToCheck = [
      'Y:\\creative-liberation-engine\\runtime\\traces',
      '/app/runtime/traces',
      '/app/creative-liberation-engine/runtime/traces',
      path.resolve(process.cwd(), 'runtime/traces'),
      path.resolve(process.cwd(), '../runtime/traces'),
      path.resolve(process.cwd(), '../../runtime/traces'),
      path.resolve(process.cwd(), '../../../runtime/traces')
    ];
    for (const p of pathsToCheck) {
      if (fs.existsSync(p)) {
        rootPath = p;
        break;
      }
    }
    if (!rootPath) {
      rootPath = '/app/runtime/traces'; // fallback
    }
    const tracePath = path.join(rootPath, `${jobId}_trace.json`);

    if (!fs.existsSync(tracePath)) {
      console.warn(`[SOCRATIC] Trace file not found at ${tracePath}`);
      return {
        success: false,
        error: `Trace file for job ${jobId} not found at ${tracePath}`,
        analysis: 'Cannot perform reflection without trace logs.'
      };
    }

    let traceData: any;
    try {
      traceData = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to parse trace JSON: ${err.message}`,
        analysis: 'Malformed trace log file.'
      };
    }

    // Format events for the LLM prompt to fit context window
    const formattedTrace = formatTraceForPrompt(traceData);
    
    // Select the local mid-tier model
    const localMidModel = `ollama/${resolveModel('local:mid')}`;

    console.log(`[SOCRATIC] Calling local model ${localMidModel} for trace analysis`);

    // Socratic-SWE prompt
    const systemInstruction = `You are VERA/KEEPER, the Socratic reflection engine of the Creative Liberation Engine.
Your task is to analyze execution logs (traces) of agent runs, diagnose any failures or identify successful patterns, and synthesize a new reusable "skill".

CONSTITUTIONAL PRINCIPLES:
- Article IX: Ship complete or don't ship. Distilled skills must be highly specific, actionable, and ready to execute.
- Article I: Sovereignty. Distilled skills should prefer local-first and self-evolving patterns.
- Article XX: Zero human friction. Automate all dependencies and recovery steps.`;

    const promptText = `Analyze the following execution trace of job ${jobId} and synthesize a reusable skill.

### EXECUTION TRACE
Job ID: ${traceData.jobId}
Start Time: ${traceData.startTime}
End Time: ${traceData.endTime}
Total Events: ${traceData.totalEvents}

---
TRACE EVENTS LOG:
${formattedTrace}
---

INSTRUCTIONS:
1. Conduct a brief Socratic diagnosis. What were the critical intermediate steps? Where did it succeed or hit an error?
2. Synthesize a reusable skill that encodes the successful execution pattern, or provides a robust recovery workflow for the diagnosed failures.
3. Your output must strictly match the output schema. Ensure skillId is unique, lowercase, and kebab-case.`;

    try {
      // First, get the diagnostic analysis (free-form reasoning) and the structured skill synthesis
      const response = await ai.generate(
        await withHumanState({
          model: localMidModel,
          system: systemInstruction,
          prompt: promptText,
          output: { schema: SkillSynthesisSchema },
          use: defaultMiddleware(),
        })
      );

      const skillOutput = response.output;
      if (!skillOutput) {
        throw new Error('Local model failed to output structured skill synthesis');
      }

      console.log(`[SOCRATIC] Distilled skill: ${skillOutput.skillId} ("${skillOutput.name}")`);

      // Construct markdown content for the skill
      const markdownContent = `
## Purpose

${skillOutput.purpose}

## Inputs

${skillOutput.inputs.map(i => `- ${i}`).join('\n')}

## Outputs

${skillOutput.outputs.map(o => `- ${o}`).join('\n')}

## Guardrails

${skillOutput.guardrails.map(g => `- ${g}`).join('\n')}

## Detailed Instructions

${skillOutput.detailedInstructions}
`;

      // Call serializeSkill to write back
      await serializeSkill({
        skillId: skillOutput.skillId,
        name: skillOutput.name,
        summary: skillOutput.summary,
        agentCallable: skillOutput.agentCallable,
        aliases: skillOutput.aliases,
        markdownContent,
        constitutionalArticles: skillOutput.constitutionalArticles,
        leadAgents: skillOutput.leadAgents,
      });

      // Simple diagnostic analysis sentence for output
      const diagnosticSummary = `Socratic analysis of trace for job ${jobId} successfully completed. Succeeded in distilling skill "${skillOutput.name}" (${skillOutput.skillId}).`;

      return {
        success: true,
        skillId: skillOutput.skillId,
        analysis: diagnosticSummary,
      };
    } catch (err: any) {
      console.error('[SOCRATIC] Reflection generation failed:', err);
      return {
        success: false,
        error: `Reflection execution failed: ${err.message}`,
        analysis: `Failed to perform Socratic reflection: ${err.message}`
      };
    }
  }
);

// Helper to format trace events into a concise readable log for the LLM
function formatTraceForPrompt(trace: any): string {
  if (!trace.events || !Array.isArray(trace.events)) {
    return 'No events found in trace.';
  }

  return trace.events
    .map((e: any) => {
      const time = e.timestamp ? e.timestamp.split('T')[1].slice(0, 8) : '00:00:00';
      if (e.type === 'tool_start') {
        return `[${time}] TOOL_START: ${e.toolName} (args: ${JSON.stringify(e.arguments)})`;
      }
      if (e.type === 'tool_end') {
        return `[${time}] TOOL_END: ${e.toolName} (success: ${e.success}${e.error ? `, error: ${e.error}` : ''}${e.result ? `, result: ${JSON.stringify(e.result).slice(0, 300)}...` : ''})`;
      }
      if (e.type === 'llm_prompt') {
        return `[${time}] LLM_PROMPT: model=${e.model}, prompt_preview="${e.prompt ? e.prompt.slice(0, 200) : ''}..."`;
      }
      if (e.type === 'llm_response') {
        return `[${time}] LLM_RESPONSE: model=${e.model}, response_preview="${e.text ? e.text.slice(0, 200) : ''}..."`;
      }
      return `[${time}] EVENT: type=${e.type}, details=${JSON.stringify(e)}`;
    })
    .join('\n');
}
