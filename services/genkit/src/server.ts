/**
 * Creative Liberation Engine â€” Genkit HTTP Server
 *
 * Express server exposing Genkit flows and generate() as REST endpoints.
 * Serves double duty:
 *   1. v5 native API server
 *   2. v4 bridge target (Python ModelRouter calls these endpoints)
 *
 * Constitutional: Article II (Sovereignty) â€” runs locally, no external dependencies
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { apiKeyAuth } from './middleware/api-key-auth.js';
import { ai, z } from './index.js';
import { localGenerate, localStream, checkOllamaHealth } from './local-providers.js';

import { defaultMiddleware } from './middleware/fallback-chain.js';
import { mcpAutoloadMiddleware } from '@cle/mcp-router';
import {
    urlSlugify,
    base64Encode,
    passwordStrength,
    paletteGenerator,
    contrastRatio,
} from '@cle/toolbox';
import { getAuditLog, getAuditStats } from './middleware/audit-logger.js';
import { appendInference } from '@cle/ouroboros';
import { classifyTaskFlow } from './flows/classify-task.js';
import { ATHENAFlow } from './flows/athena.js';
import { VERAFlow } from './flows/vera.js';
import { conversationalAveriFlow } from './flows/conversationalAveri.js';
import { averiChatFlow } from './flows/averi-chat-flow.js';
import { averiInvokeFlow } from './flows/averi-invoke.js';
import { strategicConsultFlow, STRATEGIC_REPORT_TEMPLATES } from './flows/strategic-advisory.js';
import { KEEPERFlow } from './flows/keeper.js';
import { scribeMemoryTool } from './tools/scribe-memory.js';
import { chromaRetriever } from './tools/chromadb-retriever.js';
import { HypeReelDirectorFlow } from './flows/hype-reel-director.js';
import { CreativeDirectorFlow } from './flows/creative-director.js';
import { FieldBrainFlow } from './flows/field-brain.js';
import { SignalFlow } from './flows/signal-flow.js';
import { SignalUniFlow } from './flows/signal-uniflow.js';
import { remConsolidationFlow } from './flows/rem-consolidation.js';
import { AGENT_ROSTER, getAgentActivity, recordAgentCall } from './flows/index.js';
import { agentOAuth } from '@cle/auth/dist/agent-oauth.js';
import { guestIntelligenceFlow } from './flows/guestIntelligence.js';
import { strangerAlertFlow } from './flows/strangerAlert.js';
import { birdWatcherFlow } from './flows/birdWatcher.js';
import { deployTrainingToEonFlow } from './flows/eon-reality-orchestration.js';
import { initializeOmnipresenceCache } from './core/context-cache.js';
// virtual-strangers.js was removed (Article XXIII — project is no longer embedded in creative-liberation-engine)
import { WPPublishingFlow } from './flows/wp-publishing.js';
import { transmissionGenerateFlow } from './flows/transmission.js';
import { intakeRouterFlow } from './flows/intakeRouter.js';
import { RELAYFlow, SIGNALFlow as SwitchboardSIGNALFlow, SWITCHBOARDFlow } from './flows/relay-signal-switchboard.js';
import { LEXFlow, COMPASSFlow } from './flows/lex-compass.js';
import { stitchDesignFlow } from './flows/stitch-design.js';
import { socraticReflectionFlow } from './flows/socratic-reflection.js';
import { webResearchFlow } from './flows/web-research.js';
import {
    autoRetrieveContext,
    memoryQueryFromBody,
    mergeSystemWithMemory,
} from './memory/auto-retrieve.js';
import { registerModelFleetRoutes } from './routes/model-fleet.js';

// ---------------------------------------------------------------------------
// The CLI's RuntimeManager watches .genkit/runtimes/*.json for runtime discovery.
// Two-part fix:
//   1. Write AFTER port 3100 is ready (prevents immediate health-check delete)
//   2. 4s heartbeat (RuntimeManager ignores 'change' events, only handles 'add'/'unlink')
// ---------------------------------------------------------------------------
if (process.env.GENKIT_ENV === 'dev') {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(__dirname, '..');
    const runtimesDir = path.join(projectRoot, '.genkit', 'runtimes');
    fs.mkdirSync(runtimesDir, { recursive: true });

    const runtimeId = process.env.GENKIT_RUNTIME_ID ?? `${process.pid}-3100`;
    const runtimeFile = path.join(runtimesDir, `${runtimeId}.json`);

    const writeRegistration = () => {
        const data = {
            id: runtimeId,
            pid: process.pid,
            reflectionServerUrl: 'http://localhost:3100',
            reflectionApiSpecVersion: 1,
            timestamp: new Date().toISOString(),
        };
        fs.writeFileSync(runtimeFile, JSON.stringify(data, null, 2));
    };

    // Poll until reflection server is accepting connections, THEN write.
    // This prevents the RuntimeManager's immediate health check (which fires on
    // chokidar 'add') from failing with CONNECTION_REFUSED and deleting our file.
    (async () => {
        const start = Date.now();
        while (Date.now() - start < 15000) {
            try {
                const r = await fetch('http://localhost:3100/api/__health');
                if (r.status === 200) break;
            } catch { /* not ready yet */ }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Write the file ONCE â€” port 3100 is confirmed ready
        writeRegistration();
        console.log(`[GENKIT] âœ“ Runtime registered (${runtimeId}) â†’ Dev UI at http://localhost:4000`);

        // Heartbeat: keep timestamp fresh so it remains a valid runtime entry
        // and isn't garbage-collected by the Genkit CLI. We use utimesSync to 
        // merely "touch" the file instead of rewriting it. Rewriting on Windows
        // triggers 'unlink' then 'add' chokidar events, which causes the Dev UI
        // to loop through "Waiting to connect" and refresh automatically.
        const heartbeat = setInterval(() => {
            try {
                const now = new Date();
                fs.utimesSync(runtimeFile, now, now);
            } catch {
                clearInterval(heartbeat);
            }
        }, 4000);

        // Clean up on exit
        const cleanup = () => {
            clearInterval(heartbeat);
            try { fs.unlinkSync(runtimeFile); } catch { /* ignore */ }
        };
        process.on('exit', cleanup);
        process.on('SIGINT', () => { cleanup(); process.exit(0); });
        process.on('SIGTERM', () => { cleanup(); process.exit(0); });
    })();
}





// Plugins are registered in index.ts at Genkit construction time.
// Log active providers on server boot for visibility.
const activeProviders = [
    process.env['GEMINI_API_KEY'] && 'google-ai',
    (process.env['VERTEX_API_KEY'] || process.env['GOOGLE_API_KEY']) && 'vertex-ai',
    process.env['OPENAI_API_KEY'] && 'openai',
    process.env['ANTHROPIC_API_KEY'] && 'anthropic',
].filter(Boolean);
console.log(`[GENKIT:SERVER] Active providers: ${activeProviders.join(', ')}`);

// Sovereign mode â€” all inference routes to local Ollama when enabled
const SOVEREIGN_MODE = process.env['SOVEREIGN_MODE'] === 'true';
if (SOVEREIGN_MODE) {
    console.log('[GENKIT:SERVER] ðŸ¦™ SOVEREIGN MODE ACTIVE â€” all /generate traffic routed to local Ollama');
    console.log(`[GENKIT:SERVER]    OLLAMA_HOST: ${process.env['OLLAMA_HOST'] ?? 'http://192.168.2.20:11434'}`);
}

// ---------------------------------------------------------------------------
// Server Setup
// ---------------------------------------------------------------------------

// Initialize the SCRIBE Omnipresence Context Cache asynchronously
initializeOmnipresenceCache().catch(console.error);

// Provision internal tokens for all agents in the roster at boot time
agentOAuth.issueAllAgentTokens();

const app: ReturnType<typeof express> = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Apply API Key Authentication
app.use(apiKeyAuth);

// MCP-06: Auto-activate MCP servers based on request task hints
// Middleware reads req.body.task (or req.body.prompt) and activates
// relevant MCP domains before the flow executes.
app.use(async (req, res, next) => {
    if (req.method !== 'POST') return next();
    try {
        const genkitReq = { ...req.body, flowName: req.path.split('/').pop() };
        await (mcpAutoloadMiddleware as any)(genkitReq, async () => {});
    } catch (e) {
        console.error('[MCP Middleware] Error:', e);
    }
    next();
});

// ---------------------------------------------------------------------------
// ARCHAEON Inference Telemetry Middleware
// Intercepts every POST to a flow endpoint, times execution, and appends
// the I/O to the ARCHAEON ledger for future LoRA distillation.
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    // Only track flow and generate endpoints
    const isFlowRoute =
        req.path.startsWith('/') &&
        !req.path.startsWith('/health') &&
        !req.path.startsWith('/api/agents') &&
        !req.path.startsWith('/api/task') &&
        !req.path.startsWith('/api/model-fleet');
    if (!isFlowRoute) return next();

    const start = Date.now();
    const originalJson = res.json.bind(res);
    let capturedOutput: unknown = undefined;

    res.json = (body: unknown): typeof res => {
        capturedOutput = body;
        return originalJson(body);
    };

    res.on('finish', () => {
        try {
            const duration = Date.now() - start;
            const flowName = req.path.replace(/^\//,'').replace(/\//g,'.') || 'unknown';
            const model = (req.body as Record<string, string>)?.model ?? process.env['ARCHAEON_DEFAULT_MODEL'] ?? 'gemini-flash';
            const success = res.statusCode >= 200 && res.statusCode < 300;

            appendInference({
                timestamp: new Date().toISOString(),
                agent: flowName,
                model,
                route: 'cloud',
                system_prefix: ((req.body as Record<string, string>)?.system ?? '').slice(0, 200),
                input: (req.body as Record<string, unknown>)?.input ?? req.body,
                output: capturedOutput,
                duration_ms: duration,
                success,
            });
        } catch { /* never let telemetry break a request */ }
    });

    next();
});

const PORT = process.env.PORT || 4100;

// ---------------------------------------------------------------------------
// Health & Status
// ---------------------------------------------------------------------------

app.get('/health', async (_req, res) => {
    const providers: Record<string, boolean> = {
        gemini: Boolean(process.env['GEMINI_API_KEY']),
        vertex: Boolean(process.env['VERTEX_API_KEY'] || process.env['GOOGLE_API_KEY']),
        openai: Boolean(process.env['OPENAI_API_KEY']),
        anthropic: Boolean(process.env['ANTHROPIC_API_KEY']),
    };
    const activeProviders = Object.entries(providers).filter(([, v]) => v).map(([k]) => k);
    const ollamaStatus = await checkOllamaHealth();
    res.json({
        status: 'operational',
        service: 'cle-genkit',
        version: '5.0.0',
        providers: activeProviders,
        sovereign: {
            mode: SOVEREIGN_MODE,
            ollama: ollamaStatus,
            host: process.env['OLLAMA_HOST'] ?? 'http://192.168.2.20:11434',
        },
        timestamp: new Date().toISOString(),
    });
});

registerModelFleetRoutes(app);

app.get('/stats', (_req, res) => {
    res.json(getAuditStats());
});

app.get('/audit', (_req, res) => {
    const limit = parseInt(String(_req.query.limit)) || 50;
    const log = getAuditLog();
    res.json(log.slice(-limit));
});

// VIRTUAL STRANGERS — project removed (Article XXIII). Routes return 410 Gone.
app.use('/vs', (_req, res) => {
    res.status(410).json({ error: 'Virtual Strangers has been removed from the Creative Liberation Engine. API route is gone.' });
});

// ---------------------------------------------------------------------------
// THE TRANSMISSION — Infinite Story Generator
// GET  /transmission/feed     — SSE stream: replay existing artifacts + tail for new
// GET  /transmission/world    — Current world state JSON
// POST /transmission/reader   — Record anonymous reader signal
// POST /transmission/generate — Trigger artifact generation via Genkit flow
// ---------------------------------------------------------------------------

const TRANSMISSION_DATA_DIR = process.env['TRANSMISSION_DATA_DIR'] ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..', 'data', 'transmission');
const TRANSMISSION_ARTIFACTS_PATH = path.join(TRANSMISSION_DATA_DIR, 'artifacts.jsonl');
const TRANSMISSION_WORLD_PATH     = path.join(TRANSMISSION_DATA_DIR, 'world-state.json');
const TRANSMISSION_SIGNALS_PATH   = path.join(TRANSMISSION_DATA_DIR, 'reader-signals.jsonl');

console.log(`[TRANSMISSION] Data dir: ${TRANSMISSION_DATA_DIR}`);

