import { describe, expect, it } from 'vitest';
import {
    inboundDescriptionFromTelnyxPayload,
    normalizeSmsE164,
    normalizeTaskPriority,
} from './telnyx-sms-utils.js';

describe('normalizeSmsE164', () => {
    it('passes through +E.164', () => {
        expect(normalizeSmsE164('+16466833939')).toBe('+16466833939');
    });
    it('adds +1 for 10-digit US', () => {
        expect(normalizeSmsE164('6466833939')).toBe('+16466833939');
    });
    it('handles 11-digit 1-prefix', () => {
        expect(normalizeSmsE164('16466833939')).toBe('+16466833939');
    });
    it('returns null for empty', () => {
        expect(normalizeSmsE164('')).toBeNull();
        expect(normalizeSmsE164(undefined)).toBeNull();
    });
});

describe('inboundDescriptionFromTelnyxPayload', () => {
    it('uses text when present', () => {
        expect(inboundDescriptionFromTelnyxPayload({ text: ' hi ' })).toBe('hi');
    });
    it('describes MMS when no text', () => {
        expect(
            inboundDescriptionFromTelnyxPayload({
                media: [{ content_type: 'image/png' }],
            }),
        ).toContain('MMS');
    });
});

describe('normalizeTaskPriority', () => {
    it('maps Ghost-style high', () => {
        expect(normalizeTaskPriority('high')).toBe('P1');
    });
    it('keeps Pn', () => {
        expect(normalizeTaskPriority('P0')).toBe('P0');
    });
});
