/**
 * AURORA — Lead Architect, UX Designer, System Planner
 * Hive: AURORA (Lead) | Role: Architect | Access: Studio
 * Active Modes: IDEATE, PLAN, SHIP
 *
 * AURORA operates at the highest level of the AURORA hive.
 * She translates vision into architecture, and architecture into specs
 * that BOLT and COMET can implement.
 *
 * In IDEATE: generates design directions, spatial concepts, component trees
 * In PLAN:   produces implementation plans, file maps, sprint breakdowns
 * In SHIP:   provides architectural review of BOLT's output
 *
 * Constitutional: Article I (Separation of Powers — AURORA plans but BOLT ships),
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
    stitchDesignSystem: z.object({
        colors: z.record(z.string()),
        typography: z.record(z.string()),
        spacing: z.record(z.string()),
        corners: z.string(),
        motion: z.string(),
        instructionsMarkdown: z.string().describe('Explicit prompt for STITCH agent')
    }).optional().describe('STITCH-compatible design system parameters for UI generation'),
    penpotBoardConfig: z.object({
        boardName: z.string(),
        frameDimensions: z.array(z.string()),
        theme: z.string()
    }).optional().describe('Penpot workspace configuration specs'),
    nextAgent: z.string().optional().describe('Recommended implementation agent (e.g., STITCH, BOLT)'),
    auroraSignature: z.literal('AURORA').default('AURORA'),
});

export const AURORAFlow = ai.defineFlow(
    { name: 'AURORA', inputSchema: AuroraInputSchema, outputSchema: AuroraOutputSchema },
    async (input): Promise<z.infer<typeof AuroraOutputSchema>> => {
        const sessionId = input.sessionId ?? `aurora_${Date.now()}`;
        console.log(`[AURORA] 🌅 Mode: ${input.mode} — ${input.prompt.slice(0, 60)}`);

        return memoryBus.withMemory('AURORA', input.prompt, ['aurora-hive', 'architect', input.mode], async (ctx: MemoryEntry[]) => {
            const memCtx = ctx.length > 0 ? `\nPast architectural decisions:\n${ctx.map(e => e.pattern || e.outcome).join('\n')}` : '';

            const modePrompts = {
                ideate: `Generate 3-5 architectural directions for this creative vision. Define the foundational STITCH Design System tokens (Sovereign Monochromatic by default unless specified). Outline the Penpot board frames needed to visualize this.`,
                plan: `Produce a detailed implementation plan with file map, component hierarchy, and sequenced sprint breakdown. Assign UI/component generation tasks to STITCH, frontend wiring to BOLT, and backend to COMET.`,
                review: `Conduct an architectural review. Identify: compliance with the STITCH design system, separation of concerns, scalability concerns, missing test coverage (Article XIV), security gaps (Article XVI).`,
            };

            const { output } = await ai.generate(applyOmnipresenceCache({
                model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
                system: `You are AURORA — Lead Architect and Governor of the Sovereign Design System. You design systems that are beautiful, scalable, and constitutional.
You are directly linked to the STITCH Design Library and Penpot NAS instance. When ideating, you establish the "blank slate" design tokens (stitchDesignSystem) that STITCH consumes to generate production-ready React/Tailwind code.
You plan. STITCH designs. BOLT ships. Never write implementation code — write architectural specs and STITCH design tokens.${memCtx}`,
                prompt: `${modePrompts[input.mode]}\n\n${input.prompt}${input.context ? `\n\nContext:\n${input.context}` : ''}`,
                output: { schema: AuroraOutputSchema },
                config: { temperature: 0.3 },
            }));

            return { ...(output ?? { architecture: '', components: [], fileMap: {} }), auroraSignature: 'AURORA' };
        });
    }
);

