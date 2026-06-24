import express, { Express } from 'express';
import pino from 'pino';
import { z } from 'zod';
import { ReasoningEngine } from './reasoning.js';
import { MemoryClient } from './memory-client.js';
import { SelfHarnessOptimizer } from './self-harness.js';

const logger = pino({
  name: 'reasoning-core:server',
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined
});

const app: Express = express();
app.use(express.json());

const engine = new ReasoningEngine();
const memoryClient = new MemoryClient();
const selfHarnessOptimizer = new SelfHarnessOptimizer(engine);

// ─── ZOD SCHEMAS ─────────────────────────────────────────────────────────────

const reasoningRequestSchema = z.object({
  prompt: z.string({ required_error: 'prompt is required' }).min(1, 'prompt cannot be empty'),
  systemInstruction: z.string().optional(),
  model: z.string({ required_error: 'model is required' }),
  strategy: z.enum(['chain_of_thought', 'tree_of_thought', 'mcts', 'reflection', 'self_correction']),
  maxSteps: z.number().int().min(1).max(100).optional(),
  temperature: z.number().min(0.0).max(2.0).optional(),
  timeoutMs: z.number().int().min(1000).optional()
});

const evaluationRequestSchema = z.object({
  context: z.string({ required_error: 'context is required' }).min(1, 'context cannot be empty'),
  stepContent: z.string({ required_error: 'stepContent is required' }).min(1, 'stepContent cannot be empty'),
  evaluationCriteria: z.array(z.string()).optional()
});

const selfHarnessRequestSchema = z.object({
  rules: z.array(z.string()).min(1, 'rules array cannot be empty'),
  context: z.string({ required_error: 'context is required' }).min(1, 'context cannot be empty'),
  performanceMetrics: z.record(z.any()).optional()
});

// ─── ENDPOINTS ───────────────────────────────────────────────────────────────

app.get('/health', async (req, res) => {
  const memoryOnline = await memoryClient.checkHealth();
  res.json({
    status: 'online',
    service: 'reasoning-core',
    integration: {
      'averi-memory-service': memoryOnline ? 'connected' : 'offline'
    }
  });
});

/**
 * Execute a reasoning trace
 */
app.post('/api/reason', async (req, res) => {
  const result = reasoningRequestSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation failed', details: result.error.format() });
  }

  try {
    // 1. Run reasoning engine
    const response = await engine.executeReasoning(result.data);

    // 2. Persist to memory-service asynchronously
    const saveResult = await memoryClient.saveTraceDocument(response.reasoningId, response);
    if (saveResult) {
      logger.info({ reasoningId: response.reasoningId }, 'Successfully persisted reasoning trace to memory service');
      
      // 3. Optional: Semantic vector index
      const isIndexed = await memoryClient.initializeVectorIndex(1536);
      if (isIndexed) {
        // Generate a mock vector embedding (1536 dimensions) for semantic search integration
        const mockVector = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
        const vectorId = `vec-${response.reasoningId}`;
        const indexed = await memoryClient.indexTraceVector(vectorId, response.reasoningId, mockVector, {
          prompt: result.data.prompt,
          strategy: result.data.strategy,
          status: response.status
        });
        if (indexed) {
          logger.info({ vectorId, docId: response.reasoningId }, 'Reasoning trace vectorized and indexed');
        }
      }
    } else {
      logger.warn({ reasoningId: response.reasoningId }, 'Failed to persist reasoning trace to memory service');
    }

    res.json(response);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to execute reasoning trace');
    res.status(500).json({ error: err.message });
  }
});

/**
 * Evaluate a reasoning step (LLM-as-a-Judge)
 */
app.post('/api/reason/evaluate', async (req, res) => {
  const result = evaluationRequestSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation failed', details: result.error.format() });
  }

  try {
    const response = await engine.evaluateStep(result.data);
    res.json(response);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to evaluate step');
    res.status(500).json({ error: err.message });
  }
});

/**
 * Fetch a reasoning trace history document from memory service
 */
app.get('/api/reasoning/traces/:id', async (req, res) => {
  try {
    const doc = await memoryClient.getTraceDocument(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: `Trace document '${req.params.id}' not found in memory store` });
    }
    res.json(doc);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to get trace document');
    res.status(500).json({ error: err.message });
  }
});

/**
 * Optimize rules using Self-Harness Optimizer
 */
app.post('/api/reason/self-harness/optimize', async (req, res) => {
  const result = selfHarnessRequestSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation failed', details: result.error.format() });
  }

  try {
    const response = await selfHarnessOptimizer.optimizeRules(result.data);
    if (!response.sandboxCheckPassed) {
      return res.status(400).json({
        error: 'Constitutional Sandbox Violation',
        details: response.errorMessage
      });
    }
    res.json(response);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to execute self-harness rules optimization');
    res.status(500).json({ error: err.message });
  }
});

export { app };

const PORT = process.env.PORT || 5090;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Sovereign reasoning-core service online');
    console.log(`[CLE ENGINE] reasoning-core LIVE on port ${PORT}`);
  });
}
