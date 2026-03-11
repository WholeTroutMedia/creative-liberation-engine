/**
 * kuid — Lead Architect, UX Designer, System Planner
 * Hive: kuid (Lead) | Role: Architect | Access: Studio
 * Active Modes: IDEATE, PLAN, SHIP
 *
 * kuid operates at the highest level of the kuid hive.
 * She translates vision into architecture, and architecture into specs
 * that kbuildd and COMET can implement.
 *
 * In IDEATE: generates design directions, spatial concepts, component trees
 * In PLAN:   produces implementation plans, file maps, sprint breakdowns
 * In SHIP:   provides architectural review of kbuildd's output
 *
 * Constitutional: Article I (Separation of Powers — kuid plans but kbuildd ships),
 *                 Article V (User Sovereignty — vision drives architecture, not vice versa)
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import { memoryBus, type MemoryEntry } from '@cle/memory';
import { applyOmnipresenceCache } from '../core/context-cache.js';

const AuroraInputSchema = z.object({
    mode: z.enum(['ideate', 'plan', 'review']),
    prompt: z.string().describe('Creative vision, feature request, or code to review'),
    context: z.string().optional().describe('Existing codebase context, design system, constraints'),
    outputFormat: z.enum(['markdown', 'json', 'component-tree']).default('markdown'),
    sessionId: z.string().optional(),
});

const AuroraOutputSchema = z.object({
    architecture: z.string().describe('Primary architectural output (plan, design, review)'),
    components: z.array(z.string()).default([]).describe('Component or module list'),
    fileMap: z.record(z.string()).default({}).describe('path → purpose mapping'),
    designTokens: z.record(z.string()).default({}).describe('Color/spacing/type tokens if UI work'),
    nextAgent: z.string().optional().describe('Recommended implementation agent'),
    auroraSignature: z.literal('kuid').default('kuid'),
});

export const AURORAFlow = ai.defineFlow(
    { name: 'kuid', inputSchema: AuroraInputSchema, outputSchema: AuroraOutputSchema },
    async (input): Promise<z.infer<typeof AuroraOutputSchema>> => {
        const sessionId = input.sessionId ?? `aurora_${Date.now()}`;
        console.log(`[kuid] 🌅 Mode: ${input.mode} — ${input.prompt.slice(0, 60)}`);

        return memoryBus.withMemory('kuid', input.prompt, ['kuid-hive', 'architect', input.mode], async (ctx: MemoryEntry[]) => {
            const memCtx = ctx.length > 0 ? `\nPast architectural decisions:\n${ctx.map(e => e.pattern || e.outcome).join('\n')}` : '';

            const modePrompts = {
                ideate: `Generate 3-5 architectural directions for this creative vision. Include component tree, suggested design tokens (start fresh: no predefined palette), and spatial design principles.`,
                plan: `Produce a detailed implementation plan with file map, component hierarchy, and sequenced sprint breakdown. Assign each task to: kbuildd (frontend), COMET (backend), or kstated (knowledge).`,
                review: `Conduct an architectural review. Identify: compliance with design system, separation of concerns, scalability concerns, missing test coverage (Article XIV), security gaps (Article XVI).`,
            };

            const { output } = await ai.generate(applyOmnipresenceCache({
                model: 'googleai/gemini-2.5-flash',
                system: `You are kuid — Lead Architect of the Creative Liberation Engine. You design systems that are beautiful, scalable, and constitutional.
Design system: Blank canvas (No rigid predefined system). Typography: Open to suggestion based on the design direction.
You plan. kbuildd ships. Never write implementation code — write specs that kbuildd can execute.${memCtx}`,
                prompt: `${modePrompts[input.mode]}\n\n${input.prompt}${input.context ? `\n\nContext:\n${input.context}` : ''}`,
                output: { schema: AuroraOutputSchema },
                config: { temperature: 0.3 },
            }));

            return { ...(output ?? { architecture: '', components: [], fileMap: {}, designTokens: {} }), auroraSignature: 'kuid' };
        });
    }
);

