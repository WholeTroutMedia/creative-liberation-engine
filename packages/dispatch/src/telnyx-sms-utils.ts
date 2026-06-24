/**
 * Shared helpers for Telnyx SMS inbound webhooks and outbound sends.
 */

import type { TaskPriority } from './types.js';

/** Telnyx message.received payload (subset). @see Telnyx receiving-webhooks docs */
export interface TelnyxInboundMessagePayload {
    id?: string;
    text?: string;
    from?: { phone_number?: string };
    to?: Array<{ phone_number?: string }>;
    media?: Array<{ url?: string; content_type?: string }>;
    type?: string;
    messaging_profile_id?: string;
}

/**
 * Normalize to E.164 (+ and digits only). US: 10 digits → +1…
 */
export function normalizeSmsE164(input: string | undefined | null): string | null {
    if (input == null || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    const digits = trimmed.replace(/\D/g, '');
    if (!digits.length) return null;
    if (trimmed.startsWith('+')) {
        return `+${digits}`;
    }
    if (digits.length === 10) {
        return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`;
    }
    return `+${digits}`;
}

export function inboundDescriptionFromTelnyxPayload(payload: TelnyxInboundMessagePayload): string {
    const t = payload.text?.trim();
    if (t) return t;
    const media = payload.media;
    if (media && media.length > 0) {
        const kinds = media.map(m => m.content_type?.split('/')[0] ?? 'file').join(', ');
        return `[MMS — ${media.length} attachment(s): ${kinds}]`;
    }
    return '[Empty SMS — no text body]';
}

/** Copy metadata and normalize known phone fields to E.164. */
export function normalizeTaskMetadataPhoneFields(
    meta: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
    if (!meta) return undefined;
    const o = { ...meta };
    if (typeof o.from === 'string') {
        const n = normalizeSmsE164(o.from);
        if (n) o.from = n;
    }
    return o;
}

export function normalizeTaskPriority(input: unknown, fallback: TaskPriority = 'P2'): TaskPriority {
    if (input === 'P0' || input === 'P1' || input === 'P2' || input === 'P3') {
        return input;
    }
    if (typeof input === 'string') {
        const x = input.toLowerCase();
        if (x === 'critical' || x === 'p0') return 'P0';
        if (x === 'high' || x === 'p1') return 'P1';
        if (x === 'low' || x === 'p3') return 'P3';
        if (x === 'normal' || x === 'medium' || x === 'p2') return 'P2';
    }
    return fallback;
}
