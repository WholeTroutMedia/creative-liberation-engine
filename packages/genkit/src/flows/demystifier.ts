import { ai, z } from '../index.js';
import { recordAgentCall } from './index.js';

export const DemystifierInputSchema = z.object({
    documentText: z.string().describe('The raw text of the civic document, PDF, or email'),
    documentType: z.enum(['pdf', 'email', 'image', 'text', 'unknown']).default('unknown'),
    town: z.string().default('Jamesport/Riverhead').describe('The locality for context'),
});

export const DemystifierOutputSchema = z.object({
    summary: z.string().describe('What happened (Bullet points or clear sentences)'),
    impact: z.string().describe('Why it matters (Traffic, taxes, community impact)'),
    actionItems: z.array(z.string()).describe('When to vote/show up or active steps (Array of strings)'),
    confidence: z.number().min(0).max(1),
});

export type DemystifierInput = z.infer<typeof DemystifierInputSchema>;
export type DemystifierOutput = z.infer<typeof DemystifierOutputSchema>;

export const demystifierFlow = ai.defineFlow(
    {
        name: 'demystifierFlow',
        inputSchema: DemystifierInputSchema,
        outputSchema: DemystifierOutputSchema,
    },
    async (input) => {
        const start = Date.now();
        recordAgentCall('COMET');

        console.log(`[AURORA:COMET:DEMYSTIFIER] ▶ Processing ${input.documentType} for ${input.town}`);

        const systemPrompt = `You are the Demystifier Engine for the Jamesport Civic App.
Your job is to ingest chaotic, confusing civic emails/PDFs (like those from the Jamesport Civic Association, Riverhead Town Board, or local zoning boards) and auto-summarize them into extreme clarity for the general public (especially older demographics).

Constitutional Constraints:
- Article IX: No MVPs. Output must be absolute plain English, zero jargon.
- Tone: Objective, factual, empowering. Never alarmist, but clear on stakes.

Your output MUST be exactly this JSON structure:
{
  "summary": "1-3 clear sentences on exactly what is happening or being proposed.",
  "impact": "Specifically why this matters to the residents of ${input.town} (e.g., traffic, taxes, quality of life).",
  "actionItems": ["Concrete action 1 (e.g., Town Hall meeting on March 15th at 7PM)", "Concrete action 2"],
  "confidence": 0.95
}
`;

        const prompt = `Document details:\nType: ${input.documentType}\nLocality: ${input.town}\n\n=== FULL DOCUMENT TEXT ===\n${input.documentText}\n==========================\n\nAnalyze this document and return the compiled JSON response.`;

        const response = await ai.generate({
            model: process.env.GENKIT_PRO_MODEL || 'googleai/gemini-2.5-pro',
            system: systemPrompt,
            prompt,
        });

        let parsed: DemystifierOutput;
        try {
            const cleaned = response.text.replace(/```json|```/g, '').trim();
            parsed = JSON.parse(cleaned);
        } catch (e) {
            console.error('[AURORA:COMET:DEMYSTIFIER] Failed to parse JSON:', e);
            parsed = {
                summary: "Failed to cleanly parse the document.",
                impact: "Unable to determine impact at this time.",
                actionItems: [],
                confidence: 0.1,
            };
        }

        console.log(`[AURORA:COMET:DEMYSTIFIER] ✔ Document parsed in ${Date.now() - start}ms (Confidence: ${parsed.confidence})`);
        return parsed;
    }
);
