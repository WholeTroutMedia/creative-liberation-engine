import type { Request, Response } from 'express';
import type { KeyObject } from 'node:crypto';
import axios from 'axios';
import { createTelnyxPublicKey, verifyTelnyxWebhookSignature } from './telnyx-webhook-verify.js';

// ─── GHOST — Telnyx Inbound SMS Webhook ───────────────────────────────────────
// Handles POST /webhooks/telnyx/sms
//
// Telnyx signs payloads with Ed25519. Verification uses the account public key from
// Mission Control → API keys → Public Key (TELNYX_PUBLIC_KEY).
//
// Raw body bytes must match the signed string: `{telnyx-timestamp}|{json}`.
//
// Downstream:
//   1. Verifies signature (unless GHOST_ALLOW_UNVERIFIED_TELNYX=true for local dev)
//   2. Parses inbound message
//   3. Posts task to Dispatch
//   4. Optional Slack (#sms-inbox)
//   5. Optional auto-reply via Telnyx API

const DISPATCH_URL = process.env['DISPATCH_URL'] ?? 'http://127.0.0.1:5160';
const SLACK_BOT_TOKEN = process.env['SLACK_BOT_TOKEN'];
const SLACK_SMS_CHANNEL = process.env['SLACK_SMS_CHANNEL'] ?? '#sms-inbox';
const TELNYX_API_KEY = process.env['TELNYX_API_KEY'];
const AUTO_REPLY = process.env['TELNYX_AUTO_REPLY'] === 'true';

const ALLOW_UNVERIFIED =
    process.env['GHOST_ALLOW_UNVERIFIED_TELNYX'] === 'true' ||
    process.env['GHOST_ALLOW_UNVERIFIED_TELNYX'] === '1';

export type GhostRequest = Request & { rawBody?: Buffer };

let cachedPublicKey: KeyObject | undefined;
let publicKeyParseFailed = false;

function getTelnyxPublicKey(): KeyObject | null {
    const raw = process.env['TELNYX_PUBLIC_KEY']?.trim();
    if (!raw) return null;
    if (publicKeyParseFailed) return null;
    if (cachedPublicKey) return cachedPublicKey;
    try {
        cachedPublicKey = createTelnyxPublicKey(raw);
        return cachedPublicKey;
    } catch (e) {
        publicKeyParseFailed = true;
        console.error('[SMS-WEBHOOK] TELNYX_PUBLIC_KEY parse failed:', (e as Error).message);
        return null;
    }
}

// ─── Downstream: Dispatch Board ────────────────────────────────────────────────

const DISPATCH_PROJECT = process.env['PROJECT'] ?? 'creative-liberation-engine-v5';

async function postToDispatch(from: string, body: string, messageId: string): Promise<void> {
    try {
        await axios.post(`${DISPATCH_URL}/api/tasks`, {
            title: `📱 Inbound SMS from ${from}`,
            description: body,
            project: DISPATCH_PROJECT,
            workstream: 'communications',
            priority: 'P1',
            created_by: 'ghost-telnyx',
            source: 'telnyx-sms',
            metadata: { from, message_id: messageId, received_at: new Date().toISOString() },
        });
        console.log(`[SMS-WEBHOOK] ✅ Dispatch task created for SMS from ${from}`);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[SMS-WEBHOOK] ❌ Failed to post to dispatch:', msg);
    }
}

// ─── Downstream: Slack ─────────────────────────────────────────────────────────

async function postToSlack(from: string, body: string, to: string): Promise<void> {
    if (!SLACK_BOT_TOKEN) return;
    try {
        await axios.post(
            'https://slack.com/api/chat.postMessage',
            {
                channel: SLACK_SMS_CHANNEL,
                text: `📱 *Inbound SMS*\n*From:* ${from}\n*To:* ${to}\n*Message:* ${body}`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `📱 *Inbound SMS from ${from}*\n>${body}`,
                        },
                    },
                    {
                        type: 'context',
                        elements: [{ type: 'mrkdwn', text: `To: ${to} · ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET` }],
                    },
                ],
            },
            { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' } },
        );
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[SMS-WEBHOOK] ❌ Slack notify failed:', msg);
    }
}

