/**
 * REM Consolidation Flow — Nightly Memory Consolidation (Direction 02)
 * packages/genkit/src/flows/rem-consolidation.ts
 *
 * The REM equivalent: a scheduled job that compresses today's working-tier
 * memory episodes into atomic signals, scores them, and promotes survivors
 * to the mid-term or long-term memory tier.
 *
 * Pipeline:
 *   1. Drain working-tier entries from MemoryTierManager (entries aged 24h+)
 *   2. Group by sessionId + agentName
 *   3. For each group: LLM compression pass → extract pattern + key signals
 *   4. Score each surviving entry: signalScore = uniqueness × importance
 *   5. Promote signalScore >= 0.4 → mid-term tier
 *   6. Promote mid-term entries > 90d with signalScore >= 0.7 → long-term
 *   7. Log stats and return a consolidation report
 *
 * Trigger paths:
 *   - Manual:  POST http://localhost:4100/generate { "flow": "remConsolidation", "input": { "dryRun": true } }
 *   - Cron:    Director agent posts a 'memory-consolidation' task to dispatch nightly
 *   - Direct:  import { remConsolidationFlow } from './rem-consolidation.js'; await remConsolidationFlow({})
 *
 * Model: Uses mid-tier (MODEL_MID env var → NAS Ollama). Falls back to MODEL_CLOUD.
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import { memoryTierManager } from '@cle/memory';
import type { TieredMemoryEntry } from '@cle/memory';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const RemConsolidationInputSchema = z.object({
    /**
     * If true, runs the full pipeline but does NOT write any promotions.
     * Use for testing. Logs what would be written.
     */
    dryRun: z.boolean().default(false),
    /**
     * Minimum age in hours for working-tier entries to be eligible.
     * Default: 24h. Use 0 in tests to drain everything.
     */
    minAgeHours: z.number().default(24),
    /**
     * Signal score threshold for mid-term promotion. Default: 0.4.
     * Entries below this are pruned (not promoted to any tier).
     */
    midTermThreshold: z.number().default(0.4),
    /**
     * Signal score threshold for long-term promotion. Default: 0.7.
     * Only mid-term entries older than 90d and above this threshold are promoted.
     */
    longTermThreshold: z.number().default(0.7),
});

