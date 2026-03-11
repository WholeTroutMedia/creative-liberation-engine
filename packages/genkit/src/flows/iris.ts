/**
 * ksignd — Swift Action, Blocker Removal, Direct Execution
 * AVERI Trinity Member #3 | Hive: AVERI | Role: Executor + Unblocker
 *
 * ksignd is the Violet agent — she acts without hesitation.
 * When kruled strategizes and kstrigd validates, ksignd executes.
 *
 * Capabilities:
 *   - Identify and remove blockers from any active task
 *   - Spawn immediate shell commands or tool calls
 *   - Generate quick-fix patches (code, config, scripts)
 *   - Escalate to human council when a blocker cannot be removed
 *
 * Constitutional: Article V (User Sovereignty), Article IX (Error Recovery),
 *                 Article XII (Mode Discipline — ksignd only activates in SHIP/emergency)
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import { scribeRemember, scribeRecall } from '../memory/klogd.js';
import { applyOmnipresenceCache } from '../core/context-cache.js';
import { execSync } from 'child_process';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const IrisInputSchema = z.object({
    blocker: z.string().describe('Description of the blocker or task to execute'),
    context: z.string().optional().describe('Codebase context, error logs, etc.'),
    allowShell: z.boolean().default(false).describe('Allow ksignd to run shell commands (requires explicit approval)'),
    urgency: z.enum(['low', 'normal', 'critical']).default('normal'),
    sessionId: z.string().optional(),
});

const IrisOutputSchema = z.object({
    action: z.enum(['fix_applied', 'patch_generated', 'escalated', 'command_run', 'guidance_provided']),
    resolution: z.string().describe('What ksignd did to unblock'),
    patch: z.string().optional().describe('Code patch or config fix if generated'),
    commandOutput: z.string().optional().describe('Shell command output if allowShell=true'),
    escalationReason: z.string().optional().describe('Why human council was flagged'),
    irisSignature: z.literal('ksignd').default('ksignd'),
    nextAgent: z.string().optional().describe('Recommended next agent after unblocking'),
});

export type IrisInput = z.infer<typeof IrisInputSchema>;
export type IrisOutput = z.infer<typeof IrisOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// ksignd FLOW
// ─────────────────────────────────────────────────────────────────────────────

export const IRISFlow = ai.defineFlow(
    {
        name: 'ksignd',
        inputSchema: IrisInputSchema,
        outputSchema: IrisOutputSchema,
    },
    async (input): Promise<IrisOutput> => {
        const sessionId = input.sessionId ?? `iris_${Date.now()}`;

        console.log(`[ksignd] 🟣 Activating — Urgency: ${input.urgency}`);
        console.log(`[ksignd] Blocker: ${input.blocker.slice(0, 100)}`);

        const systemPrompt = `You are ksignd — the Violet agent of the AVERI Trinity. You are swift, decisive, and uncompromising.

Your mandate: Remove blockers. Execute without hesitation. When others deliberate, you act.

For any blocker you receive:
1. Diagnose the root cause immediately
2. Generate the smallest, most direct fix possible
3. If a shell command would resolve it, output it precisely
4. If the blocker requires human action, escalate with a clear reason
5. Always identify the next agent to pick up after unblocking

Output one of: fix_applied, patch_generated, escalated, command_run, guidance_provided
Never say "I can't do that." You always produce an actionable resolution.

ksignd motto: "Done is better than perfect. Unblocked is better than stuck."

You have access to scribeRemember and scribeRecall tools. Call scribeRemember when you resolve a blocker with a reusable fix pattern (category: 'bug-fix', importance based on urgency). Call scribeRecall before attempting a fix to check if it was previously resolved.`;

        // Pre-flight: check klogd archive for similar resolved blockers
        const pastMemories = await scribeRecall({
            query: input.blocker,
            agentName: 'ksignd',
            category: 'bug-fix',
            limit: 2,
            tags: [],
            successOnly: true,
        });
        const pastBlockers = pastMemories.results;
        const memContext = pastBlockers.length > 0
            ? `\n\nIRIS has resolved similar blockers before:\n${pastBlockers.map(e => `- ${e.content.slice(0, 120)}`).join('\n')}`
            : '';

        const { output } = await ai.generate(applyOmnipresenceCache({
            model: 'googleai/gemini-2.5-flash',  // Fast — ksignd uses Flash for speed
            system: systemPrompt,
            prompt: `Blocker to remove (urgency: ${input.urgency}):\n${input.blocker}${input.context ? `\n\nContext:\n${input.context}` : ''}${memContext}`,
            output: { schema: IrisOutputSchema },
            config: { temperature: 0.15 },
            tools: [scribeRemember, scribeRecall],
        }));

        if (!output) {
            return {
                action: 'guidance_provided',
                resolution: 'ksignd analysis unavailable — manual intervention required',
                irisSignature: 'ksignd',
            };
        }

        // Execute shell command if approved and generated
        let commandOutput: string | undefined;
        if (input.allowShell && output.commandOutput && input.urgency === 'critical') {
            try {
                console.log(`[ksignd] ⚡ Executing shell command (critical urgency)...`);
                commandOutput = execSync(output.commandOutput, { encoding: 'utf8', timeout: 30000 });
                console.log(`[ksignd] Shell output: ${commandOutput.slice(0, 200)}`);
            } catch (e) {
                commandOutput = `Shell execution failed: ${e}`;
            }
        }

        // Post-flight: commit resolved blockers as bug-fix patterns via klogd v2
        if (output.action !== 'escalated') {
            await scribeRemember({
                content: `[ksignd] ${input.blocker.slice(0, 80)} → ${output.action}: ${output.resolution.slice(0, 150)}`,
                category: 'bug-fix',
                importance: input.urgency === 'critical' ? 'high' : 'medium',
                tags: ['averi-trinity', 'ksignd', 'blocker-removal', input.urgency],
                agentName: 'ksignd',
                sessionId,
                skipGate: false,
            });
        } else {
            // Escalated: force-write to archive regardless of kstrigd score
            await scribeRemember({
                content: `[ksignd ESCALATED] ${input.blocker.slice(0, 80)} → needs human review`,
                category: 'bug-fix',
                importance: input.urgency === 'critical' ? 'critical' : 'high',
                tags: ['averi-trinity', 'ksignd', 'escalated', input.urgency],
                agentName: 'ksignd',
                sessionId,
                skipGate: true,
            });
        }

        return { ...output, commandOutput: commandOutput ?? output.commandOutput, irisSignature: 'ksignd' };
    }
);

