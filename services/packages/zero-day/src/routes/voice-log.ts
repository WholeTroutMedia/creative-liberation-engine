import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Zod schema for incoming POST payload
const VoiceLogSchema = z.object({
    text: z.string().min(1),
    timestampMs: z.number().optional().default(() => Date.now()),
    source: z.string().optional().default('siri'),
});

import type { Router as ExpressRouter } from 'express';

const router = Router() as ExpressRouter;

router.post('/', async (req: Request, res: Response) => {
    // 1. Basic Auth check
    const authHeader = req.headers.authorization;
    const apiKey = process.env.INTAKE_API_KEY;
    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const payload = VoiceLogSchema.parse(req.body);
        console.log(`[ZERO DAY] 🎙️ Voice Log incoming: "${payload.text}"`);

        // 2. Classify intent via Genkit Flow (Intake Router Flow)
        // We will build this flow in the next step, assuming it's exposed at /intakeRouter
        const genkitBase = process.env.GENKIT_URL || 'http://localhost:4100';
        const response = await fetch(`${genkitBase}/intakeRouterFlow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: payload.text,
                timestampMs: payload.timestampMs
            }),
        });

        if (!response.ok) {
            console.error(`[ZERO DAY] Genkit intent classification failed: ${response.status}`);
            return res.status(500).json({ error: 'LLM Classification Failed' });
        }

        const rawResult = await response.json();
        
        // Handle the Genkit 'response' envelope structure
        const data = (rawResult as Record<string, any>).response || rawResult;

        if (!data || !data.intent) {
             console.error(`[ZERO DAY] Invalid Genkit response format`);
             return res.status(500).json({ error: 'LLM Classification Returned Invalid Schema' });
        }

        console.log(`[ZERO DAY] 🧠 Classified Intent: ${data.intent}`);

        // 3. Route Output
        if (data.intent === 'media_context') {
            // Drop Context Anchor .json for the NAS Watcher
            // SONY_INGEST_INCOMING_DIR should be mounted into the zero-day container by docker-compose
            const dropDir = process.env.SONY_INGEST_INCOMING_DIR || '/ingest/incoming';
            
            // Ensure directory exists
            if (!fs.existsSync(dropDir)) {
                 fs.mkdirSync(dropDir, { recursive: true });
            }

            const fileName = `ctx_${payload.timestampMs}_${data.eventSlug || 'Log'}.json`;
            const filePath = path.join(dropDir, fileName);

            const ctxPayload = {
                timestampMs: payload.timestampMs,
                eventSlug: data.eventSlug || 'Uncategorized_Log',
                note: payload.text,
                origin: payload.source,
                gravityWell: {
                    preBufferMinutes: data.preBufferMinutes || 15,
                    postBufferMinutes: data.postBufferMinutes || 30
                }
            };

            fs.writeFileSync(filePath, JSON.stringify(ctxPayload, null, 2), 'utf8');
            console.log(`[ZERO DAY] ⚓ Dropped Context Anchor: ${filePath}`);
            
            return res.json({ success: true, intent: 'media_context', message: data.replyMsg || `Context anchor dropped for ${ctxPayload.eventSlug}.` });

        } else {
            // It's a general question/chat. 
            // The flow result should contain an Averi reply. 
            // In the future this could be routed through the real `averiChatFlow` or just replied here.
            console.log(`[ZERO DAY] 💬 Chat reply: ${data.replyMsg}`);
            return res.json({ success: true, intent: 'chat', message: data.replyMsg || "I heard you, but I'm not sure what you want me to do with that." });
        }

    } catch (e: unknown) {
        console.error('[ZERO DAY] Voice Log Error:', (e as Error).message);
        if (e instanceof z.ZodError) {
             return res.status(400).json({ error: 'Invalid payload', details: e.errors });
        }
        return res.status(500).json({ error: (e as Error).message });
    }
});

export default router;
