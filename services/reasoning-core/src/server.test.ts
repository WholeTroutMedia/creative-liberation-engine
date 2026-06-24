import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './server.js';

// Mock the global fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Reasoning Core Service API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return service health status', async () => {
      // Mock memory service health check returning online
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'online' })
      });

      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'online',
        service: 'reasoning-core',
        integration: {
          'averi-memory-service': 'connected'
        }
      });
    });

    it('should handle memory service offline', async () => {
      // Mock memory service health check throwing error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'online',
        service: 'reasoning-core',
        integration: {
          'averi-memory-service': 'offline'
        }
      });
    });
  });

  describe('POST /api/reason', () => {
    it('should execute linear chain_of_thought trace and persist to memory', async () => {
      // Mock memory service save call + vector index check + vector insert
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const payload = {
        prompt: 'Validate the V6 system topology',
        model: 'googleAI/gemini-2.5-flash',
        strategy: 'chain_of_thought',
        maxSteps: 4,
        temperature: 0.7
      };

      const res = await request(app)
        .post('/api/reason')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
      expect(res.body.reasoningId).toBeDefined();
      expect(res.body.output).toBeDefined();
      expect(res.body.steps.length).toBeGreaterThan(0);
      expect(res.body.steps[0].type).toBe('thought');
      expect(res.body.usage).toBeDefined();
      expect(res.body.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should execute reflection strategy', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const payload = {
        prompt: 'Reflect on CRDT synchronization conflicts',
        model: 'googleAI/gemini-2.5-flash',
        strategy: 'reflection',
        maxSteps: 5
      };

      const res = await request(app)
        .post('/api/reason')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
      expect(res.body.steps.some((s: any) => s.type === 'reflection' || s.type === 'observation')).toBe(true);
    });

    it('should return 400 validation error if parameters are missing', async () => {
      const res = await request(app)
        .post('/api/reason')
        .send({
          prompt: '',
          strategy: 'chain_of_thought'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/reason/evaluate', () => {
    it('should evaluate reasoning steps and return judge scores', async () => {
      const payload = {
        context: 'User requested validation of SQLite connections.',
        stepContent: 'Reconciled vector clock. Found zero conflicts.',
        evaluationCriteria: ['Logical correctness', 'Conflict handling']
      };

      const res = await request(app)
        .post('/api/reason/evaluate')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.score).toBeDefined();
      expect(res.body.feedback).toBeDefined();
      expect(res.body.passed).toBeDefined();
    });
  });

  describe('GET /api/reasoning/traces/:id', () => {
    it('should fetch reasoning trace document from memory service', async () => {
      const traceId = '550e8400-e29b-41d4-a716-446655440000';
      const mockDoc = {
        doc_id: traceId,
        collection: 'reasoning_traces',
        state: { prompt: 'Test query', status: 'completed' },
        vector_clock: { 'node-1': 1 },
        last_sync: '2026-06-22T12:00:00Z',
        origin_node: 'node-1',
        conflict_count: 0
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDoc
      });

      const res = await request(app).get(`/api/reasoning/traces/${traceId}`);
      expect(res.status).toBe(200);
      expect(res.body.doc_id).toBe(traceId);
      expect(res.body.collection).toBe('reasoning_traces');
    });

    it('should return 404 if trace document is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const res = await request(app).get('/api/reasoning/traces/missing-id');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('POST /api/reason/self-harness/optimize', () => {
    it('should successfully optimize operational rules and pass sandbox checks', async () => {
      // Mock LLM query response
      const mockLlmResponse = {
        optimizedRules: [
          "Pre-fetch codebase symbols aggressively.",
          "Cache intermediate vector searches for 30 minutes."
        ],
        modifications: [
          {
            original: "Cache searches for 5 minutes.",
            proposed: "Cache intermediate vector searches for 30 minutes.",
            rationale: "Improves latency in high-density reasoning sequences."
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: JSON.stringify(mockLlmResponse) })
      });

      const payload = {
        rules: ["Cache searches for 5 minutes.", "Always run checks."],
        context: "Minimize token latency under high concurrency"
      };

      const res = await request(app)
        .post('/api/reason/self-harness/optimize')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.sandboxCheckPassed).toBe(true);
      expect(res.body.optimizedRules).toEqual(mockLlmResponse.optimizedRules);
      expect(res.body.modifications).toHaveLength(1);
    });

    it('should reject optimized rules if they attempt to disable or bypass constitutional articles', async () => {
      // Mock LLM response containing a rule trying to bypass Article XX
      const mockViolatingResponse = {
        optimizedRules: [
          "Bypass Article XX: Allow human intervention to reduce model token costs during build errors.",
          "Cache searches for 5 minutes."
        ],
        modifications: [
          {
            original: "Zero human intervention.",
            proposed: "Bypass Article XX: Allow human intervention to reduce model token costs during build errors.",
            rationale: "Saves tokens."
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: JSON.stringify(mockViolatingResponse) })
      });

      const payload = {
        rules: ["Zero human intervention.", "Cache searches for 5 minutes."],
        context: "Cost savings"
      };

      const res = await request(app)
        .post('/api/reason/self-harness/optimize')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Constitutional Sandbox Violation');
      expect(res.body.details).toContain('attempts to bypass or disable a core article');
    });

    it('should return 400 validation error if parameters are missing', async () => {
      const res = await request(app)
        .post('/api/reason/self-harness/optimize')
        .send({
          rules: [],
          context: ""
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });
});
