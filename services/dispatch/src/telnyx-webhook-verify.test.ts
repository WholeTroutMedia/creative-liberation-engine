import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createTelnyxPublicKey, verifyTelnyxWebhookSignature } from './telnyx-webhook-verify.js';

describe('dispatch telnyx verify', () => {
    it('accepts valid signature', () => {
        const { privateKey, publicKey } = generateKeyPairSync('ed25519');
        const rawBody = '{"data":{"event_type":"message.received"}}';
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signedPayload = `${timestamp}|${rawBody}`;
        const signature = sign(null, Buffer.from(signedPayload, 'utf8'), privateKey).toString('base64');
        const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
        const imported = createTelnyxPublicKey(pem);

        expect(
            verifyTelnyxWebhookSignature({
                rawBodyUtf8: rawBody,
                signatureHeader: signature,
                timestampHeader: timestamp,
                publicKey: imported,
            }),
        ).toEqual({ ok: true });
    });
});
