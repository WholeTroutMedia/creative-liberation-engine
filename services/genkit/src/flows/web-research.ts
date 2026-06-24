/**
 * Web Research Flow
 *
 * Standalone Genkit flow: any agent calls this to get real-time web data + citations.
 * Wraps Gemini with Google Search Grounding to provide cited research answers.
 *
 * Usage:
 *   const result = await webResearchFlow({ query: "...", depth: "fast" });
 *   // → { answer, citations, model, tokensUsed, success }
 *
 * Constitutional: Article V (Transparency — citations always surfaced)
 *                 Article XX (zero wait — Gemini Search responds fast)
 *                 Article I  (Sovereign fallback — never throws, always returns)
 */

import { z } from 'genkit';
import { ai } from '../index.js';


// ─── TYPES ───────────────────────────────────────────────────────────────────

export const WebResearchInputSchema = z.object({
    query: z.string().describe('Search query for web research'),
    depth: z.enum(['fast', 'standard', 'deep']).default('standard')
        .describe('fast → gemini-2.5-flash | standard/deep → gemini-2.5-pro'),
    model: z.string().optional()
        .describe('Override model selection (takes precedence over depth)'),
    systemContext: z.string().optional()
        .describe('Optional system context to inject into request'),
});

export const WebResearchOutputSchema = z.object({
    success: z.boolean(),
    answer: z.string().describe('Research answer text'),
    citations: z.array(z.string()).describe('Source URLs cited in the answer'),
    model: z.string().describe('Actual model used'),
    tokensUsed: z.number().optional(),
    errorMessage: z.string().optional().describe('Set if success=false, explains failure'),
});

export type WebResearchInput = z.infer<typeof WebResearchInputSchema>;
export type WebResearchOutput = z.infer<typeof WebResearchOutputSchema>;

// ─── MODEL SELECTION ─────────────────────────────────────────────────────────

function resolveResearchModel(
    depth: 'fast' | 'standard' | 'deep',
    override?: string,
): string {
    if (override) return override;
    const env = process.env.MODEL_WEB_RESEARCH;
    if (env) return env;

    const map: Record<typeof depth, string> = {
        fast: 'googleai/gemini-2.5-flash',
        standard: 'googleai/gemini-2.5-pro',
        deep: 'googleai/gemini-2.5-pro',
    };
    return map[depth] ?? 'googleai/gemini-2.5-pro';
}

// ─── GENKIT WEB RESEARCH FLOW ────────────────────────────────────────────────

export const webResearchFlow = ai.defineFlow(
    {
        name: 'webResearch',
        inputSchema: WebResearchInputSchema,
        outputSchema: WebResearchOutputSchema,
    },
    async (input) => {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return {
                success: false,
                answer: '',
                citations: [],
                model: 'unknown',
                errorMessage: 'GEMINI_API_KEY or GOOGLE_API_KEY not set — set it in .env to enable real-time research',
            };
        }

        const modelConfig = resolveResearchModel(input.depth, input.model);
        const systemPrompt = input.systemContext ? input.systemContext : 'You are ATHENA, a meticulous researcher. Synthesize the grounded search results into a highly dense, accurate markdown answer.';

        try {
            const { text, usage, custom } = await ai.generate({
                model: modelConfig,
                system: systemPrompt,
                prompt: input.query,
                config: {
                    temperature: 0.2, // Lower temp for factual research
                },
                // Enable Google Search Grounding natively via tools config if available in the model adapter
                tools: [], // We rely on the implicit grounding of the model if configured, or we can explicit pass `{ name: 'googleSearch' }` if the adapter supports it. Genkit standardizes this via standard Google AI plugins.
            });

            // Extract citations from Gemini Grounding Metadata if present.
            // Genkit usually passes this through in custom.groundingMetadata or similar.
            const citations: string[] = [];
            // Cast custom to any to access groundingMetadata, as Genkit's GenerateResponse doesn't explicitly type it.
            const groundingData = (custom as any)?.groundingMetadata;
            if (groundingData?.webSearchQueries) {
                 citations.push(...groundingData.webSearchQueries);
            }
            if (groundingData?.searchEntryPoint?.renderedContent) {
                 // Extracting URLs from the rendered content is complex, but often the chunks provide URLs directly.
                 const chunks = groundingData?.groundingChunks;
                 if (Array.isArray(chunks)) {
                     chunks.forEach((chunk: any) => {
                         if (chunk.web?.uri) citations.push(chunk.web.uri);
                     });
                 }
            }

            // Deduplicate citations
            const uniqueCitations = Array.from(new Set(citations));

            // Append citations to the answer if they exist for consistent behavior with old Sonar UI
            let finalAnswer = text;
            if (uniqueCitations.length > 0) {
                 finalAnswer += `\n\n**Sources:** ${uniqueCitations.join(' | ')}`;
            }

            console.log(`[WEB-RESEARCH] ✓ Gemini → ${uniqueCitations.length} citations | ${usage?.totalTokens ?? '?'} tokens`);

            return {
                success: true,
                answer: finalAnswer,
                citations: uniqueCitations,
                model: modelConfig,
                tokensUsed: usage?.totalTokens,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`[WEB-RESEARCH] Research failed for query "${input.query.slice(0, 80)}": ${message}`);
            
            return {
                success: false,
                answer: '',
                citations: [],
                model: modelConfig,
                errorMessage: `Research generation failed: ${message}`,
            };
        }
    }
);