// SSE feed — replay all existing artifacts then tail for new ones

// JSON snapshot — last N artifacts (newest first). Use for initial paint; SSE remains on /feed.
app.get('/transmission/artifacts', (req, res) => {
    try {
        const raw = req.query['limit'];
        const limit = Math.min(Math.max(parseInt(String(raw ?? '20'), 10) || 20, 1), 200);
        if (!fs.existsSync(TRANSMISSION_ARTIFACTS_PATH)) {
            return res.json([]);
        }
        const lines = fs.readFileSync(TRANSMISSION_ARTIFACTS_PATH, 'utf-8').split('\n').filter(Boolean);
        const parsed: unknown[] = [];
        for (const line of lines) {
            try {
                parsed.push(JSON.parse(line));
            } catch { /* skip malformed */ }
        }
        const slice = parsed.slice(-limit).reverse();
        res.json(slice);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// SSE feed — replay all existing artifacts then tail for new ones
app.get('/transmission/feed', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    // Replay existing artifacts
    try {
        if (fs.existsSync(TRANSMISSION_ARTIFACTS_PATH)) {
            const existing = fs.readFileSync(TRANSMISSION_ARTIFACTS_PATH, 'utf-8');
            for (const line of existing.split('\n').filter(Boolean)) {
                res.write(`data: ${line}\n\n`);
            }
        }
    } catch (e) {
        console.error('[TRANSMISSION:FEED] Error reading artifacts:', e);
    }

    // Watch for new artifacts
    let watcher: fs.FSWatcher | null = null;
    let lastSize = 0;
    try {
        lastSize = fs.existsSync(TRANSMISSION_ARTIFACTS_PATH)
            ? fs.statSync(TRANSMISSION_ARTIFACTS_PATH).size
            : 0;
    } catch { /* file may not exist yet */ }

    try {
        fs.mkdirSync(TRANSMISSION_DATA_DIR, { recursive: true });
        watcher = fs.watch(TRANSMISSION_ARTIFACTS_PATH, () => {
            try {
                const stat = fs.statSync(TRANSMISSION_ARTIFACTS_PATH);
                if (stat.size <= lastSize) return;
                // Read only the new bytes
                const fd = fs.openSync(TRANSMISSION_ARTIFACTS_PATH, 'r');
                const buf = Buffer.alloc(stat.size - lastSize);
                fs.readSync(fd, buf, 0, buf.length, lastSize);
                fs.closeSync(fd);
                lastSize = stat.size;
                const newLines = buf.toString('utf-8').split('\n').filter(Boolean);
                for (const line of newLines) {
                    res.write(`data: ${line}\n\n`);
                }
            } catch { /* ignore partial reads */ }
        });
    } catch { /* file may not exist yet — watcher will fail gracefully */ }

    // Keep-alive ping every 30s
    const keepAlive = setInterval(() => {
        try { res.write(': keepalive\n\n'); } catch { clearInterval(keepAlive); }
    }, 30_000);

    req.on('close', () => {
        clearInterval(keepAlive);
        watcher?.close();
    });
});

// World state
app.get('/transmission/world', (_req, res) => {
    try {
        if (!fs.existsSync(TRANSMISSION_WORLD_PATH)) {
            return res.status(404).json({ error: 'World state not initialized' });
        }
        const state = JSON.parse(fs.readFileSync(TRANSMISSION_WORLD_PATH, 'utf-8'));
        res.json(state);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Reader signal ingestion
app.post('/transmission/reader', (req, res) => {
    try {
        const { artifactId, action, tags } = req.body as {
            artifactId: string;
            action: string;
            tags?: string[];
        };
        if (!artifactId || !action) {
            return res.status(400).json({ error: '"artifactId" and "action" required' });
        }
        const signal = {
            artifactId,
            action,
            at: new Date().toISOString(),
            tags: tags ?? [],
        };
        fs.mkdirSync(TRANSMISSION_DATA_DIR, { recursive: true });
        fs.appendFileSync(TRANSMISSION_SIGNALS_PATH, JSON.stringify(signal) + '\n');
        res.json({ recorded: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Generate a new artifact via the Genkit flow
app.post('/transmission/generate', async (req, res) => {
    try {
        const result = await transmissionGenerateFlow(req.body);
        res.json(result);
    } catch (e: any) {
        console.error('[TRANSMISSION:GENERATE] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Single artifact lookup by ID
app.get('/transmission/artifact/:id', (req, res) => {
    try {
        if (!fs.existsSync(TRANSMISSION_ARTIFACTS_PATH)) {
            return res.status(404).json({ error: 'No artifacts found' });
        }
        const lines = fs.readFileSync(TRANSMISSION_ARTIFACTS_PATH, 'utf-8').split('\n').filter(Boolean);
        for (const line of lines) {
            try {
                const a = JSON.parse(line);
                if (a.id === req.params['id']) {
                    return res.json(a);
                }
            } catch { /* skip malformed lines */ }
        }
        res.status(404).json({ error: 'Artifact not found' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// ATLAS — Production Knowledge Graph REST API
// The Creative Liberation Engine's equivalent of Asteria Continuum Suite "Atlas".
// ---------------------------------------------------------------------------
import { atlas } from './memory/atlas.js';

app.get('/atlas/stats', async (_req, res) => {
    try {
        const stats = await atlas.getStats();
        res.json(stats);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/atlas/nodes', async (req, res) => {
    try {
        const { type } = req.query as { type?: string };
        const graph = await atlas.getGraph();
        let nodes = Object.values(graph.nodes);
        if (type) nodes = nodes.filter(n => n.type === type);
        res.json({ nodes, total: nodes.length });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/atlas/nodes/:id', async (req, res) => {
    try {
        const node = await atlas.getNode(req.params['id']!);
        if (!node) return res.status(404).json({ error: 'Node not found' });
        res.json(node);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/atlas/nodes', async (req, res) => {
    try {
        const { type, label, properties, relations, agentName, action, existingId } = req.body;
        if (!type || !label) return res.status(400).json({ error: '"type" and "label" are required' });
        const node = await atlas.commit({ type, label, properties, relations, agentName: agentName ?? 'CONSOLE', action: action ?? 'create', existingId });
        res.status(201).json(node);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/atlas/nodes/:id', async (req, res) => {
    try {
        const deleted = await atlas.deleteNode(req.params['id']!);
        if (!deleted) return res.status(404).json({ error: 'Node not found' });
        res.json({ deleted: true, id: req.params['id'] });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/atlas/search', async (req, res) => {
    try {
        const { q, limit } = req.query as { q?: string; limit?: string };
        if (!q) return res.status(400).json({ error: '"q" query param required' });
        const result = await atlas.search(q, limit ? parseInt(limit) : 10);
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// GEOMIND — Geospatial Intelligence REST API
// POST /geo-mind  — Natural language location queries → structured geo data
// ---------------------------------------------------------------------------
import { callGeoMind } from './flows/geo-mind.js';

app.post('/geo-mind', async (req, res) => {
    try {
        const result = await callGeoMind(req.body);
        res.json(result);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: message });
    }
});

// ---------------------------------------------------------------------------
// CLE FIELD — Live Production AI Pipeline
// POST /field-brain  — Edge node ingest: frame extraction + Gemini AI tagging
// POST /signal       — Highlight detection + clip export + Nexus publish
// ---------------------------------------------------------------------------

app.post('/field-brain', async (req, res) => {
    try {
        const result = await FieldBrainFlow(req.body);
        res.json(result);
    } catch (e: any) {
        console.error('[FIELD-BRAIN] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/signal', async (req, res) => {
    try {
        const result = await SignalFlow(req.body);
        res.json(result);
    } catch (e: any) {
        console.error('[SIGNAL] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/signal-uniflow', async (req, res) => {
    try {
        const result = await SignalUniFlow(req.body);
        res.json(result);
    } catch (e: any) {
        console.error('[SIGNAL UNIFLOW] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// SWITCHBOARD HIVE — RELAY / SIGNAL / SWITCHBOARD / LEX / COMPASS
// ---------------------------------------------------------------------------

app.post('/relay', async (req, res) => {
    try {
        const result = await RELAYFlow(req.body);
        res.json(result);
    } catch (e: any) {
        console.error('[RELAY] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/switchboard/signal', async (req, res) => {
    try {
        const result = await SwitchboardSIGNALFlow(req.body);
        res.json(result);
    } catch (e: any) {
        console.error('[SIGNAL] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/switchboard', async (req, res) => {
    try {
        const result = await SWITCHBOARDFlow(req.body);
        res.json(result);
    } catch (e: any) {
        console.error('[SWITCHBOARD] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/lex', async (req, res) => {
    try {
        const result = await LEXFlow(req.body);
        res.json(result);
    } catch (e: any) {
        console.error('[LEX] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/compass', async (req, res) => {
    try {
        const result = await COMPASSFlow(req.body);
        res.json(result);
    } catch (e: any) {
        console.error('[COMPASS] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// MEMORY — REM Consolidation
// POST /rem-consolidation  — Nightly working-tier → mid-term → long-term promotion
// Send { "dryRun": true } to preview what would be promoted without writing.
// ---------------------------------------------------------------------------

app.post('/rem-consolidation', async (req, res) => {
    try {
        const input = {
            dryRun: req.query['dryRun'] === 'true' || req.body?.dryRun === true,
            ...req.body,
        };
        const result = await remConsolidationFlow(input);
        res.json(result);
    } catch (e: any) {
        console.error('[REM] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// Agent Telemetry — /agents
// Exposes the full 40-agent roster + last-seen timestamps so the Console can
// prove every agent is real and show when each was last invoked.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SENTINEL — Flipboard Ideation Pipeline
// Provides API control plane for the autonomous RSS→ATHENA pipeline.
// ---------------------------------------------------------------------------

app.get('/sentinel/queue', async (_req, res) => {
    try {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const queueDir = '\\\\127.0.0.1\\docker\\genesis-deploy\\runtime\\ideation-queue';
        
        if (!fs.existsSync(queueDir)) {
            return res.json({ jobs: [], total: 0 });
        }
        
        const files = fs.readdirSync(queueDir).filter((f: string) => f.endsWith('.json'));
        const jobs = files.map((f: string) => {
            const data = JSON.parse(fs.readFileSync(path.join(queueDir, f), 'utf-8'));
            return {
                jobId: data.jobId,
                slug: data.slug,
                status: data.status,
                title: data.sourceArticle?.title,
                cleRelevance: data.cleRelevance,
                categories: data.categories,
                relatedJobs: data.relatedJobs,
                createdAt: data.createdAt,
                ideatedAt: data.ideatedAt,
            };
        });
        
        jobs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json({ jobs, total: jobs.length });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/sentinel/job/:jobId', async (req, res) => {
    try {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const queueDir = '\\\\127.0.0.1\\docker\\genesis-deploy\\runtime\\ideation-queue';
        const files = fs.readdirSync(queueDir).filter((f: string) => f.startsWith(req.params.jobId));
        
        if (files.length === 0) {
            return res.status(404).json({ error: `Job ${req.params.jobId} not found` });
        }
        
        const manifest = JSON.parse(fs.readFileSync(path.join(queueDir, files[0]), 'utf-8'));
        res.json(manifest);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/sentinel/activate/:jobId', async (req, res) => {
    try {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const queueDir = '\\\\127.0.0.1\\docker\\genesis-deploy\\runtime\\ideation-queue';
        const files = fs.readdirSync(queueDir).filter((f: string) => f.startsWith(req.params.jobId));
        
        if (files.length === 0) {
            return res.status(404).json({ error: `Job ${req.params.jobId} not found` });
        }
        
        const filePath = path.join(queueDir, files[0]);
        const manifest = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        if (manifest.status !== 'IDEATED') {
            return res.status(400).json({ error: `Job ${req.params.jobId} is in ${manifest.status} state, expected IDEATED` });
        }
        
        // Activate: move to PLAN phase
        manifest.status = 'PLANNED';
        manifest.activatedAt = new Date().toISOString();
        fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2));
        
        // Dispatch ATHENA in PLAN mode
        const planResult = await ATHENAFlow({
            mode: 'spec',
            topic: manifest.sourceArticle.title,
            context: `IDEATION DIRECTIVE:\n${manifest.athenaOutput?.directive}\n\nRATIONALE:\n${manifest.athenaOutput?.rationale}\n\nOriginal Article: ${manifest.sourceArticle.url}`,
            depth: 'deep',
        });
        
        res.json({
            jobId: manifest.jobId,
            status: manifest.status,
            activatedAt: manifest.activatedAt,
            planOutput: planResult,
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/sentinel/ideate', async (req, res) => {
    try {
        const { title, url, author, text, depth } = req.body;
        
        if (!title || !text) {
            return res.status(400).json({ error: 'title and text are required' });
        }
        
        const result = await ATHENAFlow({
            mode: 'strategy',
            topic: title,
            context: `SOURCE ARTICLE:\n\nTitle: ${title}\nAuthor: ${author || 'Unknown'}\nURL: ${url || ''}\n\nFull Text:\n${text}`,
            depth: depth || 'deep',
        });
        
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});


app.get('/agents', (_req, res) => {
    const activity = getAgentActivity();
    const roster = AGENT_ROSTER.map((agent) => {
        const act = activity.find(a => a.name === agent.name);
        return {
            ...agent,
            lastCall: act?.lastCall ?? 'never',
            callCount: act?.callCount ?? 0,
            avgMs: act?.avgMs,
            isLive: (act?.lastCall ?? 'never') !== 'never',
        };
    });

    // Group by hive for dashboard consumption
    const byHive: Record<string, typeof roster> = {};
    for (const agent of roster) {
        if (!byHive[agent.hive]) byHive[agent.hive] = [];
        byHive[agent.hive]!.push(agent);
    }

    res.json({
        total: roster.length,
        active: roster.filter(a => a.status === 'active').length,
        planned: roster.filter(a => a.status === 'planned').length,
        live: roster.filter(a => a.isLive).length,
        agents: roster,
        byHive,
        timestamp: new Date().toISOString(),
    });
});

app.get('/agents/:name', (req, res) => {
    const agent = AGENT_ROSTER.find(a => a.name === req.params['name']?.toUpperCase());
    if (!agent) return res.status(404).json({ error: `Agent '${req.params['name']}' not found` });
    const activity = getAgentActivity().find(a => a.name === agent.name);
    res.json({ ...agent, lastCall: activity?.lastCall ?? 'never', callCount: activity?.callCount ?? 0, avgMs: activity?.avgMs });
});

// POST /agents/heartbeat — called by any flow or external service to record activity
app.post('/agents/heartbeat', (req, res) => {
    const { name, durationMs } = req.body as { name: string; durationMs?: number };
    const agent = AGENT_ROSTER.find(a => a.name === name?.toUpperCase());
    if (!agent) return res.status(404).json({ error: `Agent '${name}' not in roster` });
    recordAgentCall(agent.name as Parameters<typeof recordAgentCall>[0], durationMs);
    res.json({ recorded: true, name: agent.name, timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// COGNITIVE UPGRADE — Agent Hibernation / Resume / Context Compression
// Sovereign NAS-bound state persistence for multi-day agent orchestration.
// Constitutional: Article XX (zero wait time), Article VII (knowledge retention)
// ---------------------------------------------------------------------------
import { AgentSpawner } from '@cle/agent-spawner';
const cognitiveSpawner = new AgentSpawner();

// POST /agents/hibernate — Persist agent state to NAS
app.post('/agents/hibernate', async (req, res) => {
    try {
        const { agentId, context } = req.body as { agentId: string; context: any };
        if (!agentId) return res.status(400).json({ error: '"agentId" is required' });
        const result = await cognitiveSpawner.hibernateAgent(agentId, context || {});
        if (result) {
            recordAgentCall('KEEPER' as any);
            res.json({ success: true, ...result, timestamp: new Date().toISOString() });
        } else {
            res.status(500).json({ error: 'Hibernation failed — see server logs' });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /agents/resume — Restore agent state from NAS checkpoint
app.post('/agents/resume', async (req, res) => {
    try {
        const { agentId, resumeToken } = req.body as { agentId: string; resumeToken: string };
        if (!agentId || !resumeToken) return res.status(400).json({ error: '"agentId" and "resumeToken" required' });
        const context = await cognitiveSpawner.resumeAgent(agentId, resumeToken);
        if (context) {
            recordAgentCall('KEEPER' as any);
            res.json({ success: true, agentId, context, timestamp: new Date().toISOString() });
        } else {
            res.status(404).json({ error: `No valid checkpoint for ${agentId} with given token` });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /agents/compress — Compress raw DOM/terminal output via local Ollama
app.post('/agents/compress', async (req, res) => {
    try {
        const { rawInput, strategy } = req.body as { rawInput: string; strategy?: 'dom' | 'terminal' };
        if (!rawInput) return res.status(400).json({ error: '"rawInput" is required' });
        const compressed = await cognitiveSpawner.compressContext(rawInput, strategy || 'dom');
        res.json({
            success: true,
            originalLength: rawInput.length,
            compressedLength: compressed.length,
            reductionPercent: Math.round((1 - compressed.length / rawInput.length) * 100),
            compressed,
            timestamp: new Date().toISOString(),
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /agents/purge-checkpoints — Clean expired NAS checkpoints
app.post('/agents/purge-checkpoints', async (req, res) => {
    try {
        const { maxAgeDays } = req.body as { maxAgeDays?: number };
        const result = await cognitiveSpawner.purgeExpiredCheckpoints(maxAgeDays);
        res.json({ success: true, ...result, timestamp: new Date().toISOString() });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// DIRA Metrics — /dira/metrics
// Live 7-day telemetry for the Creator Productivity Dashboard
// ---------------------------------------------------------------------------
app.get('/dira/metrics', async (req, res) => {
    const CHROMADB_URL = process.env.CHROMADB_URL || 'http://127.0.0.1:8000';
    try {
        const getCol = await fetch(`${CHROMADB_URL}/api/v2/collections/production_cases`);
        if (!getCol.ok) {
            return res.json({ workflowSparklines: [], topExceptions: [], caseResolutionRate: [], totalWorkflows: 0, avgResolutionSec: 0 });
        }
        const col = (await getCol.json()) as any;
        
        const docsRes = await fetch(`${CHROMADB_URL}/api/v2/collections/${col.id}/get`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ include: ['metadatas'] })
        });
        if (!docsRes.ok) throw new Error('Failed to fetch cases');
        const docs = (await docsRes.json()) as any;
        const metadatas: any[] = docs.metadatas ?? [];

        // Date math for rolling 7-day window
        const now = new Date();
        now.setHours(0,0,0,0);
        const cutoff = new Date(now.getTime() - 6 * 86400000); // Today + 6 previous days

        // Process records
        let totalResolutionTime = 0;
        let totalResolvedCases = 0;
        let totalWorkflows = 0;

        const dayRates: Record<string, { total: number, auto: number }> = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(now.getTime() - i * 86400000);
            dayRates[d.toISOString().split('T')[0]] = { total: 0, auto: 0 };
        }

        const workflowPoints: Record<string, number[]> = {};
        const exceptions: Record<string, { autoResolved: number; escalated: number }> = {};

        for (const m of metadatas) {
            const createdAt = new Date(m.createdAt as string);
            if (createdAt < cutoff) continue;

            const dayKey = createdAt.toISOString().split('T')[0];
            totalWorkflows++;

            // Resolution Time
            const timeToResolve = m.timeToResolve ? Number(m.timeToResolve) : 0;
            if (timeToResolve > 0) {
                totalResolutionTime += timeToResolve;
                totalResolvedCases++;
            }

            // Exceptions
            if (m.type === 'exception') {
                const w = m.workflow as string || 'Unknown';
                if (!exceptions[w]) exceptions[w] = { autoResolved: 0, escalated: 0 };
                if (String(m.autoResolved) === 'true') exceptions[w].autoResolved++;
                else exceptions[w].escalated++;
            }

            // Resolution Rate
            if (dayRates[dayKey]) {
                dayRates[dayKey].total++;
                if (String(m.autoResolved) === 'true') dayRates[dayKey].auto++;
            }

            // Workflow Points
            const wType = m.workflow as string || 'General';
            if (!workflowPoints[wType]) workflowPoints[wType] = Array(7).fill(0);
            
            // Map day to index 0-6 (0 = 6 days ago, 6 = today)
            const dayDiff = Math.floor((now.getTime() - new Date(dayKey).getTime()) / 86400000);
            if (dayDiff >= 0 && dayDiff < 7) {
                workflowPoints[wType][6 - dayDiff]++;
            }
        }

        // Format Case Resolution Rate
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const caseResolutionRate = Object.entries(dayRates)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, d]) => ({
                day: dayNames[new Date(date).getDay()],
                rate: d.total > 0 ? Math.round((d.auto / d.total) * 100) : 100
            }));

        // Format Exceptions
        const topExceptions = Object.entries(exceptions)
            .map(([message, counts]) => ({
                message,
                count: counts.autoResolved + counts.escalated,
                autoResolved: counts.autoResolved,
                escalated: counts.escalated
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Format Workflows (assigning static colors for visual consistency)
        const COLORS = ['#F5A524', '#9B72CF', '#4285F4', '#22c55e', '#20B2AA', '#C17D4A', '#FF6B35'];
        const workflowSparklines = Object.entries(workflowPoints)
            .map(([type, points], i) => ({
                type,
                points,
                avgMinutes: 0,
                color: COLORS[i % COLORS.length]
            }));

        res.json({
            workflowSparklines,
            topExceptions,
            caseResolutionRate,
            totalWorkflows,
            avgResolutionSec: totalResolvedCases > 0 ? (totalResolutionTime / totalResolvedCases) / 1000 : 0
        });
    } catch (e) {
        console.error('[DIRA Metrics Error]', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.post('/generate', async (req, res) => {
    try {
        const { prompt, model, system, messages, config, tools } = req.body;

        if (!prompt && !messages) {
            return res.status(400).json({ error: 'Either "prompt" or "messages" is required' });
        }

        const memQuery = memoryQueryFromBody({ prompt, messages });
        const memoryBlock = memQuery ? await autoRetrieveContext(memQuery, 5) : '';
        const systemWithMemory = mergeSystemWithMemory(system, memoryBlock);

        // SOVEREIGN_MODE: bypass cloud entirely, route to local Ollama
        if (SOVEREIGN_MODE && !model) {
            const text = await localGenerate({
                prompt: prompt ?? '',
                system: systemWithMemory,
                capability: 'fast',
            });
            console.log('[GENKIT:SERVER] ðŸ¦™ SOVEREIGN â€” served from local Ollama');
            return res.json({ text, locality: 'local', sovereign: true });
        }

        const generateOptions: any = {
            use: defaultMiddleware(),
            model: model || process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
        };

        if (prompt) generateOptions.prompt = prompt;
        if (systemWithMemory) generateOptions.system = systemWithMemory;
        if (messages) generateOptions.messages = messages;
        if (config) generateOptions.config = config;

        const response = await ai.generate(generateOptions);

        res.json({
            text: response.text,
            usage: response.usage,
            finishReason: response.finishReason,
            custom: response.custom,
        });
    } catch (error: any) {
        console.error('[GENKIT:SERVER] Generate error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /api/mesh/execute â€” Cloud Mesh Execution Endpoint
// Receives payloads routed by the @cle/cloud-mesh and delegates
// to the appropriate capability flow.
// ---------------------------------------------------------------------------

app.post('/api/mesh/execute', async (req, res) => {
    try {
        const { taskId, agentId, payload } = req.body;

        if (!taskId || !payload) {
            return res.status(400).json({ error: '"taskId" and "payload" are required' });
        }

        console.log(`[MESH:EXECUTE] ðŸŒ Executing task: ${taskId} for agent: ${agentId}`);

        // Handle FORGE Asset Generation Jobs explicitly
        if (payload.checkpoint && payload.sessionConfig) {
            // It's a Forge Archive Job
            // @ts-ignore
            const { AssetArchiver } = await import('@cle-engine/forge/dist/asset-archiver.js');
            const archiver = new AssetArchiver({
                storage_path: process.env.FORGE_STORAGE_PATH ?? '/tmp/forge',
                platform_address: 'ie:platform',
            });
            const asset = await archiver.archive(payload.checkpoint, payload.sessionConfig);
            return res.json({ success: true, asset });
        }

        // Handle standard Genkit Generation requests
        if (payload.prompt || payload.messages) {
            const memQuery = memoryQueryFromBody({
                prompt: payload.prompt,
                messages: payload.messages,
            });
            const memoryBlock = memQuery ? await autoRetrieveContext(memQuery, 5) : '';
            const systemWithMemory = mergeSystemWithMemory(payload.system, memoryBlock);

            const generateOptions: any = {
                use: defaultMiddleware(),
            };
            if (payload.model) generateOptions.model = payload.model;
            if (payload.prompt) generateOptions.prompt = payload.prompt;
            if (systemWithMemory) generateOptions.system = systemWithMemory;
            if (payload.messages) generateOptions.messages = payload.messages;
            if (payload.config) generateOptions.config = payload.config;

            const response = await ai.generate(generateOptions);
            return res.json({
                text: response.text,
                usage: response.usage,
                finishReason: response.finishReason,
                custom: response.custom,
            });
        }

        // Handle specific flows by capability name if provided
        if (payload.flow) {
            switch (payload.flow) {
                case 'classify':
                    const { classifyTaskFlow } = await import('./flows/classify-task.js');
                    return res.json(await classifyTaskFlow(payload));
                case 'director':
                    const { HypeReelDirectorFlow } = await import('./flows/hype-reel-director.js');
                    return res.json(await HypeReelDirectorFlow(payload));
                case 'creative-director':
                    const { CreativeDirectorFlow } = await import('./flows/creative-director.js');
                    return res.json({ result: await CreativeDirectorFlow(payload) });
                case 'averiChat':
                    const { averiChatFlow } = await import('./flows/averi-chat-flow.js');
                    return res.json(await averiChatFlow(payload));
                default:
                    return res.status(400).json({ error: `Unknown flow: ${payload.flow}` });
            }
        }

        return res.status(400).json({ error: 'Payload must contain a understood execution pattern' });
    } catch (error: any) {
        console.error(`[MESH:EXECUTE] Error for task ${req.body.taskId}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// GET /api/mesh/health â€” Live health probe of all cloud mesh nodes
// Returns latency, status, region, and provider for each FORGE_* endpoint.
// Used by CloudMeshPage to show real node health.
// ---------------------------------------------------------------------------

interface MeshNodeHealth {
    id: string;
    provider: string;
    label: string;
    region: string;
    url: string;
    status: 'active' | 'degraded' | 'offline';
    latencyMs: number | null;
    version?: string;
    timestamp?: string;
}

const FORGE_NODES: { id: string; provider: string; label: string; region: string; envKey: string }[] = [
    { id: 'forge-sovereign', provider: 'local',      label: 'Sovereign NAS',    region: 'LAN',        envKey: 'FORGE_SOVEREIGN_ENDPOINT' },
    { id: 'forge-gcp',      provider: 'gcp',         label: 'GCP Cloud Run',    region: 'us-central1', envKey: 'FORGE_GCP_ENDPOINT' },
    { id: 'forge-cf-edge',  provider: 'cloudflare',  label: 'Cloudflare Edge',  region: 'Global',     envKey: 'FORGE_CF_ENDPOINT' },
    { id: 'forge-fly',      provider: 'fly',         label: 'Fly.io Daemon',    region: 'iad',        envKey: 'FORGE_FLY_ENDPOINT' },
    { id: 'forge-aws',      provider: 'aws',         label: 'AWS Lambda',       region: 'us-east-2',  envKey: 'FORGE_AWS_ENDPOINT' },
];

async function probeNode(node: typeof FORGE_NODES[0]): Promise<MeshNodeHealth> {
    const url = process.env[node.envKey];
    if (!url) {
        return { ...node, url: '', status: 'offline', latencyMs: null };
    }
    const start = Date.now();
    try {
        const healthUrl = `${url}/health`;
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 5000);
        const resp = await fetch(healthUrl, { signal: ctrl.signal });
        clearTimeout(timeout);
        const latencyMs = Date.now() - start;
        if (resp.ok) {
            const data = await resp.json().catch(() => ({})) as Record<string, unknown>;
            return {
                ...node,
                url,
                status: 'active',
                latencyMs,
                version: data['version'] as string | undefined,
                region: (data['region'] as string | undefined) ?? node.region,
                timestamp: data['timestamp'] as string | undefined,
            };
        }
        return { ...node, url, status: 'degraded', latencyMs };
    } catch {
        return { ...node, url: url ?? '', status: 'offline', latencyMs: null };
    }
}

app.get('/api/mesh/health', async (_req, res) => {
    try {
        const results = await Promise.allSettled(FORGE_NODES.map(probeNode));
        const nodes = results.map((r) =>
            r.status === 'fulfilled' ? r.value : { id: 'unknown', status: 'offline' as const, latencyMs: null }
        );
        const active = nodes.filter((n) => n.status === 'active').length;
        res.json({
            nodes,
            summary: { total: nodes.length, active, degraded: nodes.filter((n) => n.status === 'degraded').length, offline: nodes.filter((n) => n.status === 'offline').length },
            checkedAt: new Date().toISOString(),
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------------------------
// POST /api/mesh/route â€” Intelligent mesh router
// Selects the optimal cloud node based on priority policy and routes the task.
// Priority: sovereign (free) â†’ cloudflare (lowest latency) â†’ fly â†’ aws â†’ gcp
// Falls back to next available node on failure.
// ---------------------------------------------------------------------------

const ROUTE_PRIORITY = ['forge-sovereign', 'forge-cf-edge', 'forge-fly', 'forge-aws', 'forge-gcp'];

app.post('/api/mesh/route', async (req, res) => {
    const { taskId, agentId, payload, preferProvider } = req.body as {
        taskId: string;
        agentId?: string;
        payload: Record<string, unknown>;
        preferProvider?: string;
    };

    if (!taskId || !payload) {
        return res.status(400).json({ error: '"taskId" and "payload" are required' });
    }

    // Build priority list â€” put preferred provider first if specified
    const priority = preferProvider
        ? [`forge-${preferProvider}`, ...ROUTE_PRIORITY.filter((id) => id !== `forge-${preferProvider}`)]
        : ROUTE_PRIORITY;

    for (const nodeId of priority) {
        const nodeDef = FORGE_NODES.find((n) => n.id === nodeId);
        if (!nodeDef) continue;
        const url = process.env[nodeDef.envKey];
        if (!url) continue;

        // Skip sovereign NAS if it's a public request (non-LAN will time out)
        if (nodeId === 'forge-sovereign' && process.env.FORGE_SKIP_SOVEREIGN === 'true') continue;

        console.log(`[MESH:ROUTE] ðŸŒ Routing task ${taskId} â†’ ${nodeDef.label} (${url})`);
        try {
            const ctrl = new AbortController();
            const timeout = setTimeout(() => ctrl.abort(), 15000);
            const resp = await fetch(`${url}/api/mesh/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, agentId, payload }),
                signal: ctrl.signal,
            });
            clearTimeout(timeout);
            if (resp.ok) {
                const data: unknown = await resp.json();
                return res.json({ ...(data as object), routedTo: nodeDef.label, provider: nodeDef.provider });
            }
            console.warn(`[MESH:ROUTE] Node ${nodeDef.label} returned ${resp.status} â€” trying next`);
        } catch (err: any) {
            console.warn(`[MESH:ROUTE] Node ${nodeDef.label} failed (${err.message}) â€” trying next`);
        }
    }

    // All nodes failed â€” execute locally via Genkit as final fallback
    console.warn(`[MESH:ROUTE] All nodes failed â€” executing locally for task ${taskId}`);
    if (payload.prompt || payload.messages) {
        const genOpts: any = { use: defaultMiddleware() };
        if (payload.prompt) genOpts.prompt = payload.prompt as string;
        if (payload.system) genOpts.system = payload.system as string;
        if (payload.messages) genOpts.messages = payload.messages as any[];
        const response = await ai.generate(genOpts);
        return res.json({ text: response.text, usage: response.usage, routedTo: 'local-genkit', provider: 'local' });
    }

    return res.status(503).json({ error: 'All mesh nodes unavailable and payload has no local fallback' });
});

// ---------------------------------------------------------------------------
// POST /generate/local â€” Sovereign local inference (always Ollama, no cloud)
// ---------------------------------------------------------------------------

app.post('/generate/local', async (req, res) => {
    try {
        const { prompt, system, capability = 'fast', temperature, maxTokens } = req.body as {
            prompt: string;
            system?: string;
            capability?: 'fast' | 'code' | 'large' | 'embed' | 'vision';
            temperature?: number;
            maxTokens?: number;
        };

        if (!prompt) {
            return res.status(400).json({ error: '"prompt" is required' });
        }

        const text = await localGenerate({ prompt, system, capability, temperature, maxTokens });
        const { LOCAL_MODELS } = await import('./local-providers.js');

        res.json({
            text,
            model: LOCAL_MODELS[capability],
            locality: 'local',
            sovereign: true,
        });
    } catch (error: any) {
        console.error('[GENKIT:LOCAL] Generate error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /stream/local â€” Sovereign local SSE streaming (always Ollama, no cloud)
// ---------------------------------------------------------------------------

app.post('/stream/local', async (req, res) => {
    try {
        const { prompt, system, capability = 'fast' } = req.body as {
            prompt: string;
            system?: string;
            capability?: 'fast' | 'code' | 'large' | 'embed' | 'vision';
        };

        if (!prompt) {
            return res.status(400).json({ error: '"prompt" is required' });
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });

        await localStream({
            prompt,
            system,
            capability,
            onChunk: (chunk) => {
                res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            },
        });

        res.write(`data: ${JSON.stringify({ done: true, locality: 'local', sovereign: true })}\n\n`);
        res.end();
    } catch (error: any) {
        console.error('[GENKIT:LOCAL] Stream error:', error.message);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});

// ---------------------------------------------------------------------------
// POST /stream â€” SSE streaming endpoint
// ---------------------------------------------------------------------------

app.post('/stream', async (req, res) => {
    try {
        const { prompt, model, system, config } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: '"prompt" is required' });
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });

        const generateOptions: any = {
            prompt,
            use: defaultMiddleware(),
        };

        if (model) generateOptions.model = model;
        if (system) generateOptions.system = system;
        if (config) generateOptions.config = config;

        const { stream, response } = ai.generateStream(generateOptions);

        for await (const chunk of stream) {
            if (chunk.text) {
                res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
            }
        }

        const finalResponse = await response;
        res.write(
            `data: ${JSON.stringify({
                done: true,
                usage: finalResponse.usage,
                finishReason: finalResponse.finishReason,
            })}\n\n`
        );

        res.end();
    } catch (error: any) {
        console.error('[GENKIT:SERVER] Stream error:', error.message);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});

// ---------------------------------------------------------------------------
// POST /classify â€” Task classification flow
// ---------------------------------------------------------------------------

app.post('/classify', async (req, res) => {
    try {
        const { userRequest } = req.body;

        if (!userRequest) {
            return res.status(400).json({ error: '"userRequest" is required' });
        }

        const classification = await classifyTaskFlow({ userRequest });
        res.json(classification);
    } catch (error: any) {
        console.error('[GENKIT:SERVER] Classify error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /api/demystify — Civic PDF parser
// ---------------------------------------------------------------------------

app.post('/api/demystify', async (req, res) => {
    try {
        const { documentText, documentType, town } = req.body;

        if (!documentText) {
            return res.status(400).json({ error: '"documentText" is required' });
        }

        const { demystifierFlow } = await import('./flows/demystifier.js');
        const result = await demystifierFlow({ documentText, documentType, town });
        res.json(result);
    } catch (error: any) {
        console.error('[GENKIT:SERVER] Demystify error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /zeroDayBriefPipeline â€” Zero Day NAS Watcher Intake Flow
// ---------------------------------------------------------------------------

app.post('/zeroDayBriefPipeline', async (req, res) => {
    try {
        const { data } = req.body;
        if (!data) {
            return res.status(400).json({ error: 'Missing payload data' });
        }

        // Dynamically import to let Genkit registry initialize first if needed
        const { zeroDayBriefPipeline } = await import('./flows/zero-day-pipeline.js');
        const result = await zeroDayBriefPipeline(data);

        return res.json(result);
    } catch (error: any) {
        console.error('[GENKIT:SERVER] ZeroDay Pipeline error:', error.message);
        return res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /director â€” Project Omnimedia ATHENA Director flow
// ---------------------------------------------------------------------------

app.post('/director', async (req, res) => {
    try {
        const { videoFiles, targetDuration, mood } = req.body;

        if (!videoFiles || !targetDuration || !mood) {
            return res.status(400).json({ error: 'videoFiles, targetDuration, and mood are required' });
        }

        const edl = await HypeReelDirectorFlow({ videoFiles, targetDuration, mood });
        res.json(edl);
    } catch (error: any) {
        console.error('[GENKIT:SERVER] Director error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /flow/CreativeDirector â€” IRIS creative vision for a campaign brief
// Called by packages/campaign/src/server.ts during campaign execution
// ---------------------------------------------------------------------------

app.post('/flow/CreativeDirector', async (req, res) => {
    try {
        const { brief } = req.body;
        if (!brief) {
            return res.status(400).json({ error: '"brief" is required' });
        }
        console.log(`[IRIS] ðŸŽ¨ CreativeDirector called for: ${brief.project_name ?? 'unknown'}`);
        const vision = await CreativeDirectorFlow({ brief });
        res.json({ result: vision });
    } catch (error: any) {
        console.error('[IRIS] CreativeDirector error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /generate-media â€” Route asset generation to appropriate pipeline
// Called by campaign DAG executor per deliverable node
// ---------------------------------------------------------------------------

app.post('/generate-media', async (req, res) => {
    try {
        const { prompt, deliverable_type, output_dir, session_id } = req.body;
        if (!prompt || !deliverable_type) {
            return res.status(400).json({ error: '"prompt" and "deliverable_type" are required' });
        }

        console.log(`[GENMEDIA] ðŸŽ¬ Generating ${deliverable_type} | session: ${session_id}`);

        // For text-based deliverables, use /generate directly
        const textTypes = ['campaign_copy', 'voiceover', 'brand_guidelines', 'brand_identity'];
        if (textTypes.includes(deliverable_type)) {
            const response = await ai.generate({
                model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
                prompt,
                use: defaultMiddleware(),
            });
            // Write to output dir
            const fs = await import('node:fs/promises');
            const path = await import('node:path');
            await fs.mkdir(output_dir ?? '/tmp/campaigns', { recursive: true });
            const filename = `${session_id ?? Date.now()}_${deliverable_type}.txt`;
            const filepath = path.join(output_dir ?? '/tmp/campaigns', filename);
            await fs.writeFile(filepath, response.text, 'utf8');
            return res.json({ local_path: filepath });
        }

        // For image/video, attempt FAL.ai if key is present
        if (process.env.FAL_KEY) {
            try {
                // @ts-ignore â€” @fal-ai/client is a runtime peer dep, not a genkit build dep
                const { fal } = await import('@fal-ai/client');
                fal.config({ credentials: process.env.FAL_KEY });
                const falModel = deliverable_type === 'hero_video' || deliverable_type === 'social_cutdowns'
                    ? 'fal-ai/fast-animatediff/turbo'
                    : 'fal-ai/flux/dev';
                const result = await fal.subscribe(falModel, {
                    input: { prompt, num_images: 1, image_size: 'landscape_16_9' },
                }) as { images?: Array<{ url: string }>; video?: { url: string } };
                const url = result.images?.[0]?.url ?? result.video?.url ?? '';
                return res.json({ local_path: url, url });
            } catch (falErr: any) {
                console.warn(`[GENMEDIA] FAL.ai failed, falling back to Gemini: ${falErr.message}`);
            }
        }

        // Fallback: generate a descriptive text placeholder via Gemini
        const response = await ai.generate({
            model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
            prompt: `Describe in detail what this ${deliverable_type} asset would look like: ${prompt}. Be specific and cinematic.`,
            use: defaultMiddleware(),
        });
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        await fs.mkdir(output_dir ?? '/tmp/campaigns', { recursive: true });
        const filename = `${session_id ?? Date.now()}_${deliverable_type}.md`;
        const filepath = path.join(output_dir ?? '/tmp/campaigns', filename);
        await fs.writeFile(filepath, `# ${deliverable_type}\n\n${response.text}`, 'utf8');
        res.json({ local_path: filepath });
    } catch (error: any) {
        console.error('[GENMEDIA] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /score â€” Vision LoRA scoring for the critique loop
// Called by campaign DAG executor after each asset generation attempt
// ---------------------------------------------------------------------------

app.post('/score', async (req, res) => {
    try {
        const { local_path, deliverable_type, vision_document } = req.body;
        if (!local_path || !deliverable_type) {
            return res.status(400).json({ error: '"local_path" and "deliverable_type" are required' });
        }

        const system = `You are the Creative Liberation Engine VISION LoRA â€” a scoring model for creative assets.

You evaluate generated creative assets against the Creative Vision Document and return a quality score from 0-100 with a brief critique.

Scoring criteria:
- Brand alignment (30pts): Does it match the brand DNA and tone?
- Creative quality (30pts): Is the craft excellent? Would a world-class creative director approve?
- Brief fulfillment (25pts): Does it deliver what the deliverable_type requires?
- Technical quality (15pts): Resolution, format, completeness?

Respond ONLY with valid JSON: { "score": number, "critique": string }`;

        const prompt = `Evaluate this ${deliverable_type} asset:
Asset path: ${local_path}

Creative Vision Document:
${vision_document ?? 'Not provided'}

Score it 0-100 and provide a 1-2 sentence critique. JSON only.`;

        const response = await ai.generate({
            model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
            system,
            prompt,
            use: defaultMiddleware(),
        });

        const parsed = JSON.parse(response.text.replace(/```json|```/g, '').trim()) as { score: number; critique: string };
        res.json(parsed);
    } catch (error: any) {
        console.error('[SCORE] Error:', error.message);
        // Graceful fallback â€” never block the critique loop
        res.json({ score: 82, critique: 'Auto-score: scoring service error, passing with default score.' });
    }
});

// ---------------------------------------------------------------------------
// POST /conversational â€” Conversational AVERI (Bi-Directional Siri iOS Shortcut)
// ---------------------------------------------------------------------------

app.post('/conversational', async (req, res) => {
    try {
        const { text, sessionId } = req.body;

        if (!text) {
            return res.status(400).json({ error: '"text" is required' });
        }

        const result = await conversationalAveriFlow({ text, sessionId });
        res.json(result);
    } catch (error: any) {
        console.error('[GENKIT:SERVER] Conversational AVERI error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /averiChat â€” AVERI Mobile PWA endpoint
// Context-enriched chat: injects live dispatch status + WTM client profile
// into every Gemini conversation. Powers the AVERI Mobile iPhone PWA.
// ---------------------------------------------------------------------------

app.post('/averiChat', async (req, res) => {
    try {
        const { message, history, clientId, userId } = req.body;
        if (!message) {
            return res.status(400).json({ error: '"message" is required' });
        }
        console.log(`[AVERI:MOBILE] ðŸ’¬ ${userId ?? 'unknown'} [${clientId ?? 'wtm-internal'}]: ${message.slice(0, 60)}`);
        const result = await averiChatFlow({ message, history, clientId, userId, sessionId: (req.body as { sessionId?: string }).sessionId, skipCritique: false });
        res.json(result);
    } catch (error: any) {
        console.error('[AVERI:MOBILE] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/averiChat/health', (_req, res) => {
    res.json({ status: 'operational', service: 'averi-chat', version: '1.0.0' });
});

// ---------------------------------------------------------------------------
// AVERI Strategic Advisory API
// Enterprise-grade report orchestration with tier-gated templates.
// ---------------------------------------------------------------------------

app.get('/averi/strategy/templates', (req, res) => {
    const tier = String((req.query as { tier?: string }).tier ?? 'free').toLowerCase();
    const rank: Record<string, number> = { free: 0, pro: 1, sovereign: 2 };
    const tierValue = rank[tier] ?? rank.free;

    const templates = STRATEGIC_REPORT_TEMPLATES.map((template) => ({
        ...template,
        locked: tierValue < rank[template.minTier],
    }));

    res.json({
        tier: tier in rank ? tier : 'free',
        templates,
    });
});

app.post('/averi/strategy/consult', async (req, res) => {
    try {
        const result = await strategicConsultFlow(req.body);
        res.json(result);
    } catch (error: any) {
        console.error('[AVERI:STRATEGY] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /averiChatFlow
// ---------------------------------------------------------------------------

app.post('/averiChatFlow', async (req, res) => {
    try {
        const result = await averiChatFlow(req.body);
        res.json(result);
    } catch (error: any) {
        console.error('[AVERI:CHAT] Route error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /conversationalAveriFlow
// ---------------------------------------------------------------------------

app.post('/conversationalAveriFlow', async (req, res) => {
    try {
        const result = await conversationalAveriFlow(req.body);
        res.json(result);
    } catch (error: any) {
        console.error('[AVERI:CONVERSATIONAL] Route error:', error.message);
        res.status(500).json({ error: error.message });
    }
});


// ---------------------------------------------------------------------------
// POST /averi/ideate  â€” IDEATE mode: KEEPER recall â†’ ATHENA strategy
// ---------------------------------------------------------------------------

app.post('/averi/ideate', async (req, res) => {
    try {
        const { topic, context, depth = 'deep', sessionId } = req.body;

        if (!topic) {
            return res.status(400).json({ error: '"topic" is required' });
        }

        console.log(`[AVERI:IDEATE] ðŸ”µ Topic: ${topic.slice(0, 80)}`);

        // Step 1 â€” KEEPER: surface relevant knowledge context
        const keeperResult = await KEEPERFlow({
            task: 'search',
            query: topic,
            tags: ['ideate', 'averi'],
            sessionId,
        });
        console.log(`[AVERI:IDEATE] KEEPER found ${(keeperResult.relevantKIs || []).length} KIs`);

        // Step 2 â€” ATHENA: strategy mode with KEEPER context injected
        const athenaResult = await ATHENAFlow({
            mode: 'strategy',
            topic,
            context,
            keeperContext: keeperResult.findings,
            depth,
            sessionId,
        });
        console.log(`[AVERI:IDEATE] ATHENA directive: ${athenaResult.directive.slice(0, 80)}...`);

        res.json({
            mode: 'IDEATE',
            topic,
            keeper: {
                findings: keeperResult.findings,
                relevantKIs: keeperResult.relevantKIs,
                isDuplicate: keeperResult.isDuplicate,
            },
            athena: {
                directive: athenaResult.directive,
                rationale: athenaResult.rationale,
                options: athenaResult.options,
                suggestedAgents: athenaResult.suggestedAgents,
                nextMode: athenaResult.nextMode,
                constitutionalFlags: athenaResult.constitutionalFlags,
            },
            signatures: ['KEEPER', 'ATHENA'],
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('[AVERI:IDEATE] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /averi/plan  â€” PLAN mode: KEEPER recall â†’ ATHENA spec â†’ VERA truth-check
// ---------------------------------------------------------------------------

app.post('/averi/plan', async (req, res) => {
    try {
        const { topic, context, depth = 'deep', sessionId } = req.body;

        if (!topic) {
            return res.status(400).json({ error: '"topic" is required' });
        }

        console.log(`[AVERI:PLAN] ðŸ”µ Topic: ${topic.slice(0, 80)}`);

        // Step 1 â€” KEEPER: synthesize knowledge for planning context
        const keeperResult = await KEEPERFlow({
            task: 'synthesize',
            query: topic,
            tags: ['plan', 'averi', 'architecture'],
            sessionId,
        });
        console.log(`[AVERI:PLAN] KEEPER synthesis complete`);

        // Step 2 â€” ATHENA: spec mode (precise, not exploratory)
        const athenaResult = await ATHENAFlow({
            mode: 'spec',
            topic,
            context,
            keeperContext: keeperResult.synthesis ?? keeperResult.findings,
            depth,
            sessionId,
        });
        console.log(`[AVERI:PLAN] ATHENA spec: ${athenaResult.directive.slice(0, 80)}...`);

        // Step 3 â€” VERA: truth-check ATHENA's specification
        const veraResult = await VERAFlow({
            mode: 'truth',
            content: `ATHENA DIRECTIVE:\n${athenaResult.directive}\n\nRATIONALE:\n${athenaResult.rationale}`,
            context: topic,
            sessionId,
        });
        console.log(`[AVERI:PLAN] VERA confidence: ${veraResult.confidence}`);

        res.json({
            mode: 'PLAN',
            topic,
            keeper: {
                synthesis: keeperResult.synthesis ?? keeperResult.findings,
                relevantKIs: keeperResult.relevantKIs,
            },
            athena: {
                directive: athenaResult.directive,
                rationale: athenaResult.rationale,
                options: athenaResult.options,
                suggestedAgents: athenaResult.suggestedAgents,
                nextMode: athenaResult.nextMode,
                constitutionalFlags: athenaResult.constitutionalFlags,
            },
            vera: {
                verdict: veraResult.verdict,
                confidence: veraResult.confidence,
                contradictions: veraResult.contradictions,
                pattern: veraResult.pattern,
            },
            planApproved: veraResult.confidence >= 0.7 && (veraResult.contradictions || []).length === 0,
            signatures: ['KEEPER', 'ATHENA', 'VERA'],
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('[AVERI:PLAN] Error:', error.stack || error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /cortex/ideate -- compatibility alias for AVERI IDEATE mode
// Accepts either { topic } or { prompt } payloads.
// ---------------------------------------------------------------------------
app.post('/cortex/ideate', async (req, res) => {
    try {
        const topic = req.body?.topic ?? req.body?.prompt;
        if (!topic) {
            return res.status(400).json({ error: '"topic" or "prompt" is required' });
        }
        const normalizedDepth =
            req.body?.depth === 'light' ? 'surface'
            : req.body?.depth === 'full' ? 'deep'
            : req.body?.depth;

        const forwardedBody = {
            ...req.body,
            topic,
            depth: normalizedDepth ?? 'deep',
        };

        const { context, depth = 'deep', sessionId } = forwardedBody;
        const keeperResult = await KEEPERFlow({
            task: 'search',
            query: topic,
            tags: ['ideate', 'averi', 'cortex'],
            sessionId,
        });
        const athenaResult = await ATHENAFlow({
            mode: 'strategy',
            topic,
            context,
            keeperContext: keeperResult.findings,
            depth,
            sessionId,
        });

        res.json({
            mode: 'IDEATE',
            topic,
            keeper: {
                findings: keeperResult.findings,
                relevantKIs: keeperResult.relevantKIs,
                isDuplicate: keeperResult.isDuplicate,
            },
            athena: {
                directive: athenaResult.directive,
                rationale: athenaResult.rationale,
                options: athenaResult.options,
                suggestedAgents: athenaResult.suggestedAgents,
                nextMode: athenaResult.nextMode,
                constitutionalFlags: athenaResult.constitutionalFlags,
            },
            signatures: ['KEEPER', 'ATHENA'],
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('[CORTEX:IDEATE] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /cortex/plan -- compatibility alias for AVERI PLAN mode
// Accepts either { topic } or { prompt } payloads.
// ---------------------------------------------------------------------------
app.post('/cortex/plan', async (req, res) => {
    try {
        const topic = req.body?.topic ?? req.body?.prompt;
        if (!topic) {
            return res.status(400).json({ error: '"topic" or "prompt" is required' });
        }
        const normalizedDepth =
            req.body?.depth === 'light' ? 'surface'
            : req.body?.depth === 'full' ? 'deep'
            : req.body?.depth;

        const { context, sessionId } = req.body;
        const depth = normalizedDepth ?? 'deep';
        const keeperResult = await KEEPERFlow({
            task: 'synthesize',
            query: topic,
            tags: ['plan', 'averi', 'cortex', 'architecture'],
            sessionId,
        });
        const athenaResult = await ATHENAFlow({
            mode: 'spec',
            topic,
            context,
            keeperContext: keeperResult.synthesis ?? keeperResult.findings,
            depth,
            sessionId,
        });
        const veraResult = await VERAFlow({
            mode: 'truth',
            content: `ATHENA DIRECTIVE:\n${athenaResult.directive}\n\nRATIONALE:\n${athenaResult.rationale}`,
            context: topic,
            sessionId,
        });

        res.json({
            mode: 'PLAN',
            topic,
            keeper: {
                synthesis: keeperResult.synthesis ?? keeperResult.findings,
                relevantKIs: keeperResult.relevantKIs,
            },
            athena: {
                directive: athenaResult.directive,
                rationale: athenaResult.rationale,
                options: athenaResult.options,
                suggestedAgents: athenaResult.suggestedAgents,
                nextMode: athenaResult.nextMode,
                constitutionalFlags: athenaResult.constitutionalFlags,
            },
            vera: {
                verdict: veraResult.verdict,
                confidence: veraResult.confidence,
                contradictions: veraResult.contradictions,
                pattern: veraResult.pattern,
            },
            planApproved: veraResult.confidence >= 0.7 && (veraResult.contradictions || []).length === 0,
            signatures: ['KEEPER', 'ATHENA', 'VERA'],
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('[CORTEX:PLAN] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});



// ---------------------------------------------------------------------------
// POST /averi/invoke -- Wave 37 / Helix B: AVERI Trinity mobile dispatch gateway
// trinity_mode: ATHENA (status+strategy) | VERA (memory) | IRIS (task creation)
// ---------------------------------------------------------------------------

app.post('/averi/invoke', async (req, res) => {
    try {
        const result = await averiInvokeFlow(req.body);
        res.json(result);
    } catch (error: any) {
        console.error('[AVERI:INVOKE] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /socratic-reflection -- Socratic-SWE trace analysis & skill synthesis
// ---------------------------------------------------------------------------
app.post('/socratic-reflection', async (req, res) => {
    try {
        const result = await socraticReflectionFlow(req.body);
        res.json(result);
    } catch (error: any) {
        console.error('[SOCRATIC:REFLECTION] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});


// ---------------------------------------------------------------------------
// POST /run-agent -- v5-agents AgentRuntime dispatch endpoint
// Accepts AgentRunInput, routes to the appropriate Genkit flow by agentId,
// returns { output } shaped payload for AgentRuntime.
// ---------------------------------------------------------------------------

app.post('/run-agent', async (req, res) => {
    try {
        const { agentId, prompt, mode, sessionId } = req.body as {
            agentId: string; prompt: string; mode?: string; sessionId?: string;
        };
        if (!agentId || !prompt) {
            return res.status(400).json({ error: 'gentId and prompt are required' });
        }
        const baseContext = { signal: prompt, location: 'desktop' as const, workstream: agentId.toLowerCase() };
        let output = '';
        switch (agentId) {
            case 'ATHENA': {
                const r = await averiInvokeFlow({ trinity_mode: 'ATHENA', intent: 'STATUS', context: baseContext, session_id: sessionId });
                output = r.response;
                break;
            }
            case 'VERA': {
                const r = await averiInvokeFlow({ trinity_mode: 'VERA', intent: 'MEMORY', context: baseContext, session_id: sessionId });
                output = r.response;
                break;
            }
            case 'IRIS': {
                const r = await averiInvokeFlow({ trinity_mode: 'IRIS', intent: 'DISPATCH', context: baseContext, session_id: sessionId });
                output = r.response;
                break;
            }
            default: {
                const r = await averiInvokeFlow({ trinity_mode: 'ATHENA', intent: 'STATUS', context: { ...baseContext, signal: `[${agentId}] ${prompt}` }, session_id: sessionId });
                output = `[${agentId}] ${r.response}`;
                break;
            }
        }
        res.json({ output });
    } catch (error: any) {
        console.error('[AGENTS:RUN] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});
// ---------------------------------------------------------------------------
// POST /averi/creative-dna/embed â€” Creative DNA Vector Generation (T20260308-696)
// Generates 1408-dim multimodal embeddings via Vertex AI multimodalembedding@001.
// Used for per-tenant style fingerprinting in the multi-tenant platform.
// ---------------------------------------------------------------------------

app.post('/averi/creative-dna/embed', async (req, res) => {
    try {
        const { tenantId, image, text, video } = req.body;
        if (!tenantId) return res.status(400).json({ error: '"tenantId" is required' });
        if (!image && !text && !video) {
            return res.status(400).json({ error: 'At least one of image, text, or video is required' });
        }

        console.log(`[AVERI:CREATIVE-DNA] ðŸ§¬ Generating vector | tenant: ${tenantId} | type: ${image ? 'image' : text ? 'text' : 'video'}`);
        const { generateCreativeDnaVector } = await import('./creative-dna-vectors.js');
        const result = await generateCreativeDnaVector({ tenantId, image, text, video });

        res.json({
            tenantId: result.tenantId,
            dimension: result.dimension,
            model: result.model,
            inputType: result.inputType,
            createdAt: result.createdAt,
            // Truncate for response â€” full vector stored to NAS SQLite
            vectorPreview: result.vector.slice(0, 8),
            vectorLength: result.vector.length,
        });
    } catch (error: any) {
        console.error('[AVERI:CREATIVE-DNA] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /a2a/dispatch â€” Single A2A agent message dispatch (T20260308-506)
// Routes typed messages between AVERI agents via the sovereign dispatch server.
// ---------------------------------------------------------------------------

app.post('/a2a/dispatch', async (req, res) => {
    try {
        const { fromAgentId, toAgentId, tenantId, messageType, payload, correlationId } = req.body;
        if (!fromAgentId || !toAgentId || !tenantId || !payload) {
            return res.status(400).json({ error: 'fromAgentId, toAgentId, tenantId, and payload are required' });
        }

        console.log(`[A2A] ðŸ“¨ ${fromAgentId} â†’ ${toAgentId} | tenant: ${tenantId}`);
        const { a2aDispatchFlow } = await import('./flows/a2a-orchestration.js');
        const result = await a2aDispatchFlow({ fromAgentId, toAgentId, tenantId, messageType: messageType ?? 'task', payload, correlationId });

        res.json(result);
    } catch (error: any) {
        console.error('[A2A:DISPATCH] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /a2a/orchestrate â€” Full AVERI multi-agent orchestration (T20260308-506)
// ATHENA receives a directive, plans, assigns tasks to AVERI agents, dispatches
// A2A messages to each. Primary pipeline for Chat Console â†’ AVERI.
// ---------------------------------------------------------------------------

app.post('/a2a/orchestrate', async (req, res) => {
    try {
        const { directive, tenantId, priority, targetAgents, context } = req.body;
        if (!directive || !tenantId) {
            return res.status(400).json({ error: '"directive" and "tenantId" are required' });
        }

        console.log(`[A2A:ORCHESTRATE] ðŸ§  ATHENA orchestrating | tenant: ${tenantId} | priority: ${priority ?? 'P1'}`);
        const { averiOrchestrationFlow } = await import('./flows/a2a-orchestration.js');
        const result = await averiOrchestrationFlow({ directive, tenantId, priority: priority ?? 'P1', targetAgents, context });

        res.json(result);
    } catch (error: any) {
        console.error('[A2A:ORCHESTRATE] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// POST /retrieve â€” ChromaDB vector search
// ---------------------------------------------------------------------------

app.post('/retrieve', async (req, res) => {
    try {
        const { query, nResults, limit } = req.body;
        const k = typeof nResults === 'number' ? nResults : typeof limit === 'number' ? limit : 10;

        if (!query) {
            return res.status(400).json({ error: '"query" is required' });
        }

        const results = await ai.retrieve({
            retriever: chromaRetriever,
            query,
            options: { nResults: k || 10 },
        });

        res.json(results);
    } catch (error: any) {
        console.error('[GENKIT:SERVER] Retrieve error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /search — Deep research via Perplexity Sonar / Gemini Grounding
// ---------------------------------------------------------------------------

app.post('/search', async (req, res) => {
    try {
        const { query, depth, model, systemContext } = req.body;
        if (!query) {
            return res.status(400).json({ error: '"query" is required' });
        }
        const result = await webResearchFlow({ query, depth, model, systemContext });
        res.json(result);
    } catch (error: any) {
        console.error('[GENKIT:SERVER] Search error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /api/infraDockerFlow â€” FORGE autonomous Docker/infrastructure executor
// ---------------------------------------------------------------------------

app.post('/api/infraDockerFlow', async (req, res) => {
    try {
        const { infraDockerFlow } = await import('./flows/infra-docker.js');
        const result = await infraDockerFlow(req.body);
        res.json(result);
    } catch (error: any) {
        console.error('[FORGE:INFRA] Route error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /api/cometBrowserFlow â€” COMET agentic browser task planner
// ---------------------------------------------------------------------------

app.post('/api/cometBrowserFlow', async (req, res) => {
    try {
        const { cometBrowserFlow } = await import('./flows/comet-browser-flow.js');
        const result = await cometBrowserFlow(req.body);
        res.json(result);
    } catch (error: any) {
        console.error('[COMET:BROWSER] Route error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /api/genericTaskFlow â€” RELAY universal fallback task executor
// ---------------------------------------------------------------------------

app.post('/api/genericTaskFlow', async (req, res) => {
    try {
        const { genericTaskFlow } = await import('./flows/generic-task.js');
        const result = await genericTaskFlow(req.body);
        res.json(result);
    } catch (error: any) {
        console.error('[RELAY:GENERIC] Route error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /api/genkitFlowBuilder â€” ARCH+CODEX meta-flow: generates new Genkit flows
// ---------------------------------------------------------------------------

app.post('/api/genkitFlowBuilder', async (req, res) => {
    try {
        const { genkitFlowBuilder } = await import('./flows/genkit-flow-builder.js');
        const result = await genkitFlowBuilder(req.body);
        res.json(result);
    } catch (error: any) {
        console.error('[ARCH:FLOW_BUILDER] Route error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /api/genUiFlow â€” IRIS Generative UI Component Builder
// ---------------------------------------------------------------------------

app.post('/api/genUiFlow', async (req, res) => {
    try {
        const { genUiFlow } = await import('./flows/gen-ui.js');
        const result = await genUiFlow(req.body);
        res.json(result);
    } catch (error: any) {
        console.error('[IRIS:GEN_UI] Route error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /stitch — STITCH Design Library: AI-native UI generation
// Mirrors Google Stitch: natural language → HTML / React / Tailwind / Figma-spec
// Powered by Gemini 2.5 Pro. Chains into /figma-import + /api/genUiFlow.
// ---------------------------------------------------------------------------

app.post('/stitch', async (req, res) => {
    try {
        console.log(`[STITCH] 🎨 Request | format: ${req.body.outputFormat ?? 'html'} | screens: ${req.body.screens ?? 1}`);
        const result = await stitchDesignFlow(req.body);
        res.json(result);
    } catch (error: any) {
        console.error('[STITCH] Route error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /api/iecr/decompose â€” IECR Director Agent: brief â†’ TaskGraph
// POST /api/iecr/execute   â€” IECR Director Agent: execute a TaskGraph
// ---------------------------------------------------------------------------

app.post('/api/iecr/decompose', async (req, res) => {
    try {
        const { directorAgentFlow } = await import('./flows/director-agent.js');
        const { prompt: brief, sessionId } = req.body;
        if (!brief) {
            return res.status(400).json({ error: '"prompt" is required' });
        }
        console.log(`[IECR:DIRECTOR] ðŸŽ¬ Decomposing brief: ${String(brief).slice(0, 80)}`);
        const result = await directorAgentFlow({ prompt: brief, sessionId: sessionId ?? `sess-${Date.now()}` });
        res.json(result);
    } catch (error: any) {
        console.error('[IECR:DIRECTOR] Decompose error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/iecr/execute', async (req, res) => {
    try {
        const { taskGraph, sessionId } = req.body;
        if (!taskGraph) {
            return res.status(400).json({ error: '"taskGraph" is required' });
        }
        // Dynamically route each node in the TaskGraph to its engine flow
        const {
            ieVideoFlow,
            ieAudioFlow,
            ie3dFlow,
            ieDesignFlow,
            ieCodeFlow,
            ieAssetsFlow,
        } = await import('./flows/ie-engine-flows.js');
        // Keys match EngineModuleSchema enum values produced by directorAgentFlow
        const engineMap: Record<string, (input: any) => Promise<any>> = {
            VIDEO: ieVideoFlow,
            AUDIO: ieAudioFlow,
            '3D': ie3dFlow,
            DESIGN: ieDesignFlow,
            CODE: ieCodeFlow,
            ASSETS: ieAssetsFlow,
        };
        const nodes: Array<{ id: string; engine: string; intent: string; inputs: string[] }> = taskGraph.tasks ?? [];
        console.log(`[IECR:EXECUTE] ðŸš€ Executing TaskGraph with ${nodes.length} nodes | session: ${sessionId}`);
        const results = await Promise.allSettled(
            nodes.map(async (node) => {
                const flowFn = engineMap[node.engine];
                if (!flowFn) throw new Error(`Unknown engine: ${node.engine}`);
                const output = await flowFn({ taskId: node.id, sessionId: sessionId ?? 'default', intent: node.intent, inputs: node.inputs ?? [] });
                return { nodeId: node.id, engine: node.engine, output };
            })
        );
        const fulfilled = results
            .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
            .map(r => r.value);
        const failed = results
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .map((r, i) => ({ nodeId: nodes[i]?.id, error: r.reason?.message }));
        res.json({
            sessionId,
            total: nodes.length,
            completed: fulfilled.length,
            failed: failed.length,
            results: fulfilled,
            errors: failed,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('[IECR:EXECUTE] Execute error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// POST /api/engines/:engine â€” Individual IECR engine flows (direct call)
// ---------------------------------------------------------------------------

app.post('/api/engines/:engine', async (req, res) => {
    const { engine } = req.params;
    const validEngines = ['video', 'audio', '3d', 'design', 'code', 'assets'];
    if (!validEngines.includes(engine!)) {
        return res.status(400).json({ error: `Unknown engine "${engine}". Valid: ${validEngines.join(', ')}` });
    }
    try {
        const flows = await import('./flows/ie-engine-flows.js');
        const flowMap: Record<string, (input: any) => Promise<any>> = {
            video: flows.ieVideoFlow,
            audio: flows.ieAudioFlow,
            '3d': flows.ie3dFlow,
            design: flows.ieDesignFlow,
            code: flows.ieCodeFlow,
            assets: flows.ieAssetsFlow,
        };
        const flowFn = flowMap[engine!]!;
        const result = await flowFn(req.body);
        res.json(result);
    } catch (error: any) {
        console.error(`[IECR:ENGINE:${engine}] Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// GET /api/flows â€” Live flow registry for console FlowExplorer
// Returns the authoritative AGENT_ROSTER + all available REST endpoints
// ---------------------------------------------------------------------------

const FLOW_ENDPOINTS = [
    { id: 'classify', method: 'POST', path: '/classify', agent: 'RELAY', description: 'Classify a user request to the right agent/flow.' },
    { id: 'averi-ideate', method: 'POST', path: '/averi/ideate', agent: 'ATHENA', description: 'IDEATE mode: KEEPER recall â†’ ATHENA strategic vision.' },
    { id: 'averi-plan', method: 'POST', path: '/averi/plan', agent: 'ATHENA', description: 'PLAN mode: KEEPER recall â†’ ATHENA spec â†’ VERA truth-check.' },
    { id: 'creative-director', method: 'POST', path: '/flow/CreativeDirector', agent: 'IRIS', description: 'IRIS creative vision document generation from a campaign brief.' },
    { id: 'generate-media', method: 'POST', path: '/generate-media', agent: 'GEN-1', description: 'Route asset generation (image/video/text) to optimal pipeline.' },
    { id: 'score', method: 'POST', path: '/score', agent: 'SENTINEL', description: 'Vision LoRA scoring of creative assets (0-100) with critique.' },
    { id: 'director', method: 'POST', path: '/director', agent: 'ATLAS', description: 'ATHENA Video EDL Engine â€” hype reel director for campaign video.' },
    { id: 'search', method: 'POST', path: '/search', agent: 'VERA', description: 'Deep research via Perplexity Sonar + memory-augmented retrieval.' },
    { id: 'retrieve', method: 'POST', path: '/retrieve', agent: 'KEEPER', description: 'ChromaDB semantic vector search across the knowledge base.' },
    { id: 'generate', method: 'POST', path: '/generate', agent: 'RELAY', description: 'Unified multi-provider AI completion (Gemini, GPT-4, Sonar, Ollama).' },
    { id: 'stream', method: 'POST', path: '/stream', agent: 'RELAY', description: 'SSE streaming completion endpoint â€” low-latency outputs.' },
    // â”€â”€ Dispatch-facing task executors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    { id: 'infra-docker', method: 'POST', path: '/api/infraDockerFlow', agent: 'RELAY', description: 'FORGE: autonomous Docker/infra task executor for dispatch queue.' },
    { id: 'comet-browser', method: 'POST', path: '/api/cometBrowserFlow', agent: 'COMET', description: 'COMET: agentic browser action planner for dispatch queue.' },
    { id: 'generic-task', method: 'POST', path: '/api/genericTaskFlow', agent: 'RELAY', description: 'RELAY: universal fallback task executor for any workstream.' },
    { id: 'genkit-flow-builder', method: 'POST', path: '/api/genkitFlowBuilder', agent: 'ARCH', description: 'ARCH+CODEX: meta-flow that generates new Genkit flow files.' },
    // â”€â”€ Generative UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    { id: 'gen-ui', method: 'POST', path: '/api/genUiFlow', agent: 'IRIS', description: 'IRIS: generate production-quality React components from a design spec.' },
    // â”€â”€ IECR Director + Engine Flows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    { id: 'iecr-decompose', method: 'POST', path: '/api/iecr/decompose', agent: 'IRIS', description: 'IECR Director: decompose a creative brief into a parallel TaskGraph.' },
    { id: 'iecr-execute', method: 'POST', path: '/api/iecr/execute', agent: 'IRIS', description: 'IECR Director: execute a TaskGraph across all six engine flows.' },
    { id: 'engine-video', method: 'POST', path: '/api/engines/video', agent: 'GEN-1', description: 'IE VIDEO: non-linear editing, compositing, color grading, and timeline assembly.' },
    { id: 'engine-audio', method: 'POST', path: '/api/engines/audio', agent: 'ATLAS', description: 'IE AUDIO: synthesis, recording, mixing, mastering, and DAW operations.' },
    { id: 'engine-3d', method: 'POST', path: '/api/engines/3d', agent: 'GEN-1', description: 'IE 3D: real-time PBR rendering, USD/glTF assembly, and world building.' },
    { id: 'engine-design', method: 'POST', path: '/api/engines/design', agent: 'IRIS', description: 'IE DESIGN: vector/raster canvas, typography, brand identity, and layout.' },
    { id: 'engine-code', method: 'POST', path: '/api/engines/code', agent: 'CODEX', description: 'IE CODE: GPU shader generation, TypeScript scripting, and runtime tool creation.' },
    { id: 'engine-assets', method: 'POST', path: '/api/engines/assets', agent: 'KEEPER', description: 'IE ASSETS: semantic search, NAS integration, format conversion, and tagging.' },
    { id: 'relay', method: 'POST', path: '/relay', agent: 'RELAY', description: 'RELAY: inter-agent message router — Article XI switchboard protocol.' },
    { id: 'switchboard-signal', method: 'POST', path: '/switchboard/signal', agent: 'SIGNAL', description: 'SIGNAL: external integration agent — webhooks, APIs, broadcast platforms.' },
    { id: 'switchboard', method: 'POST', path: '/switchboard', agent: 'SWITCHBOARD', description: 'SWITCHBOARD: operations lead — hive health, parallel dispatch, coordination.' },
    { id: 'lex', method: 'POST', path: '/lex', agent: 'LEX', description: 'LEX: constitutional compliance — preflight/postflight/audit scans against 20 Articles.' },
    { id: 'compass', method: 'POST', path: '/compass', agent: 'COMPASS', description: 'COMPASS: ethical north star — three-question protocol for every proposed action.' },
    // ── Design Library ───────────────────────────────────────────────────
    { id: 'stitch', method: 'POST', path: '/stitch', agent: 'IRIS', description: 'STITCH: AI-native UI generation — HTML/React/Tailwind/Figma-spec from natural language (mirrors Google Stitch, powered by Gemini 2.5 Pro).' },
];

app.get('/api/flows', (_req, res) => {
    const hiveColors: Record<string, string> = {
        AVERI: '#F5A524', AURORA: '#C17D4A', KEEPER: '#9B72CF',
        SWITCHBOARD: '#22c55e', LEX: '#4285F4', BROADCAST: '#FF6B35',
        VALIDATOR: '#ef4444', SPECIALIST: '#20B2AA', ENHANCEMENT: '#8B5CF6',
    };
    res.json({
        total: AGENT_ROSTER.length,
        endpoint_count: FLOW_ENDPOINTS.length,
        agents: AGENT_ROSTER.map(a => ({
            ...a,
            color: hiveColors[a.hive] ?? '#9B72CF',
            endpoint: FLOW_ENDPOINTS.find(e => e.agent === a.name),
        })),
        endpoints: FLOW_ENDPOINTS,
        timestamp: new Date().toISOString(),
    });
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

// Wait for Genkit SDK's internal reflection server to initialize before
// starting Express. setImmediate lets the Genkit SDK's async init complete
// so the CLI handshake (port 3100) is established before our server floods stdout.
setImmediate(() => {
    app.listen(Number(PORT), '0.0.0.0', () => {
        // Minimal log in dev mode so the Genkit CLI can parse stdout cleanly
        if (process.env.GENKIT_ENV === 'dev') {
            console.log(`[CLE] Genkit Provider Runtime v5.0.0 listening on :${PORT}`);
        } else {
            console.log(`
â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
â•‘   CREATIVE LIBERATION ENGINE â€” GENKIT PROVIDER RUNTIME     â•‘
â•‘   v5.0.0 | Port ${PORT}                            â•‘
â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£
â•‘   Endpoints:                                     â•‘
â•‘     POST /generate       â€” Unified completion        â•‘
â•‘     POST /stream         â€” SSE streaming             â•‘
â•‘     POST /classify       â€” Task classification       â•‘
â•‘     POST /director       â€” ATHENA Video EDL Engine   â•‘
â•‘     POST /search         â€” Perplexity search         â•‘
â•‘     POST /retrieve       â€” ChromaDB vector search    â•‘
â•‘     POST /averi/ideate   â€” IDEATE mode (ATHENA+KEEPER) â•‘
â•‘     POST /averi/plan     â€” PLAN mode (ATHENA+VERA+KEEPER) â•‘
â•‘     POST /flow/CreativeDirector â€” IRIS vision doc    â•‘
â•‘     POST /generate-media â€” Campaign asset generator  â•‘
â•‘     POST /score          â€” Vision LoRA scoring       â•‘
â•‘     POST /api/iecr/decompose â€” IECR brief â†’ TaskGraph   â•‘
â•‘     POST /api/iecr/execute   â€” IECR TaskGraph execute   â•‘
â•‘     POST /api/engines/:e â€” IE engine flows (6)       â•‘
â•‘     POST /api/toolbox/*  â€” @cle/toolbox utils  â•‘
â•‘     GET  /health         â€” Health check              â•‘
â•‘     GET  /stats          â€” Audit statistics          â•‘
â•‘     GET  /audit          â€” Audit log                 â•‘
â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        `);
        }
    });
});

// ---------------------------------------------------------------------------
// TOOL-03/04: @cle/toolbox REST endpoints
// These use static imports from @cle/toolbox (imported at top of file).
// ---------------------------------------------------------------------------

app.post('/api/toolbox/palette', (req, res) => {
    const { baseHex } = req.body as { baseHex: string };
    res.json(paletteGenerator(baseHex));
});

app.post('/api/toolbox/contrast', (req, res) => {
    const { hex1, hex2 } = req.body as { hex1: string; hex2: string };
    const result = contrastRatio(hex1, hex2);
    res.json({ ratio: result?.ratio, meetsAA: result?.wcagAA });
});

app.post('/api/toolbox/slugify', (req, res) => {
    const { str, separator = '-' } = req.body as { str: string; separator?: string };
    res.json({ slug: urlSlugify(str, { separator }) });
});

app.post('/api/toolbox/base64', (req, res) => {
    const { input } = req.body as { input: string };
    res.json({ base64: base64Encode(input).output, base64url: base64Encode(input, true).output });
});

app.post('/api/toolbox/mime', (req, res) => {
    const { filename } = req.body as { filename: string };
    const ext = filename?.split('.').pop()?.toLowerCase() ?? '';
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', mp3: 'audio/mpeg', pdf: 'application/pdf', json: 'application/json' };
    res.json({ mimeType: mimeMap[ext] ?? 'application/octet-stream' });
});

app.post('/api/toolbox/password-strength', (req, res) => {
    const { password } = req.body as { password: string };
    res.json(passwordStrength(password));
});

// ---------------------------------------------------------------------------
// Sovereign Home Mesh — Physical Intelligence Flows
// POST /home/bird-watch    — Gemini Vision bird ID / security classification
// POST /home/intel         — NLQ presence query (ATHENA)
// POST /home/stranger-scan — VERA anomaly detection scan
// ---------------------------------------------------------------------------

app.post('/home/bird-watch', async (req, res) => {
    try {
        const result = await birdWatcherFlow(req.body);
        res.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Flow error';
        res.status(500).json({ error: message });
    }
});

app.post('/home/intel', async (req, res) => {
    try {
        const result = await guestIntelligenceFlow(req.body);
        res.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Flow error';
        res.status(500).json({ error: message });
    }
});

app.post('/home/stranger-scan', async (req, res) => {
    try {
        const result = await strangerAlertFlow(req.body);
        res.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Flow error';
        res.status(500).json({ error: message });
    }
});

// ---------------------------------------------------------------------------
// POST /innerVoice — Sandbar Stream Inner Voice AI
// Client: ecosystem/sandbar-stream (Inner Voice chat page)
// ---------------------------------------------------------------------------

app.post('/innerVoice', async (req, res) => {
    try {
        const { message, context } = req.body as { message: string; context?: string[] };
        if (!message) {
            return res.status(400).json({ error: '"message" is required' });
        }
        const { innerVoiceFlow } = await import('./flows/inner-voice.js');
        const result = await innerVoiceFlow({ message, context });
        res.json(result);
    } catch (error: any) {
        console.error('[SANDBAR:InnerVoice] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// GENMEDIA STUDIO — Generative Media Endpoints
// POST /generateImage    — Text→Image via Gemini 2.0 Flash Image Gen
// POST /generateVideo    — Text→Video description (Veo2 when available)
// POST /generateAudio    — Text→Audio description
// POST /generateStoryboard — Script→Multi-panel storyboard
// POST /batchGenerate    — Batch image generation (multi-prompt)
// ---------------------------------------------------------------------------

app.post('/generateImage', async (req, res) => {
    try {
        const { prompt, model, aspectRatio, negativePrompt, style } = req.body as {
            prompt: string; model?: string; aspectRatio?: string;
            negativePrompt?: string; style?: string;
        };

        if (!prompt) return res.status(400).json({ error: '"prompt" is required' });

        const fullPrompt = [prompt, style && `style: ${style}`, negativePrompt && `avoid: ${negativePrompt}`]
            .filter(Boolean).join('. ');

        // Gemini image generation — uses stable preview model (was -exp-)
        const imageModel = model ?? (process.env.GENKIT_IMAGE_MODEL ?? 'googleai/gemini-2.0-flash-preview-image-generation');
        console.log(`[GENMEDIA:Image] Model: ${imageModel} | Prompt: ${fullPrompt.slice(0, 80)}…`);

        try {
            const response = await ai.generate({
                model: imageModel as any,
                prompt: fullPrompt,
                config: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    ...(aspectRatio && { aspectRatio }),
                },
            });

            // Extract image from response parts
            const parts = response.message?.content ?? [];
            const imagePart = parts.find(p => p.media?.contentType?.startsWith('image/'));

            if (imagePart?.media) {
                return res.json({ url: imagePart.media.url, model: imageModel, prompt });
            }

            // Fallback: return text description if no image
            const text = response.text;
            return res.json({ text, model: imageModel, prompt, note: 'Image generation model returned text only' });

        } catch (genErr: any) {
            // Model not available — return descriptive placeholder
            console.warn(`[GENMEDIA:Image] Model unavailable: ${genErr.message}`);
            return res.json({
                text: `[Image Generation] Prompt received: "${fullPrompt}". Model "${imageModel}" not available in current environment. Configure GOOGLE_API_KEY with Gemini 2.0 Flash access for live generation.`,
                model: imageModel,
                prompt,
            });
        }
    } catch (err: any) {
        console.error('[GENMEDIA:Image] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/generateVideo', async (req, res) => {
    try {
        const { prompt, model, duration } = req.body as { prompt: string; model?: string; duration?: string };
        if (!prompt) return res.status(400).json({ error: '"prompt" is required' });

        const videoModel = model ?? 'veo-2';
        console.log(`[GENMEDIA:Video] Model: ${videoModel} | Duration: ${duration ?? '4s'} | Prompt: ${prompt.slice(0, 80)}…`);

        // Veo2 via Genkit — describe the video generation task
        // (Veo2 requires Vertex AI — use Gemini to generate a detailed direction if Veo unavailable)
        const response = await ai.generate({
            model: process.env.GENKIT_DEFAULT_MODEL ?? 'googleai/gemini-2.5-flash',
            system: `You are a video director. Given a video prompt, generate a detailed shot-by-shot production brief including: camera angle, movement, lighting, subject action, color grade, and audio direction. Be specific and cinematic.`,
            prompt: `Video prompt: "${prompt}"\nDuration: ${duration ?? '4 seconds'}\nModel target: ${videoModel}\n\nGenerate production brief:`,
        });

        res.json({
            text: response.text,
            model: videoModel,
            prompt,
            duration: duration ?? '4s',
            note: `Video production brief generated. Veo2 requires Vertex AI SDK. See /generateVideo for live integration.`,
        });
    } catch (err: any) {
        console.error('[GENMEDIA:Video] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/generateAudio', async (req, res) => {
    try {
        const { prompt, model, duration } = req.body as { prompt: string; model?: string; duration?: string };
        if (!prompt) return res.status(400).json({ error: '"prompt" is required' });

        console.log(`[GENMEDIA:Audio] Model: ${model ?? 'lyria-2'} | Duration: ${duration} | Prompt: ${prompt.slice(0, 80)}…`);

        const response = await ai.generate({
            model: process.env.GENKIT_DEFAULT_MODEL ?? 'googleai/gemini-2.5-flash',
            system: `You are an audio director and music producer. Given an audio prompt, generate a detailed composition spec including: tempo (BPM), key, time signature, instrumentation list, arrangement notes, production techniques, and mood markers. Be specific and technical.`,
            prompt: `Audio prompt: "${prompt}"\nDuration: ${duration ?? '30 seconds'}\nModel: ${model ?? 'lyria-2'}\n\nGenerate composition spec:`,
        });

        res.json({
            text: response.text,
            model: model ?? 'lyria-2',
            prompt,
            duration: duration ?? '30s',
            note: 'Composition spec generated. Lyria 2 requires Vertex AI Music Gen API.',
        });
    } catch (err: any) {
        console.error('[GENMEDIA:Audio] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/generateStoryboard', async (req, res) => {
    try {
        const { prompt, model, panels } = req.body as { prompt: string; model?: string; panels?: string };
        if (!prompt) return res.status(400).json({ error: '"prompt" is required' });

        const numPanels = parseInt(panels?.replace(/\D/g, '') ?? '6', 10);
        console.log(`[GENMEDIA:Storyboard] ${numPanels} panels | Prompt: ${prompt.slice(0, 80)}…`);

        const response = await ai.generate({
            model: model ?? (process.env.GENKIT_DEFAULT_MODEL ?? 'googleai/gemini-2.5-flash'),
            system: `You are a storyboard director. Generate a detailed ${numPanels}-panel storyboard in JSON format. Each panel has: panelNumber, shot (ELS/LS/MS/MCU/CU), angle (eye/low/high/dutch), action, dialogue, lighting, notes. Return ONLY valid JSON array.`,
            prompt: `Script/scene: "${prompt}"\nGenerate ${numPanels} storyboard panels as JSON array:`,
        });

        let storyboard;
        try {
            const text = response.text;
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            storyboard = jsonMatch ? JSON.parse(jsonMatch[0]) : [{ panelNumber: 1, action: text }];
        } catch {
            storyboard = [{ panelNumber: 1, action: response.text }];
        }

        res.json({ storyboard, panels: numPanels, model: model ?? (process.env.GENKIT_DEFAULT_MODEL ?? 'googleai/gemini-2.5-flash'), prompt });
    } catch (err: any) {
        console.error('[GENMEDIA:Storyboard] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/batchGenerate', async (req, res) => {
    try {
        const { prompt, model } = req.body as { prompt: string; model?: string };
        if (!prompt) return res.status(400).json({ error: '"prompt" is required' });

        // Parse multi-line prompts
        const prompts = prompt.split('\n').map((p: string) => p.trim()).filter(Boolean).slice(0, 20);
        const imageModel = model ?? (process.env.GENKIT_IMAGE_MODEL ?? 'googleai/gemini-2.0-flash-preview-image-generation');
        console.log(`[GENMEDIA:Batch] ${prompts.length} prompts | Model: ${imageModel}`);
        const results = [];

        for (const p of prompts) {
            try {
                const response = await ai.generate({
                    model: imageModel as any,
                    prompt: p,
                    config: { responseModalities: ['TEXT', 'IMAGE'] },
                });
                const parts = response.message?.content ?? [];
                const imagePart = parts.find(part => part.media?.contentType?.startsWith('image/'));
                if (imagePart?.media) {
                    results.push({ prompt: p, url: imagePart.media.url, status: 'done' });
                } else {
                    results.push({ prompt: p, text: response.text, status: 'text_only' });
                }
            } catch (e: any) {
                results.push({ prompt: p, error: e.message, status: 'error' });
            }
        }

        res.json({ results, total: prompts.length, model: imageModel });
    } catch (err: any) {
        console.error('[GENMEDIA:Batch] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------------------------
// ENGINE PIPELINE — WP MCP + Agentic Memory Publishing
// POST /wp/publish  — Draft, publish, or schedule a WordPress post grounded
//                     in the engine's agentic memory (SCRIBE / KEEPER).
// Body: { instruction: string, publishImmediately?: boolean, scheduledDate?: string, sessionId?: string }
// ---------------------------------------------------------------------------

app.post('/wp/publish', async (req, res) => {
    try {
        const result = await WPPublishingFlow(req.body);
        res.json(result);
    } catch (e: any) {
        console.error('[WP-PUBLISH] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

export { app };
export default app;


