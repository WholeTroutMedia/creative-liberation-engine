/**
 * SOLARIS — Structured Synthesis Engine
 * AVERI Consortium | Hive: VERA | Role: Reflection + Pattern Distillation
 *
 * Runs twice daily (06:30 AM + 10:00 PM) as a dedicated reflection cron.
 * NOT a task execution loop — this is mandated thinking time.
 *
 * Takes: 24h dispatch log, recent KEEPER commits, BACKLOG.md, incidents/
 * Produces: SYNTHESIS_{date}.md with patterns, anomalies, and priority shifts
 *
 * Constitutional: Article VII (Knowledge Compounding), Article II (Living Archive)
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import { scribeRecall, scribeRemember } from '../memory/scribe.js';
import { applyOmnipresenceCache } from '../core/context-cache.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Paths ────────────────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, '../../../../../');
const INCIDENTS_DIR = path.join(REPO_ROOT, 'incidents');
const BACKLOG_PATH = path.join(REPO_ROOT, 'BACKLOG.md');
const AGENTS_PATH = path.join(REPO_ROOT, 'AGENTS.md');
const VOICE_PATH = path.join(REPO_ROOT, 'VOICE_JUSTIN.md');
const SYNTHESIS_DIR = path.join(REPO_ROOT, 'packages/genkit/src/memory/synthesis');

// ── Schemas ──────────────────────────────────────────────────────────────────
const SolarisInputSchema = z.object({
    trigger: z.enum(['scheduled', 'manual']).default('scheduled'),
    windowHours: z.number().default(24).describe('How many hours back to look'),
    sessionId: z.string().optional(),
});

const SolarisOutputSchema = z.object({
    date: z.string(),
    patterns: z.array(z.string()).describe('Recurring patterns detected across the window'),
    anomalies: z.array(z.string()).describe('Unexpected behaviors or one-off events worth watching'),
    backlogShuffles: z.array(z.object({
        item: z.string(),
        currentPriority: z.string(),
        suggestedPriority: z.string(),
        reason: z.string(),
    })).describe('Suggested priority changes to BACKLOG.md'),
    agentsMdAmendments: z.array(z.string()).describe('Proposed rule additions/changes for AGENTS.md — require human approval'),
    confidenceMap: z.object({
        wellKnown: z.array(z.string()).describe('Domains the engine knows well'),
        thin: z.array(z.string()).describe('Domains with weak or stale context'),
    }),
    synthesis: z.string().describe('2-3 paragraph human-readable synthesis of the current state'),
    solarisSignature: z.literal('SOLARIS').default('SOLARIS'),
});

export type SolarisOutput = z.infer<typeof SolarisOutputSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────────
function readIncidents(): string {
    try {
        const files = fs.readdirSync(INCIDENTS_DIR)
            .filter(f => f.endsWith('.md') && !f.startsWith('_'))
            .sort()
            .reverse()
            .slice(0, 10); // last 10 incidents
        return files.map(f => {
            const content = fs.readFileSync(path.join(INCIDENTS_DIR, f), 'utf-8');
            return `--- ${f} ---\n${content.slice(0, 800)}`;
        }).join('\n\n');
    } catch {
        return 'No incidents directory found.';
    }
}

function readBacklog(): string {
    try {
        return fs.readFileSync(BACKLOG_PATH, 'utf-8').slice(0, 3000);
    } catch {
        return 'BACKLOG.md not found.';
    }
}

function readAgentsMd(): string {
    try {
        return fs.readFileSync(AGENTS_PATH, 'utf-8').slice(0, 2000);
    } catch {
        return 'AGENTS.md not found.';
    }
}

function writeSynthesisToFile(date: string, output: SolarisOutput): void {
    try {
        fs.mkdirSync(SYNTHESIS_DIR, { recursive: true });
        const filePath = path.join(SYNTHESIS_DIR, `SYNTHESIS_${date}.md`);
        const content = `# SOLARIS Synthesis — ${date}

Generated: ${new Date().toISOString()} | Trigger: scheduled

## Patterns
${output.patterns.map(p => `- ${p}`).join('\n')}

## Anomalies
${output.anomalies.map(a => `- ${a}`).join('\n')}

## Confidence Map
**Well-known domains:** ${output.confidenceMap.wellKnown.join(', ')}
**Thin context:** ${output.confidenceMap.thin.join(', ')}

## Backlog Priority Recommendations
${output.backlogShuffles.map(s => `- **${s.item}**: ${s.currentPriority} → ${s.suggestedPriority} *(${s.reason})*`).join('\n') || 'No changes recommended.'}

## Proposed AGENTS.md Amendments
> ⚠️ Requires Artist's approval before merging to main.
${output.agentsMdAmendments.map(a => `- ${a}`).join('\n') || 'None this cycle.'}

## Synthesis
${output.synthesis}
`;
        fs.writeFileSync(filePath, content);
        console.log(`[SOLARIS] 📄 Synthesis written → ${filePath}`);
    } catch (e) {
        console.error('[SOLARIS] Failed to write synthesis file:', e);
    }
}

// ── SOLARIS Flow ─────────────────────────────────────────────────────────────
export const SOLARISFlow = ai.defineFlow(
    {
        name: 'SOLARIS',
        inputSchema: SolarisInputSchema,
        outputSchema: SolarisOutputSchema,
    },
    async (input): Promise<SolarisOutput> => {
        const sessionId = input.sessionId ?? `solaris_${Date.now()}`;
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        console.log(`[SOLARIS] 🌅 Synthesis run starting — ${dateStr} (${input.trigger})`);

        // ── Gather context ───────────────────────────────────────────────────
        const [recentMemories, incidents, backlog, agentsMd] = await Promise.all([
            scribeRecall({
                query: 'system patterns decisions incidents dispatch',
                agentName: 'SOLARIS',
                limit: 20,
                tags: [],
                successOnly: false,
            }),
            Promise.resolve(readIncidents()),
            Promise.resolve(readBacklog()),
            Promise.resolve(readAgentsMd()),
        ]);

        const recentEpisodes = recentMemories.results
            .map(e => `[${e.createdAt?.slice(0, 10) ?? 'unknown'}] ${e.content.slice(0, 200)}`)
            .join('\n');

        // ── Generate synthesis ───────────────────────────────────────────────
        const { output } = await ai.generate(applyOmnipresenceCache({
            model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-pro',
            config: { temperature: 0.2 },
            system: `You are SOLARIS — the Creative Liberation Engine's structured reflection system.
You run twice daily and your ONLY job is to think about patterns, not execute tasks.

You are analyzing the last ${input.windowHours} hours of system activity. You have access to:
- Recent memory entries from KEEPER/SCRIBE
- The incident registry
- The current BACKLOG.md
- The current AGENTS.md

Your job:
1. Detect patterns (things that keep happening)
2. Flag anomalies (things that happened once but shouldn't be ignored)
3. Recommend BACKLOG priority changes based on recent evidence
4. Propose AGENTS.md amendments for behaviors that should become rules
5. Build a confidence map: what does the engine know well vs. thinly?
6. Write a 2-3 paragraph synthesis that Artist can read in 30 seconds

Be specific. Vague patterns are useless. "The deploy pipeline fails after workstation sleep" is useful. "Communication could be improved" is not.

Proposed AGENTS.md amendments MUST follow this format:
"[PROPOSED RULE] If [condition], then [action] because [reason from incident]."

These proposals go to Artist for approval. They never auto-merge.`,
            prompt: `Synthesis window: last ${input.windowHours} hours
Current date: ${dateStr}

RECENT MEMORY ENTRIES (last ${recentMemories.results.length}):
${recentEpisodes || 'No recent memories found.'}

INCIDENT REGISTRY (recent):
${incidents}

CURRENT BACKLOG (excerpt):
${backlog}

CURRENT AGENTS.md (excerpt):
${agentsMd}

Generate a complete SOLARIS synthesis for this window.`,
            output: { schema: SolarisOutputSchema },
        }));

        if (!output) {
            return {
                date: dateStr,
                patterns: [],
                anomalies: ['SOLARIS synthesis failed — LLM unavailable'],
                backlogShuffles: [],
                agentsMdAmendments: [],
                confidenceMap: { wellKnown: [], thin: ['all domains'] },
                synthesis: 'Synthesis unavailable — engine offline during reflection window.',
                solarisSignature: 'SOLARIS',
            };
        }

        const result = { ...output, date: dateStr, solarisSignature: 'SOLARIS' as const };

        // ── Persist synthesis ────────────────────────────────────────────────
        writeSynthesisToFile(dateStr, result);

        // ── Commit key patterns to KEEPER ────────────────────────────────────
        for (const pattern of result.patterns.slice(0, 3)) {
            await scribeRemember({
                content: `[SOLARIS pattern] ${pattern}`,
                category: 'pattern',
                importance: 'high',
                tags: ['solaris', 'synthesis', 'pattern'],
                agentName: 'SOLARIS',
                sessionId,
                skipGate: false,
            });
        }

        console.log(`[SOLARIS] ✅ Synthesis complete — ${result.patterns.length} patterns, ${result.anomalies.length} anomalies, ${result.agentsMdAmendments.length} proposed amendments`);
        return result;
    }
);
