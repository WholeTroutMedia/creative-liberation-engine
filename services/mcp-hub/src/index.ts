import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { apiRouter, eventBus } from './routes.js';
import { sprintRouter } from './sprint-planner.js';
import { mountMcpSSE, runMcpStdio } from './mcp-server.js';
import { initVectorization } from './vectorize.js';
import { initPublishingWorker } from './publishing-worker.js';

const app = express();
const PORT = process.env.MCP_HUB_PORT || 5056; // 5055 taken by sovereign-home-mesh

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const DATA_DIR = process.env.MCP_HUB_DATA_DIR || path.join(ROOT_DIR, 'services', 'mcp-hub', 'data');

// Ensure data directory and seed files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of ['issues.json', 'docs.json', 'audit.json', 'sprints.json']) {
  const fp = path.join(DATA_DIR, f);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, '[]');
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// REST API routes
app.use('/api', apiRouter);
app.use('/api/track', sprintRouter);

// MCP SSE transport (for CORTEX agent connections)
mountMcpSSE(app);

// Initialize vectorization hooks
initVectorization(eventBus, DATA_DIR);
initPublishingWorker(eventBus, DATA_DIR);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'operational',
    service: 'sovereign-mcp-hub',
    version: '2.0.0',
    capabilities: [
      'sentinel-track',
      'scholar-hive',
      'sprint-planner',
      'mcp-tools',
      'vectorization',
      'rbac',
      'audit-log',
    ],
    uptime: process.uptime(),
    air_gap: true,
  });
});

if (process.argv.includes('--stdio')) {
  runMcpStdio();
} else {
  // Legacy SSE redirect
  app.get('/sse', (_req, res) => {
    res.redirect('/mcp/sse');
  });

  app.listen(PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║         🧠  SOVEREIGN MCP HUB v2.0.0                   ║');
    console.log('║         Air-Gap Secured · NAS Resident                  ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  REST API:    http://0.0.0.0:${PORT}/api                  ║`);
    console.log(`║  MCP SSE:     http://0.0.0.0:${PORT}/mcp/sse              ║`);
    console.log(`║  Health:      http://0.0.0.0:${PORT}/health               ║`);
    console.log('║  Data Dir:    ' + DATA_DIR.padEnd(42) + '║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log('║  Services:                                              ║');
    console.log('║    ■ Sentinel Track (Jira-killer)                       ║');
    console.log('║    ■ Scholar Hive (Confluence-killer)                   ║');
    console.log('║    ■ Sprint Planner (velocity + auto-assign)            ║');
    console.log('║    ■ Qdrant Vectorization (semantic RAG)                ║');
    console.log('║    ■ RBAC (agent access control)                        ║');
    console.log('║    ■ Audit Log (compliance trail)                       ║');
    console.log('║    ■ MCP Tools (14 tools for CORTEX)                    ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
  });
}
