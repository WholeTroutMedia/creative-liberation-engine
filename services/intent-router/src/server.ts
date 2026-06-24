import express from 'express';
import { ResolveIntentRequestSchema } from './types.js';
import { InvertedIndex } from './index-builder.js';
import { SemanticMatcher } from './semantic.js';
import { IntentResolver } from './resolver.js';
import { emitTelemetry } from './telemetry.js';

const app = express();
const port = process.env.PORT || 5180;

app.use(express.json());

// Initialize index, semantic matcher, and resolver
const index = new InvertedIndex();
const semantic = new SemanticMatcher();
const resolver = new IntentResolver(index, semantic);

// Boot sequence
console.log('[Server] Starting boot sequence...');
index.build();

// Async initialization of semantic matcher (ChromaDB) so server boot is non-blocking
semantic.init(index).then(() => {
  console.log('[Server] ChromaDB semantic matching initialized.');
}).catch(err => {
  console.error('[Server] Failed to initialize ChromaDB semantic matching:', err);
});

// GET /api/status - Health Check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'intent-router',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    index: {
      totalEntries: index.getTotalEntries(),
      skillsCount: index.skillsRaw.length,
      templatesCount: index.templatesRaw.length,
      workflowsCount: index.workflowsRaw.length
    },
    semantic: {
      initialized: semantic.initialized,
      chromaAvailable: !!semantic.client
    }
  });
});

// POST /api/intent/resolve - Resolve Intent Route
app.post('/api/intent/resolve', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const parseResult = ResolveIntentRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.format()
      });
    }

    const { text, context } = parseResult.data;
    const result = await resolver.resolve(text, context);
    const durationMs = Date.now() - startTime;

    // Emit Telemetry
    await emitTelemetry({
      event: 'intent.routed',
      timestamp: new Date().toISOString(),
      input: text,
      category: result.category,
      matchedSkills: result.skills,
      matchedTemplate: result.template || null,
      matchedWorkflow: result.workflow || null,
      leadAgents: result.leadAgents,
      confidence: result.confidence,
      fallbackLevel: result.fallbackLevel,
      resolutionMs: durationMs,
      source: result.fallbackLevel === 0 ? 'deterministic' : (result.fallbackLevel === 1 ? 'semantic' : 'fallback')
    });

    res.json(result);
  } catch (err) {
    console.error('[Server] Error handling /api/intent/resolve:', err);
    res.status(500).json({ error: 'Internal server error', details: (err as Error).message });
  }
});

// POST /api/intent/refresh - Rebuild Inverted Indexes and Embeddings
app.post('/api/intent/refresh', async (req, res) => {
  const startTime = Date.now();
  try {
    index.build();
    if (semantic.client) {
      await semantic.seed(index);
    }
    const durationMs = Date.now() - startTime;
    res.json({
      success: true,
      message: 'Inverted indexes and ChromaDB embeddings successfully refreshed.',
      durationMs,
      index: {
        totalEntries: index.getTotalEntries()
      }
    });
  } catch (err) {
    console.error('[Server] Error handling /api/intent/refresh:', err);
    res.status(500).json({ error: 'Refresh failed', details: (err as Error).message });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`[Server] Intent Router Service is listening on port ${port}`);
});
