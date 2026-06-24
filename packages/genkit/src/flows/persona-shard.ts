/**
 * Persona Shard Spawner — Tiered Intelligence Layer
 * AVERI Consortium | Hive: PRISM | Role: Lightweight Execution
 *
 * Orchestrators (ATHENA, VERA, IRIS) make decisions.
 * Persona shards execute. This is that boundary.
 *
 * Shards are single-responsibility, stateless, model-agnostic runners
 * loaded from packages/personas/*.md. They cost 1/10th of an orchestrator call.
 *
 * Constitutional: Article XX (zero wait), Article VI (model agnosticism)
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../../');
const PERSONAS_DIR = path.join(REPO_ROOT, 'packages/personas');
const VOICE_PATH = path.join(REPO_ROOT, 'VOICE_JUSTIN.md');

// ── Shard model — cheaper, faster, focused ───────────────────────────────────
const SHARD_MODEL = process.env.PERSONA_SHARD_MODEL || 'googleai/gemini-2.0-flash';

// ── Schemas ──────────────────────────────────────────────────────────────────
export const PersonaShardInputSchema = z.object({
    shard: z.string().describe('Persona shard name — matches a file in packages/personas/ (without .md)'),
    task: z.string().describe('The specific task for this shard to execute'),
    content: z.string().optional().describe('Input content (draft, code, data) for the shard to process'),
    context: z.string().optional().describe('Additional context injected by the orchestrator'),
    loadVoice: z.boolean().default(true).describe('Whether to inject VOICE_JUSTIN.md — always true for content shards'),
    sessionId: z.string().optional(),
});

export const PersonaShardOutputSchema = z.object({
    result: z.string().describe('The shard output'),
    shardUsed: z.string(),
    modelUsed: z.string(),
    notes: z.array(z.string()).default([]).describe('Flagged concerns, uncertainties, or items needing orchestrator review'),
    escalate: z.boolean().default(false).describe('True if the shard cannot complete the task and needs orchestrator intervention'),
});

export type PersonaShardInput = z.infer<typeof PersonaShardInputSchema>;
export type PersonaShardOutput = z.infer<typeof PersonaShardOutputSchema>;

// ── Load shard definition ────────────────────────────────────────────────────
function loadShard(shardName: string): string {
    const shardPath = path.join(PERSONAS_DIR, `${shardName}.md`);
    if (!fs.existsSync(shardPath)) {
        throw new Error(`Persona shard not found: ${shardName} (looked at ${shardPath})`);
    }
    return fs.readFileSync(shardPath, 'utf-8');
}

function loadVoice(): string {
    try {
        return fs.readFileSync(VOICE_PATH, 'utf-8');
    } catch {
        return '';
    }
}

// ── List available shards ────────────────────────────────────────────────────
export function listAvailableShards(): string[] {
    try {
        return fs.readdirSync(PERSONAS_DIR)
            .filter(f => f.endsWith('.md'))
            .map(f => f.replace('.md', ''));
    } catch {
        return [];
    }
}

// ── Spawn Flow ───────────────────────────────────────────────────────────────
export const spawnPersonaShardFlow = ai.defineFlow(
    {
        name: 'spawnPersonaShard',
        inputSchema: PersonaShardInputSchema,
        outputSchema: PersonaShardOutputSchema,
    },
    async (input): Promise<PersonaShardOutput> => {
        const sessionId = input.sessionId ?? `shard_${Date.now()}`;
        console.log(`[PERSONA_SHARD] 🧩 Spawning: ${input.shard} — ${input.task.slice(0, 60)}`);

        // Load shard definition
        let shardDef: string;
        try {
            shardDef = loadShard(input.shard);
        } catch (e) {
            return {
                result: '',
                shardUsed: input.shard,
                modelUsed: SHARD_MODEL,
                notes: [`Shard not found: ${input.shard}. Available: ${listAvailableShards().join(', ')}`],
                escalate: true,
            };
        }

        // Optionally inject VOICE_JUSTIN
        const voiceContext = input.loadVoice ? loadVoice() : '';
        const voiceSection = voiceContext
            ? `\n\n--- VOICE CONTEXT (read before producing any output) ---\n${voiceContext.slice(0, 2000)}\n---\n`
            : '';

        const systemPrompt = `${shardDef}${voiceSection}

You are a persona shard. You are NOT an orchestrator. You do not decide what task to do next.
You receive exactly one task. You execute it and return the result.
If you cannot complete the task, set escalate=true and explain why in notes.
Do not pad your output. Do not explain what you're about to do. Do the thing.`;

        const userPrompt = `Task: ${input.task}${input.content ? `\n\nContent to process:\n${input.content}` : ''}${input.context ? `\n\nContext from orchestrator:\n${input.context}` : ''}`;

        try {
            const { output } = await ai.generate({
                model: SHARD_MODEL,
                system: systemPrompt,
                prompt: userPrompt,
                output: { schema: PersonaShardOutputSchema },
                config: { temperature: 0.3 },
            });

            if (!output) {
                return {
                    result: '',
                    shardUsed: input.shard,
                    modelUsed: SHARD_MODEL,
                    notes: ['Shard returned no output — model failure'],
                    escalate: true,
                };
            }

            return { ...output, shardUsed: input.shard, modelUsed: SHARD_MODEL };
        } catch (e) {
            console.error(`[PERSONA_SHARD] ❌ Shard ${input.shard} failed:`, e);
            return {
                result: '',
                shardUsed: input.shard,
                modelUsed: SHARD_MODEL,
                notes: [`Shard execution error: ${String(e).slice(0, 200)}`],
                escalate: true,
            };
        }
    }
);
