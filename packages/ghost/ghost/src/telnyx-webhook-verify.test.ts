import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createTelnyxPublicKey, verifyTelnyxWebhookSignature } from './telnyx-webhook-verify.js';

describe('verifyTelnyxWebhookSignature', () => {
    it('accepts a valid Ed25519 signature over timestamp|body', () => {
        const { privateKey, publicKey } = generateKeyPairSync('ed25519');
        const rawBody = '{"data":{"event_type":"message.received","id":"evt-1"}}';
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signedPayload = `${timestamp}|${rawBody}`;
        const signature = sign(null, Buffer.from(signedPayload, 'utf8'), privateKey).toString('base64');
        const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
        const imported = createTelnyxPublicKey(pem);

        const result = verifyTelnyxWebhookSignature({
            rawBodyUtf8: rawBody,
            signatureHeader: signature,
            timestampHeader: timestamp,
            publicKey: imported,
            maxSkewSec: 600,
        });
        expect(result).toEqual({ ok: true });
    });

    it('accepts public key as base64-encoded 32-byte raw Ed25519 key', () => {
        const { privateKey, publicKey } = generateKeyPairSync('ed25519');
        const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
        const raw32 = spki.subarray(-32);
        const b64 = raw32.toString('base64');

        const rawBody = '{"hello":"world"}';
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signedPayload = `${timestamp}|${rawBody}`;
        const signature = sign(null, Buffer.from(signedPayload, 'utf8'), privateKey).toString('base64');
        const imported = createTelnyxPublicKey(b64);

        expect(
            verifyTelnyxWebhookSignature({
                rawBodyUtf8: rawBody,
                signatureHeader: signature,
                timestampHeader: timestamp,
                publicKey: imported,
            }).ok,
        ).toBe(true);
    });

    it('rejects wrong body bytes', () => {
        const { privateKey, publicKey } = generateKeyPairSync('ed25519');
        const rawBody = '{"a":1}';
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signedPayload = `${timestamp}|${rawBody}`;
        const signature = sign(null, Buffer.from(signedPayload, 'utf8'), privateKey).toString('base64');
        const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
        const imported = createTelnyxPublicKey(pem);

        const result = verifyTelnyxWebhookSignature({
            rawBodyUtf8: '{"a":2}',
            signatureHeader: signature,
            timestampHeader: timestamp,
            publicKey: imported,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('signature_mismatch');
    });

    it('rejects stale timestamp', () => {
        const { privateKey, publicKey } = generateKeyPairSync('ed25519');
        const rawBody = '{}';
        const timestamp = String(Math.floor(Date.now() / 1000) - 99999);
        const signedPayload = `${timestamp}|${rawBody}`;
        const signature = sign(null, Buffer.from(signedPayload, 'utf8'), privateKey).toString('base64');
        const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
        const imported = createTelnyxPublicKey(pem);

        const result = verifyTelnyxWebhookSignature({
            rawBodyUtf8: rawBody,
            signatureHeader: signature,
            timestampHeader: timestamp,
            publicKey: imported,
            maxSkewSec: 600,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('timestamp_skew');
    });
});
