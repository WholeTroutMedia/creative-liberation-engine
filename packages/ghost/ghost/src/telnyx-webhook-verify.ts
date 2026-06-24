/**
 * Telnyx messaging webhook signature verification (API v2 / Ed25519).
 * @see https://developers.telnyx.com/docs/messaging/messages/receiving-webhooks/index
 *
 * Signed string: `{telnyx-timestamp}|{raw JSON body}` (exact bytes as UTF-8).
 * Headers: telnyx-signature-ed25519 (base64), telnyx-timestamp (unix seconds).
 */

import { createPublicKey, verify, type KeyObject } from 'node:crypto';

/** DER prefix for Ed25519 id-ecPublicKey (32-byte raw key in BIT STRING). */
const ED25519_SPKI_32_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function createTelnyxPublicKey(envValue: string): KeyObject {
    const trimmed = envValue.trim();
    if (trimmed.includes('BEGIN PUBLIC KEY') || trimmed.includes('BEGIN')) {
        return createPublicKey(trimmed);
    }
    const derOrRaw = Buffer.from(trimmed, 'base64');
    if (derOrRaw.length === 32) {
        return createPublicKey({
            key: Buffer.concat([ED25519_SPKI_32_PREFIX, derOrRaw]),
            format: 'der',
            type: 'spki',
        });
    }
    return createPublicKey({ key: derOrRaw, format: 'der', type: 'spki' });
}

export type TelnyxVerifyResult =
    | { ok: true }
    | { ok: false; reason: string };

export function verifyTelnyxWebhookSignature(options: {
    rawBodyUtf8: string;
    signatureHeader: string | undefined;
    timestampHeader: string | undefined;
    publicKey: KeyObject;
    maxSkewSec?: number;
}): TelnyxVerifyResult {
    const {
        rawBodyUtf8,
        signatureHeader,
        timestampHeader,
        publicKey,
        maxSkewSec = 600,
    } = options;

    if (!signatureHeader?.length || !timestampHeader?.length) {
        return { ok: false, reason: 'missing_signature_headers' };
    }

    const ts = Number.parseInt(timestampHeader, 10);
    if (!Number.isFinite(ts) || ts < 1) {
        return { ok: false, reason: 'invalid_timestamp' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > maxSkewSec) {
        return { ok: false, reason: 'timestamp_skew' };
    }

    const signedPayload = `${timestampHeader}|${rawBodyUtf8}`;
    let sigBuf: Buffer;
    try {
        sigBuf = Buffer.from(signatureHeader, 'base64');
    } catch {
        return { ok: false, reason: 'invalid_signature_encoding' };
    }

    try {
        const valid = verify(null, Buffer.from(signedPayload, 'utf8'), publicKey, sigBuf);
        return valid ? { ok: true } : { ok: false, reason: 'signature_mismatch' };
    } catch {
        return { ok: false, reason: 'verify_error' };
    }
}