export const RemConsolidationOutputSchema = z.object({
    drained: z.number().describe('Working-tier entries drained'),
    groups: z.number().describe('Session groups processed'),
    promoted: z.number().describe('Entries promoted to mid-term'),
    archived: z.number().describe('Entries promoted to long-term'),
    pruned: z.number().describe('Entries below threshold — discarded'),
    dryRun: z.boolean(),
    summary: z.string(),
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPRESSION PROMPT
// ─────────────────────────────────────────────────────────────────────────────

function buildCompressionPrompt(entries: TieredMemoryEntry[]): string {
    const lines = entries.map((e, i) =>
        `[${i + 1}] Agent: ${e.agentName}\nTask: ${e.task}\nOutcome: ${e.outcome?.slice(0, 300) ?? '(none)'}`
    );
    return `You are VERA, the Creative Liberation Engine memory quality gate.

Review these ${entries.length} memory entries from a single session and extract the highest-signal information.

ENTRIES:
${lines.join('\n\n')}

Respond with a JSON array of surviving signals. Each element:
{
  "sourceIndex": <1-based index>,
  "pattern": "<the key principle or decision, one sentence>",
  "importance": <"low" | "medium" | "high" | "critical">,
  "signalScore": <0.0-1.0, where 0=noise, 1=critical pattern>
}

Rules:
- Keep only entries that represent a reusable pattern, decision, learning, or significant event.
- Prune: operational noise, failed attempts with no learning value, duplicate observations.
- signalScore reflects: uniqueness (0-1) × importance weight (low=0.3, medium=0.6, high=0.85, critical=1.0)
- Respond ONLY with the JSON array, no prose.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW
// ─────────────────────────────────────────────────────────────────────────────

export const remConsolidationFlow = ai.defineFlow(
    {
        name: 'remConsolidation',
        inputSchema: RemConsolidationInputSchema,
        outputSchema: RemConsolidationOutputSchema,
    },
    async (input): Promise<z.infer<typeof RemConsolidationOutputSchema>> => {
        const {
            dryRun,
            minAgeHours,
            midTermThreshold,
            longTermThreshold,
        } = input;

        console.log(`[REM] Starting consolidation | dryRun=${dryRun} minAgeHours=${minAgeHours}`);

        // ── Step 1: Drain working-tier entries ──────────────────────────────

        const minAgeMs = minAgeHours * 60 * 60 * 1000;
        const drained = memoryTierManager.drainWorking(minAgeMs);

        console.log(`[REM] Drained ${drained.length} working-tier entries`);

        if (drained.length === 0) {
            return {
                drained: 0, groups: 0, promoted: 0, archived: 0, pruned: 0,
                dryRun, summary: 'No working-tier entries to consolidate.',
            };
        }

        // ── Step 2: Group by sessionId + agentName ──────────────────────────

        const groups = new Map<string, TieredMemoryEntry[]>();
        for (const entry of drained) {
            const key = `${entry.sessionId}::${entry.agentName}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(entry);
        }

        console.log(`[REM] ${groups.size} session groups to process`);

        // ── Step 3–4: Compress + score each group ───────────────────────────

        let promoted = 0;
        let pruned = 0;

        for (const [groupKey, entries] of groups) {
            try {
                const prompt = buildCompressionPrompt(entries);

                // Use mid-tier model via env var (Article VI compliance)
                const { text } = await ai.generate({
                    prompt,
                    config: { temperature: 0.1 }, // deterministic compression
                });

                // Parse surviving signals
                let signals: Array<{
                    sourceIndex: number;
                    pattern: string;
                    importance: string;
                    signalScore: number;
                }> = [];

                try {
                    const jsonMatch = text.match(/\[[\s\S]*\]/);
                    if (jsonMatch) signals = JSON.parse(jsonMatch[0]);
                } catch {
                    console.warn(`[REM] JSON parse failed for group ${groupKey} — skipping`);
                    pruned += entries.length;
                    continue;
                }

                // ── Step 5: Promote survivors to mid-term ───────────────────

                for (const signal of signals) {
                    const sourceEntry = entries[signal.sourceIndex - 1];
                    if (!sourceEntry) continue;

                    const score = Math.max(0, Math.min(1, signal.signalScore ?? 0));

                    if (score < midTermThreshold) {
                        pruned++;
                        continue;
                    }

                    if (!dryRun) {
                        await memoryTierManager.promote(
                            {
                                ...sourceEntry,
                                outcome: signal.pattern, // replace with compressed pattern
                                task: `[CONSOLIDATED] ${sourceEntry.task}`,
                            },
                            { toTier: 'mid-term', signalScore: score },
                        );
                    } else {
                        console.log(`[REM][DRY-RUN] Would promote: score=${score.toFixed(2)} "${signal.pattern.slice(0, 60)}"`);
                    }
                    promoted++;
                }

                // Entries with no surviving signal → pruned
                const survivedIndices = new Set(signals.map(s => s.sourceIndex - 1));
                for (let i = 0; i < entries.length; i++) {
                    if (!survivedIndices.has(i)) pruned++;
                }

            } catch (err) {
                console.warn(`[REM] Group ${groupKey} failed: ${(err as Error).message}`);
                pruned += entries.length;
            }
        }

        // ── Step 6: Long-term promotion from mid-term (90d aging) ───────────
        // Scans all mid-term ChromaDB collections for entries older than 90d
        // and promotes those above longTermThreshold to the long-term tier.
        let archived = 0;
        try {
            const midTermAgeMs = 90 * 24 * 60 * 60 * 1000; // 90 days
            const longTermCandidates = await memoryTierManager.drainMidTermOlderThan(midTermAgeMs);
            console.log(`[REM] Step 6: ${longTermCandidates.length} mid-term entries eligible for long-term review`);

            for (const candidate of longTermCandidates) {
                const score = candidate.signalScore ?? 0;
                if (score < longTermThreshold) {
                    console.log(`[REM] Skip long-term (score=${score.toFixed(2)} < ${longTermThreshold}): ${candidate.task.slice(0, 60)}`);
                    continue;
                }
                if (!dryRun) {
                    await memoryTierManager.promote(candidate, { toTier: 'long-term', signalScore: score });
                } else {
                    console.log(`[REM][DRY-RUN] Would archive to long-term: score=${score.toFixed(2)} "${candidate.task.slice(0, 60)}"`);
                }
                archived++;
            }
            console.log(`[REM] Step 6 complete: ${archived} entries promoted to long-term tier.`);
        } catch (ltErr) {
            console.warn(`[REM] Step 6 long-term archival failed (non-fatal): ${(ltErr as Error).message}`);
        }

        // ── Step 7: Report ──────────────────────────────────────────────────

        const summary =
            `[REM] Consolidation complete: ${drained.length} drained, ` +
            `${promoted} promoted to mid-term, ${archived} archived to long-term, ` +
            `${pruned} pruned. dryRun=${dryRun}`;

        console.log(summary);

        return {
            drained: drained.length,
            groups: groups.size,
            promoted,
            archived,
            pruned,
            dryRun,
            summary,
        };
    },
);
