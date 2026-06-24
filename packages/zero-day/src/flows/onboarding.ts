import { z } from 'zod';
import { ai } from '@cle/genkit';
import { ZeroDayNotifier } from '../notifications/notifier.js';

// ─── Zero-Day Onboarding Sequence ─────────────────────────────────────────────
// Genkit flow to automatically draft and send tailored onboarding drip emails.

export const OnboardingInputSchema = z.object({
    clientEmail: z.string().email(),
    clientName: z.string(),
    industry: z.string(),
    useCase: z.string(),
});

export const onboardingDraftFlow: any = ai.defineFlow(
    {
        name: 'zeroDayOnboardingDraft',
        inputSchema: OnboardingInputSchema,
        outputSchema: z.object({ success: z.boolean(), draftedEmail: z.string() }),
    },
    async (input: z.infer<typeof OnboardingInputSchema>) => {
        console.log(`[Zero-Day Onboarding] Drafting welcome sequence for ${input.clientEmail}`);

        const prompt = `You are the Zero-Day autonomous engagement agent.
Client: ${input.clientName}
Industry: ${input.industry}
Primary Use Case: ${input.useCase}

Draft a highly personalized, Article IX compliant Welcome Email. 
It must be concise, authoritative, and outline the next immediate steps for their sovereign intelligence deployment. Do not use placeholders. Provide the raw email body.`;

        const { text } = await ai.generate({
            model: 'googleAI/gemini-pro-latest',
            prompt,
            system: 'You are an elite enterprise communication agent. Tone: precise, confident, zero-fluff.',
        });

        const notifier = new ZeroDayNotifier();
        await notifier.send({
            type: 'intake_received',
            to_email: input.clientEmail,
            client_name: input.clientName,
            body: text,
            cta_url: 'https://portal.zerday.io',
            cta_label: 'Access Your Portal'
        });

        return { success: true, draftedEmail: text };
    }
);

