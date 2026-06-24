import { z } from 'zod';
import { ai } from '@cle/genkit';
import { leadScorer } from '../intelligence/lead-scoring.js';
import { type GTMEvent } from '../analytics/live-gtm.js';

// ─── Prospect Pipeline — Full GTM Funnel Genkit Flow ──────────────────────────
// Sequences: signal intake → lead score → outreach strategy → onboarding trigger.
// Constitutional: Article IX — no partial pipelines. Ship complete.

export const ProspectInputSchema = z.object({
    clientEmail: z.string().email(),
    clientName: z.string(),
    company: z.string().optional(),
    industry: z.string(),
    useCase: z.string(),
    events: z.array(z.object({
        type: z.string(),
        client_email: z.string().email(),
        payload: z.record(z.unknown()).optional(),
        timestamp: z.string(),
    })).default([]),
    sourceChannel: z.enum(['intake_form', 'referral', 'inbound', 'outbound', 'partner']).default('intake_form'),
});

export type ProspectInput = z.infer<typeof ProspectInputSchema>;

export const ProspectOutputSchema = z.object({
    prospectId: z.string(),
    leadScore: z.number().min(0).max(100),
    recommendation: z.enum(['disqualify', 'nurture', 'engage_now']),
    outreachStrategy: z.string(),
    shouldTriggerOnboarding: z.boolean(),
    estimatedDealValue: z.number().optional(),
    nextAction: z.string(),
    scoringFactors: z.array(z.string()),
});

export type ProspectOutput = z.infer<typeof ProspectOutputSchema>;

// ── Helix A: Prospect Pipeline Flow ───────────────────────────────────────────
export const prospectPipelineFlow = ai.defineFlow(
    {
        name: 'zeroDayProspectPipeline',
        inputSchema: ProspectInputSchema,
        outputSchema: ProspectOutputSchema,
    },
    async (input: ProspectInput): Promise<ProspectOutput> => {
        console.log(`[Zero-Day Pipeline] Processing prospect: ${input.clientEmail}`);

        // Step 1: Run all signal events through the lead scorer
        let latestScore = leadScorer.getScore(input.clientEmail);
        for (const evt of input.events) {
            const scored = leadScorer.processEvent(evt as GTMEvent);
            if (scored) latestScore = scored;
        }

        const currentScore = latestScore?.score ?? 0;
        const scoringFactors = latestScore?.factors ?? [];
        const recommendation = latestScore?.recommendation ?? 'nurture';

        // Step 2: AI-powered outreach strategy generation
        const strategistPrompt = `You are the Zero-Day GTM strategist for Creative Liberation Engine.

Prospect Profile:
- Name: ${input.clientName}
- Company: ${input.company ?? 'Unknown'}
- Industry: ${input.industry}
- Use Case: ${input.useCase}
- Source Channel: ${input.sourceChannel}
- Lead Score: ${currentScore}/100
- Scoring Factors: ${scoringFactors.join(', ') || 'None yet'}
- Recommendation: ${recommendation}

Generate a precise outreach strategy (2-4 sentences) and estimate the deal value in USD.
Return JSON with keys: "strategy" (string), "estimated_deal_value" (number), "next_action" (string, one sentence imperative).
Respond ONLY with valid JSON.`;

        let outreachStrategy = 'Standard nurture sequence — schedule discovery call within 14 days.';
        let estimatedDealValue: number | undefined;
        let nextAction = 'Send intro email with Creative Liberation Engine overview deck.';

        try {
            const { text } = await ai.generate({
                model: 'googleai/gemini-pro-latest',
                prompt: strategistPrompt,
                config: { temperature: 0.3 },
            });

            const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim()) as {
                strategy: string;
                estimated_deal_value: number;
                next_action: string;
            };
            outreachStrategy = parsed.strategy;
            estimatedDealValue = parsed.estimated_deal_value;
            nextAction = parsed.next_action;
        } catch (err) {
            console.warn('[Zero-Day Pipeline] AI strategy parse failed, using defaults:', err);
        }

        // Step 3: Determine if onboarding should auto-trigger
        const shouldTriggerOnboarding = recommendation === 'engage_now' && currentScore >= 80;

        const prospectId = `PROSPECT-${Date.now()}-${input.clientEmail.split('@')[0].toUpperCase()}`;

        console.log(`[Zero-Day Pipeline] ${prospectId} — score=${currentScore}, recommendation=${recommendation}, onboarding=${shouldTriggerOnboarding}`);

        return {
            prospectId,
            leadScore: currentScore,
            recommendation,
            outreachStrategy,
            shouldTriggerOnboarding,
            estimatedDealValue,
            nextAction,
            scoringFactors,
        };
    }
);