// ─── Downstream: Auto-reply via Telnyx ────────────────────────────────────────

async function sendAutoReply(to: string, from: string): Promise<void> {
    if (!AUTO_REPLY || !TELNYX_API_KEY) return;
    try {
        await axios.post(
            'https://api.telnyx.com/v2/messages',
            {
                from,
                to,
                text: `👾 Creative Liberation Engine received your message. An operator will respond shortly.`,
            },
            { headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, 'Content-Type': 'application/json' } },
        );
        console.log(`[SMS-WEBHOOK] 🤖 Auto-reply sent to ${to}`);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[SMS-WEBHOOK] ❌ Auto-reply failed:', msg);
    }
}

// ─── Webhook Handler ───────────────────────────────────────────────────────────

export async function telnyxSmsWebhook(req: Request, res: Response): Promise<void> {
    const rawBuf = (req as GhostRequest).rawBody;
    if (!rawBuf?.length) {
        res.status(400).json({ error: 'Missing raw body (JSON parser verify hook not installed?)' });
        return;
    }

    const rawString = rawBuf.toString('utf8');

    let event: TelnyxWebhookEvent;
    try {
        event = JSON.parse(rawString) as TelnyxWebhookEvent;
    } catch {
        res.status(400).json({ error: 'Invalid JSON body' });
        return;
    }

    const signature = req.headers['telnyx-signature-ed25519'] as string | undefined;
    const timestamp = req.headers['telnyx-timestamp'] as string | undefined;

    const pub = getTelnyxPublicKey();

    if (pub) {
        const v = verifyTelnyxWebhookSignature({
            rawBodyUtf8: rawString,
            signatureHeader: signature,
            timestampHeader: timestamp,
            publicKey: pub,
        });
        if (!v.ok) {
            console.warn(`[SMS-WEBHOOK] 🚫 Invalid Telnyx signature (${v.reason})`);
            res.status(403).json({ error: 'Invalid webhook signature', reason: v.reason });
            return;
        }
    } else if (ALLOW_UNVERIFIED) {
        console.warn('[SMS-WEBHOOK] ⚠️  GHOST_ALLOW_UNVERIFIED_TELNYX — skipping Ed25519 verification (dev only)');
    } else {
        console.warn('[SMS-WEBHOOK] 🚫 Rejecting: TELNYX_PUBLIC_KEY not set');
        res.status(503).json({
            error: 'Telnyx webhook verification not configured',
            detail:
                'Set TELNYX_PUBLIC_KEY from Telnyx Mission Control (API keys → Public Key). For local testing only, set GHOST_ALLOW_UNVERIFIED_TELNYX=true.',
        });
        return;
    }

    const eventType = event?.data?.event_type;

    if (eventType !== 'message.received') {
        res.json({ received: true, skipped: true, event_type: eventType });
        return;
    }

    const payload = event.data.payload;
    const from: string = payload?.from?.phone_number ?? 'unknown';
    const to: string = payload?.to?.[0]?.phone_number ?? process.env['TELNYX_FROM_NUMBER'] ?? '+12198001070';
    const body: string = payload?.text ?? '';
    const messageId: string = payload?.id ?? event.data.id;

    console.log(`[SMS-WEBHOOK] 📨 Inbound SMS from ${from}: "${body.slice(0, 80)}"`);

    res.json({ received: true, message_id: messageId });

    await Promise.allSettled([
        postToDispatch(from, body, messageId),
        postToSlack(from, body, to),
        sendAutoReply(to, from),
    ]);
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TelnyxWebhookEvent {
    data: {
        event_type: string;
        id: string;
        payload: {
            id: string;
            text: string;
            from: { phone_number: string };
            to: Array<{ phone_number: string }>;
            direction: 'inbound' | 'outbound';
            messaging_profile_id?: string;
        };
        occurred_at: string;
    };
    meta?: { attempt: number; delivered_to: string };
}
