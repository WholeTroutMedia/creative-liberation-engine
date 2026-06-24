/**
 * SIGNAL UniFlow Pipeline Tests
 *
 * Validates schemas, decomposition contract, and delivery output structure.
 * Full end-to-end flow tests require live Genkit + GenMedia servers.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

vi.mock('genkit', () => ({ z, ai: { defineFlow: vi.fn(), generate: vi.fn() } }));
vi.mock('resend', () => ({ Resend: vi.fn() }));
vi.mock('../src/index.js', () => ({ ai: { defineFlow: vi.fn((_cfg: any, fn: any) => fn), generate: vi.fn() }, z }));

const {
    SignalInputSchema,
    AssetPlanSchema,
    SignalDeliveryOutputSchema,
} = await import('../src/flows/signal-uniflow.js');

describe('SignalInputSchema', () => {
    it('should validate a complete brief input', () => {
        const result = SignalInputSchema.safeParse({
            sessionId: 'session_001',
            operator: 'Sovereign Artist',
            briefText: 'Create a moody nighttime cityscape with neon reflections',
            audioTranscript: 'I want something that feels like Blade Runner',
            attachments: [{ type: 'image', url: 'https://example.com/ref.jpg' }],
        });
        expect(result.success).toBe(true);
    });

    it('should validate with only required fields', () => {
        const result = SignalInputSchema.safeParse({
            sessionId: 'session_002',
            operator: 'CORTEX',
            briefText: 'Generate a product shot for a glass bottle',
        });
        expect(result.success).toBe(true);
    });

    it('should reject missing sessionId', () => {
        const result = SignalInputSchema.safeParse({
            operator: 'CORTEX',
            briefText: 'Test brief',
        });
        expect(result.success).toBe(false);
    });

    it('should reject missing briefText', () => {
        const result = SignalInputSchema.safeParse({
            sessionId: 'session_003',
            operator: 'CORTEX',
        });
        expect(result.success).toBe(false);
    });

    it('should reject missing operator', () => {
        const result = SignalInputSchema.safeParse({
            sessionId: 'session_004',
            briefText: 'Test brief',
        });
        expect(result.success).toBe(false);
    });
});

describe('AssetPlanSchema', () => {
    it('should validate a plan with images and videos', () => {
        const result = AssetPlanSchema.safeParse({
            images: [
                { prompt: 'A neon-lit alley at night, rain-slicked pavement', format: 'landscape', quality: 'ultra' },
                { prompt: 'Close-up of a glass bottle with condensation', format: 'square', quality: 'standard' },
            ],
            videos: [
                { prompt: 'Slow dolly through a cyberpunk market', format: 'landscape', durationSeconds: 8 },
            ],
            audioVoiceover: 'Welcome to the future of creative production.',
        });
        expect(result.success).toBe(true);
    });

    it('should default images and videos to empty arrays', () => {
        const result = AssetPlanSchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.images).toEqual([]);
            expect(result.data.videos).toEqual([]);
        }
    });

    it('should reject invalid image format', () => {
        const result = AssetPlanSchema.safeParse({
            images: [{ prompt: 'test', format: 'panoramic', quality: 'draft' }],
        });
        expect(result.success).toBe(false);
    });

    it('should reject invalid quality value', () => {
        const result = AssetPlanSchema.safeParse({
            images: [{ prompt: 'test', format: 'square', quality: 'premium' }],
        });
        expect(result.success).toBe(false);
    });

    it('should accept all valid format and quality combinations', () => {
        const formats = ['vertical', 'landscape', 'square'] as const;
        const qualities = ['draft', 'standard', 'ultra'] as const;

        for (const format of formats) {
            for (const quality of qualities) {
                const result = AssetPlanSchema.safeParse({
                    images: [{ prompt: `test ${format} ${quality}`, format, quality }],
                });
                expect(result.success).toBe(true);
            }
        }
    });
});

describe('SignalDeliveryOutputSchema', () => {
    it('should validate a successful delivery output', () => {
        const result = SignalDeliveryOutputSchema.safeParse({
            sessionId: 'session_001',
            operator: 'Sovereign Artist',
            assets: [
                { mediaType: 'image', localPath: '/data/assets/session_001/cityscape.png', provider: 'comfyui' },
                { mediaType: 'video', localPath: '/data/assets/session_001/dolly.mp4', provider: 'wan2.1' },
            ],
            status: 'success',
            processingMs: 45230,
        });
        expect(result.success).toBe(true);
    });

    it('should validate an error delivery output (empty assets)', () => {
        const result = SignalDeliveryOutputSchema.safeParse({
            sessionId: 'session_err',
            operator: 'CORTEX',
            assets: [],
            status: 'error: GenMedia Batch failed: connection refused',
            processingMs: 112,
        });
        expect(result.success).toBe(true);
    });

    it('should accept assets without provider (optional field)', () => {
        const result = SignalDeliveryOutputSchema.safeParse({
            sessionId: 'session_noprov',
            operator: 'CORTEX',
            assets: [
                { mediaType: 'image', localPath: '/data/test.png' },
            ],
            status: 'success',
            processingMs: 1000,
        });
        expect(result.success).toBe(true);
    });

    it('should reject missing sessionId', () => {
        const result = SignalDeliveryOutputSchema.safeParse({
            operator: 'CORTEX',
            assets: [],
            status: 'success',
            processingMs: 0,
        });
        expect(result.success).toBe(false);
    });

    it('should reject missing status', () => {
        const result = SignalDeliveryOutputSchema.safeParse({
            sessionId: 'session_x',
            operator: 'CORTEX',
            assets: [],
            processingMs: 0,
        });
        expect(result.success).toBe(false);
    });

    it('should reject non-number processingMs', () => {
        const result = SignalDeliveryOutputSchema.safeParse({
            sessionId: 'session_x',
            operator: 'CORTEX',
            assets: [],
            status: 'success',
            processingMs: 'fast',
        });
        expect(result.success).toBe(false);
    });

    it('should reject assets missing required mediaType', () => {
        const result = SignalDeliveryOutputSchema.safeParse({
            sessionId: 'session_x',
            operator: 'CORTEX',
            assets: [{ localPath: '/data/test.png' }],
            status: 'success',
            processingMs: 100,
        });
        expect(result.success).toBe(false);
    });
});
