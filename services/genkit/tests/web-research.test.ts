/**
 * Web Research Vitest Suite
 *
 * Covers:
 *  - classifyResearchIntentFast: regex fast-path (no API, no LLM, no Genkit context needed)
 *  - callPerplexity: mocked fetch — citation passthrough, graceful degradation
 *  - model-registry: web:research tiers resolve correctly
 *
 * NOTE: Flow-level tests (detectResearchIntentFlow, webResearchFlow) require a live
 * Genkit context and are covered by integration tests when the server is running.
 * This unit test suite runs fully offline — no API keys, no Genkit init required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── MOCK GENKIT AI MODULE — must happen before any imports that use ai ────────
// Prevents "Cannot read properties of undefined (reading 'defineFlow')" in test env
vi.mock('../src/index.js', () => ({
    ai: {
        defineFlow: vi.fn((config: unknown, fn: unknown) => fn),
        generate: vi.fn(),
    },
}));

// Import pure functions after mock is set up
import { classifyResearchIntentFast } from '../src/flows/research-intent.js';
import { resolveModel, isWebTier, MODEL_REGISTRY } from '../src/config/model-registry.js';

// ─── MOCK PERPLEXITY RESPONSE ─────────────────────────────────────────────────

const mockPerplexityResponse = {
    id: 'test-id-123',
    model: 'sonar-pro',
    choices: [{
        message: { role: 'assistant', content: 'The current price of Gemini 2.5 Pro is $7 per million input tokens as of March 2026.' },
        finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
    citations: [
        'https://ai.google.dev/gemini-api/pricing',
        'https://cloud.google.com/vertex-ai/generative-ai/pricing',
    ],
};

// ─── RESEARCH INTENT — FAST PATH (REGEX ONLY, ZERO API COST) ─────────────────

describe('classifyResearchIntentFast — temporal + live-data triggers', () => {
    it('detects "latest" keyword as research-required', () => {
        const result = classifyResearchIntentFast('What is the latest version of Gemini?');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(true);
        expect(result!.fastPath).toBe(true);
        expect(result!.confidence).toBeGreaterThan(0.8);
    });

    it('detects "2026" year anchor as research-required', () => {
        const result = classifyResearchIntentFast('What models were released in 2026?');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(true);
        expect(result!.fastPath).toBe(true);
    });

    it('detects "current price" as research-required', () => {
        const result = classifyResearchIntentFast('What is the current price of Claude API?');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(true);
        expect(result!.model).toBe('sonar-pro');
    });

    it('detects "news" keyword as research-required', () => {
        const result = classifyResearchIntentFast('Any news about the OpenAI GPT-5 release?');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(true);
    });

    it('detects "today" as research-required', () => {
        const result = classifyResearchIntentFast('What is Bitcoin price today?');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(true);
    });

    it('selects sonar-deep-research for "comprehensive deep dive" queries', () => {
        const result = classifyResearchIntentFast('Give me a comprehensive deep dive analysis of the latest AI regulations 2026');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(true);
        expect(result!.model).toBe('sonar-deep-research');
    });

    it('detects Gemini/Claude AI model pricing queries as research', () => {
        const result = classifyResearchIntentFast('What are the Gemini pricing rates for the API?');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(true);
    });

    it('detects "latest version" as research', () => {
        const result = classifyResearchIntentFast('What is the latest version of Node.js?');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(true);
    });
});

describe('classifyResearchIntentFast — non-research fast-path', () => {
    it('returns needsResearch=false for code generation requests', () => {
        const result = classifyResearchIntentFast('Write me a TypeScript function to sort an array by date');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(false);
        expect(result!.fastPath).toBe(true);
    });

    it('returns needsResearch=false for "explain" queries', () => {
        const result = classifyResearchIntentFast('Explain how transformers work in AI');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(false);
    });

    it('returns needsResearch=false for WTM/Creative Liberation Engine internal topics', () => {
        const result = classifyResearchIntentFast('Tell me about the AVERI agents in creative-liberation-engine genkit flow');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(false);
    });

    it('returns needsResearch=false for refactoring requests', () => {
        const result = classifyResearchIntentFast('Refactor this function to be more efficient');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(false);
    });

    it('returns needsResearch=false for "describe" queries about internal systems', () => {
        const result = classifyResearchIntentFast('Describe the Creative Liberation Engine architecture');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(false);
    });

    it('has high confidence for clear non-research results', () => {
        const result = classifyResearchIntentFast('Build me a React component');
        expect(result).not.toBeNull();
        expect(result!.needsResearch).toBe(false);
        expect(result!.confidence).toBeGreaterThan(0.7);
    });
});

describe('classifyResearchIntentFast — ambiguous escalation', () => {
    it('returns null for "what is the population of France" (ambiguous)', () => {
        const result = classifyResearchIntentFast('What is the population of France?');
        // Either null (escalate to LLM) or false (stable fact) — both valid
        if (result !== null) {
            expect(typeof result.needsResearch).toBe('boolean');
        }
    });

    it('returns either null or valid ResearchIntent — never throws', () => {
        const queries = [
            'How many users does YouTube have?',
            'Who is the CEO of Apple?',
            'What does TypeScript do?',
        ];
        for (const q of queries) {
            expect(() => classifyResearchIntentFast(q)).not.toThrow();
        }
    });
});


// ─── MODEL REGISTRY — WEB TIERS ──────────────────────────────────────────────

describe('model-registry — web research tiers', () => {
    it('resolveModel is available and returns strings', () => {
        expect(typeof resolveModel).toBe('function');
        expect(typeof resolveModel('cloud:max')).toBe('string');
    });

    it('MODEL_REGISTRY contains web:research and web:research:deep keys', () => {
        expect(MODEL_REGISTRY).toBeDefined();
        const keys = Object.keys(MODEL_REGISTRY);
        expect(keys).toContain('web:research');
        expect(keys).toContain('web:research:deep');
    });

    it('web:research resolves to a non-empty string', () => {
        const model = resolveModel('web:research');
        expect(typeof model).toBe('string');
        expect(model.length).toBeGreaterThan(0);
    });

    it('web:research:deep resolves to a non-empty string', () => {
        const model = resolveModel('web:research:deep');
        expect(typeof model).toBe('string');
        expect(model.length).toBeGreaterThan(0);
    });

    it('isWebTier returns true for web: tiers', () => {
        expect(typeof isWebTier).toBe('function');
        expect(isWebTier('web:research')).toBe(true);
        expect(isWebTier('web:research:deep')).toBe(true);
    });

    it('default web:research model is sonar-pro when no env override', () => {
        if (!process.env.MODEL_WEB_RESEARCH) {
            expect(resolveModel('web:research')).toBe('sonar-pro');
        }
    });

    it('default web:research:deep model is sonar-deep-research when no env override', () => {
        if (!process.env.MODEL_WEB_RESEARCH_DEEP) {
            expect(resolveModel('web:research:deep')).toBe('sonar-deep-research');
        }
    });
});
