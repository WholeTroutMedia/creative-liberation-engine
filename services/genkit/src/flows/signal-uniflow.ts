import { z } from 'genkit';
import { ai } from '../index.js';
import { Resend } from 'resend';

// Schemas
export const SignalInputSchema = z.object({
    sessionId: z.string(),
    operator: z.string(),
    briefText: z.string(),
    audioTranscript: z.string().optional(),
    attachments: z.array(z.any()).optional(),
});

export const AssetPlanSchema = z.object({
    images: z.array(z.object({
        prompt: z.string().describe('Highly detailed image generation prompt'),
        format: z.enum(['vertical', 'landscape', 'square']),
        quality: z.enum(['draft', 'standard', 'ultra'])
    })).default([]),
    videos: z.array(z.object({
        prompt: z.string().describe('Highly detailed video generation B-roll prompt'),
        format: z.enum(['vertical', 'landscape', 'square']),
        durationSeconds: z.number()
    })).default([]),
    audioVoiceover: z.string().optional().describe('Voiceover script if requested')
});

export const SignalDeliveryOutputSchema = z.object({
    sessionId: z.string(),
    operator: z.string(),
    assets: z.array(z.object({
        mediaType: z.string(),
        localPath: z.string(),
        provider: z.string().optional()
    })),
    status: z.string(),
    processingMs: z.number()
});

/**
 * STRATA Cognitive Decomposition
 * Breaks down a raw multi-modal brief into atomic asset generation requests.
 */
async function decomposeBrief(input: z.infer<typeof SignalInputSchema>) {
    const sysPrompt = `You are STRATA, the lead strategist for the Creative Liberation Engine.
Your task is to decompose the following creative brief into atomic asset requests.
Think about the ideal video and image assets needed to fulfill the operator's vision.
Output a structured plan containing the necessary image and video prompts.
Be highly descriptive in your visual prompts (specify lighting, mood, camera angle, medium).
Assume sovereign local hardware is handling this (ComfyUI / RTX 4090).`;

    const userPrompt = `
Operator: ${input.operator}
Brief: ${input.briefText}
Audio Transcript: ${input.audioTranscript || 'None'}
`;

    // Always use gemini-2.5-flash for fast reasoning logic
    const { output } = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        system: sysPrompt,
        prompt: userPrompt,
        output: { schema: AssetPlanSchema },
        config: { temperature: 0.7 }
    });

    if (!output) throw new Error('STRATA decomposition failed to return an output format');
    return output as z.infer<typeof AssetPlanSchema>;
}

/**
 * GenMedia HTTP Execution
 * Dispatches the asset plan to the GenMedia Studio server for parallel generation.
 */
async function executeGenMediaBatch(plan: z.infer<typeof AssetPlanSchema>, sessionId: string) {
    const GENMEDIA_URL = process.env.GENMEDIA_URL || 'http://127.0.0.1:4300';
    
    // Convert STRATA plan into GenMedia GenerationRequests
    const requests: Array<{
        prompt: string;
        mediaType: 'image' | 'video';
        format: string;
        quality?: string;
        durationSeconds?: number;
        sessionId: string;
    }> = [];
    
    plan.images.forEach(img => {
        requests.push({
            prompt: img.prompt,
            mediaType: 'image',
            format: img.format,
            quality: img.quality,
            sessionId
        });
    });

    plan.videos.forEach(vid => {
        requests.push({
            prompt: vid.prompt,
            mediaType: 'video',
            format: vid.format,
            durationSeconds: vid.durationSeconds,
            sessionId
        });
    });

    if (requests.length === 0) {
        return [];
    }

    console.log(`[SIGNAL] Dispatching ${requests.length} assets to GenMedia Batch API...`);
    
    const response = await fetch(`${GENMEDIA_URL}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`GenMedia Batch failed: ${errText}`);
    }

    const results = await response.json();
    return results as Array<{ mediaType: string; localPath: string; provider?: string }>;
}

export const SignalUniFlow = ai.defineFlow(
    {
        name: 'SignalUniFlow',
        inputSchema: SignalInputSchema,
        outputSchema: SignalDeliveryOutputSchema,
    },
    async (input) => {
        const startMs = Date.now();
        console.log(`\n[SIGNAL] ══════════════════════════════════════`);
        console.log(`[SIGNAL] UniFlow Initiated: ${input.sessionId}`);
        console.log(`[SIGNAL] Operator: ${input.operator}`);
        console.log(`[SIGNAL] ══════════════════════════════════════\n`);

        try {
            // STEP 1: Cognitive Decomposition via STRATA
            console.log(`[SIGNAL] Step 1: STRATA Cognitive Decomposition...`);
            const plan = await decomposeBrief(input);
            console.log(`[SIGNAL] STRATA Plan: ${plan.images.length} Images, ${plan.videos.length} Videos`);

            // STEP 2: Asset Fan-Out via GenMedia Batch
            console.log(`[SIGNAL] Step 2: GenMedia Generation Fan-Out...`);
            const results = await executeGenMediaBatch(plan, input.sessionId);

            // STEP 3: Synthesis & Package Formating
            const assets = results.map(r => ({
                mediaType: r.mediaType,
                localPath: r.localPath,
            }));

            const processingMs = Date.now() - startMs;
            console.log(`[SIGNAL] ✅ Generation Complete in ${processingMs}ms. ${assets.length} assets ready.`);

            // STEP 3: Resend.com Delivery Notification — notify operator assets are ready
            if (process.env.RESEND_API_KEY && assets.length > 0) {
                const resend = new Resend(process.env.RESEND_API_KEY);
                const operatorEmail = input.operator.includes('@')
                    ? input.operator
                    : `${input.operator.toLowerCase().replace(/\s+/g, '.')}@zeroday.io`;

                const assetList = assets.map((a, i) =>
                    `${i + 1}. ${a.mediaType.toUpperCase()} — ${a.localPath.split(/[/\\]/).pop()}`
                ).join('\n');

                resend.emails.send({
                    from: process.env.RESEND_FROM_EMAIL || 'SIGNAL <signal@zeroday.io>',
                    to: operatorEmail,
                    subject: `✅ SIGNAL Assets Ready — Session ${input.sessionId}`,
                    text: [
                        `Your Creative Liberation Engine SIGNAL flow has completed.`,
                        ``,
                        `Session: ${input.sessionId}`,
                        `Operator: ${input.operator}`,
                        `Assets Generated: ${assets.length}`,
                        `Processing Time: ${(processingMs / 1000).toFixed(1)}s`,
                        ``,
                        `Asset Manifest:`,
                        assetList,
                        ``,
                        `All assets are available locally on the sovereign RTX 4090 workstation.`,
                    ].join('\n'),
                }).catch((err: Error) => {
                    // Non-fatal — log but never block the flow response
                    console.warn(`[SIGNAL] ⚠️ Resend delivery failed (non-fatal): ${err.message}`);
                });
            } else if (!process.env.RESEND_API_KEY) {
                console.log(`[SIGNAL] ℹ️ RESEND_API_KEY not set — skipping email delivery notification.`);
            }
            
            return {
                sessionId: input.sessionId,
                operator: input.operator,
                assets,
                status: 'success',
                processingMs
            };

        } catch (e: any) {
            console.error(`[SIGNAL] ❌ Flow Failed: ${e.message}`);
            return {
                sessionId: input.sessionId,
                operator: input.operator,
                assets: [],
                status: `error: ${e.message}`,
                processingMs: Date.now() - startMs
            };
        }
    }
);
