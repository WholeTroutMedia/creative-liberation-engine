import express, { Request, Response } from 'express';
import { trackEvent } from '../analytics/posthog.js';
import { ECHOProfileStore } from '../intelligence/echo-profile.js';
import { notifier } from '../notifications/notifier.js';

const router: express.Router = express.Router();
const echo = new ECHOProfileStore();

/**
 * POST /api/intake/cortex
 * Webhook for receiving multi-modal briefs from the CORTEX mobile app/intake form.
 * Triggers the SignalUniFlow in Genkit for sovereign orchestration.
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { sessionId, operator, briefText, audioTranscript, attachments } = req.body;

        if (!sessionId || !briefText) {
            return res.status(400).json({ error: 'sessionId and briefText are required.' });
        }

        const clientName = operator || 'CORTEX Operator';
        const clientEmail = operator ? `${operator.toLowerCase().replace(/\s+/g, '.')}@zeroday.io` : 'cortex@zeroday.io';

        // 1. Record the intake event in telemetry
        trackEvent(clientEmail, 'cortex_brief_received', { 
            client_name: clientName,
            session_id: sessionId,
            has_audio: !!audioTranscript,
            attachment_count: attachments?.length || 0
        });

        console.log(`[ZERO-DAY] CORTEX Brief Received: ${sessionId} from ${clientName}`);

        // 2. Ensure ECHO profile exists for the operator (Client Intelligence)
        await echo.getOrCreate(`cortex-${clientName}`, clientEmail, clientName);

        // 3. Dispatch to Genkit SignalUniFlow (non-blocking / asynchronous execution)
        const genkitBase = process.env.GENKIT_URL || 'http://localhost:4100';
        
        fetch(`${genkitBase}/signal-uniflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                operator: clientName,
                briefText,
                audioTranscript: audioTranscript || '',
                attachments: attachments || []
            })
        }).then(async genkitRes => {
            if (!genkitRes.ok) throw new Error(`HTTP ${genkitRes.status}`);
            const result = await genkitRes.json();
            console.log(`[ZERO-DAY] SIGNAL Orchestration Complete for ${sessionId}`);
            
            // Deliver notification
            await notifier.send({
                type: 'deliverable_sent',
                to_email: clientEmail,
                client_name: clientName,
                project_title: `SIGNAL Brief ${sessionId}`,
                body: `Your orchestrated assets are ready: ${result.assets?.length || 0} files generated.`
            });
        }).catch(err => {
            console.error(`[ZERO-DAY] Failed to dispatch SignalUniFlow to Genkit: ${err.message}`);
        });

        // 4. Acknowledge receipt immediately (Article XX: no human wait time)
        return res.json({
            success: true,
            message: 'CORTEX brief ingested and queued for SIGNAL orchestration.',
            session_id: sessionId,
            tracking_status: 'processing'
        });

    } catch (e: unknown) {
        console.error('[ZERO-DAY] CORTEX intake failed:', e);
        return res.status(500).json({ error: (e as Error).message });
    }
});

export default router;
