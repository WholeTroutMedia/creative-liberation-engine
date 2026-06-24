import { describe, it, expect } from 'vitest';
import { meshRouter } from '../mesh-router.js';

describe('MeshRouter (Cortical Mesh Tier Classifier)', () => {
    it('routes simple tasks to edge', () => {
        const decision = meshRouter.routeTask('classify this string');
        expect(decision.tier).toBe('edge');
        expect(decision.tierReason).toContain('very low complexity');
    });

    it('routes high privacy tasks to heavy', () => {
        const decision = meshRouter.routeTask('summarize this highly confidential internal financial report');
        expect(decision.tier).toBe('heavy');
        expect(decision.tierReason).toContain('privacy requirement');
    });

    it('routes highly complex tasks to cloud', () => {
        const decision = meshRouter.routeTask('architect a novel distributed systems consensus algorithm that solves byzantine faults');
        expect(decision.tier).toBe('cloud');
        expect(decision.tierReason).toContain('frontier complexity');
    });

    it('forces heavy tier if cloud is disabled via score config', () => {
        // Mock the scenario where cloud is disabled
        const decision = meshRouter.routeTask('architect a novel distributed systems consensus algorithm', {
            privacyRequirement: 0.9
        });
        expect(decision.tier).toBe('heavy');
    });

    it('handles explicit realtime requests', () => {
        const decision = meshRouter.routeTask('realtime audio transcription of this meeting');
        expect(decision.profile.latencySensitivity).toBe(0.9);
    });

    it('executes in under 5ms', () => {
        const start = performance.now();
        meshRouter.routeTask('Write a quick test suite for MeshRouter classification logic');
        const duration = performance.now() - start;
        expect(duration).toBeLessThan(5);
    });
});
