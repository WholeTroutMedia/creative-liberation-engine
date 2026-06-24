# Wave 37: Mobile Sovereignty — Implementation Contracts

> **Wave:** 37 | **Date:** 2026-03-19 | **Status:** READY FOR ANTIGRAVITY
>
> NAVD (Comet) has shipped: comet-mobile.md, navd-mobile.md, averi.md, AVERI-MOBILE.md
>
> The contracts below are for ANTIGRAVITY windows to claim and implement.

---

## HELIX A — Dispatch Gateway Auth Middleware

**Workstream:** `infra-docker` | **Priority:** P0

**File:** `packages/dispatch/src/middleware/api-key-auth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = header.slice(7);
  if (token !== process.env.DISPATCH_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  next();
}
```

**File:** `packages/dispatch/src/routes/handoffs.ts`

```typescript
import { Router, Request, Response } from 'express';

interface HandoffState {
  from: 'NAVD' | 'NAVD-M' | 'PERPLEXITY' | 'ANTIGRAVITY' | 'CLAUDE-CODE';
  phase: 'PROBE' | 'PLAN' | 'SHIP' | 'VERIFY';
  task: string;
  taskId?: string;
  workstream?: string;
  agent_id?: string;
  outputs: string[];
  next: string;
  context: string;
  timestamp: string;
  veraMemoryRef?: string;
  qa_status?: string;
  network?: 'public' | 'lan';
}

const router = Router();
let latestHandoff: HandoffState | null = null;

router.post('/api/handoffs', (req: Request, res: Response) => {
  latestHandoff = req.body as HandoffState;
  // TODO: persist to file or DB
  res.json({ ok: true, handoff: latestHandoff });
});

router.get('/api/handoffs/latest', (_req: Request, res: Response) => {
  if (!latestHandoff) return res.status(404).json({ error: 'No handoff' });
  res.json(latestHandoff);
});

export { router as handoffsRouter };
```

**Wire into server.ts:**
```typescript
import { apiKeyAuth } from './middleware/api-key-auth';
import { handoffsRouter } from './routes/handoffs';

// Apply auth to all /api/* routes
app.use('/api', apiKeyAuth);
app.use(handoffsRouter);
```

**Tunnel:** `services/dispatch-tunnel/docker-compose.yml`
```yaml
version: '3.8'
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    restart: unless-stopped
    network_mode: host
```

**Acceptance:**
- `curl -H "Authorization: Bearer $KEY" https://dispatch.yourdomain.com/api/status` -> 200
- Unauthenticated -> 401
- POST /api/handoffs persists, GET /api/handoffs/latest reads back

---

## HELIX B — AVERI Genkit Flow

**Workstream:** `genkit-flows` | **Priority:** P0

**File:** `packages/genkit/src/flows/averi-invoke.ts`

```typescript
import { ai } from '../genkit-instance';
import { z } from 'zod';

const AveriInputSchema = z.object({
  intent: z.enum(['IDEATE', 'STATUS', 'DISPATCH', 'MEMORY']),
  context: z.object({
    tabs: z.array(z.object({ url: z.string(), title: z.string() })).optional(),
    signal: z.string(),
    location: z.enum(['desktop', 'mobile']).optional(),
    workstream: z.string().optional(),
  }),
  trinity_mode: z.enum(['ATHENA', 'VERA', 'IRIS']),
});

const AveriOutputSchema = z.object({
  mode: z.string(),
  response: z.string(),
  tasks_created: z.array(z.string()).optional(),
  memory_refs: z.array(z.string()).optional(),
  recommendations: z.array(z.object({
    action: z.string(),
    priority: z.string(),
  })).optional(),
  timestamp: z.string(),
});

export const averiInvokeFlow = ai.defineFlow(
  { name: 'averi/invoke', inputSchema: AveriInputSchema, outputSchema: AveriOutputSchema },
  async (input) => {
    const { trinity_mode, intent, context } = input;
    switch (trinity_mode) {
      case 'ATHENA': return handleAthena(intent, context);
      case 'VERA': return handleVera(intent, context);
      case 'IRIS': return handleIris(intent, context);
    }
  }
);

async function handleAthena(intent: string, context: any) {
  // Query dispatch /api/status + /api/handoffs/latest
  // Synthesize strategic overview
  // Return recommendations
}

async function handleVera(intent: string, context: any) {
  // Query SCRIBE ChromaDB via packages/memory tier-routing
  // Return relevant context + memory refs
}

async function handleIris(intent: string, context: any) {
  // POST /api/tasks to create task
  // POST /api/blockers if needed
  // Return confirmation with task IDs
}
```

**Acceptance:**
- POST `/averi/invoke` with ATHENA returns status summary
- POST with VERA returns memory context from ChromaDB
- POST with IRIS creates real task in dispatch queue

---

## HELIX D — Mobile Bridge + Push Notifications

**Workstream:** `mobile-bridge` | **Priority:** P1

**File:** `packages/mobile-bridge/src/ntfy-client.ts`

```typescript
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'cle-mobile-operator';
const NTFY_URL = `https://ntfy.sh/${NTFY_TOPIC}`;

type Priority = 'urgent' | 'high' | 'default' | 'low';

export async function pushNotification(
  title: string, body: string, priority: Priority = 'default'
) {
  await fetch(NTFY_URL, {
    method: 'POST',
    headers: { Title: title, Priority: priority },
    body,
  });
}
```

**File:** `packages/mobile-bridge/src/dispatch-webhook.ts`

```typescript
import { pushNotification } from './ntfy-client';

// Hook into dispatch event emitter
export function wireDispatchWebhooks(dispatch: any) {
  dispatch.on('task:created', (task: any) => {
    if (task.workstream === 'comet-mobile') {
      const p = task.priority === 'P0' ? 'urgent' : 'high';
      pushNotification('New Task', task.title, p);
    }
  });
  dispatch.on('blocker:filed', (blocker: any) => {
    pushNotification('Blocker Filed', blocker.description, 'urgent');
  });
  dispatch.on('handoff:phase-change', (handoff: any) => {
    pushNotification('Handoff', `${handoff.from}: ${handoff.phase}`, 'high');
  });
}
```

**Acceptance:**
- P0 blocker triggers urgent ntfy push within 5 seconds
- `cle-wtm.web.app/mobile` loads and shows live task queue

---

## HELIX F — Dispatch Bridge MCP Server

**Workstream:** `mcp-router` | **Priority:** P1

**File:** `packages/mcp-servers/src/dispatch-bridge/index.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const DISPATCH = process.env.DISPATCH_URL || 'http://127.0.0.1:5050';
const KEY = process.env.DISPATCH_API_KEY || '';
const AVERI = 'https://cle-scciwucwca-uc.a.run.app';

const server = new McpServer({ name: 'dispatch-bridge', version: '1.0.0' });
const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

server.tool('dispatch_status', {}, async () => {
  const r = await fetch(`${DISPATCH}/api/status`, { headers });
  return { content: [{ type: 'text', text: JSON.stringify(await r.json()) }] };
});

server.tool('dispatch_create_task', {
  title: z.string(), workstream: z.string(), priority: z.string()
}, async ({ title, workstream, priority }) => {
  const r = await fetch(`${DISPATCH}/api/tasks`, {
    method: 'POST', headers,
    body: JSON.stringify({ title, workstream, priority }),
  });
  return { content: [{ type: 'text', text: JSON.stringify(await r.json()) }] };
});

server.tool('averi_invoke', {
  trinity_mode: z.enum(['ATHENA', 'VERA', 'IRIS']),
  intent: z.enum(['IDEATE', 'STATUS', 'DISPATCH', 'MEMORY']),
  signal: z.string()
}, async ({ trinity_mode, intent, signal }) => {
  const r = await fetch(`${AVERI}/averi/invoke`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trinity_mode, intent, context: { signal, location: 'mcp' } }),
  });
  return { content: [{ type: 'text', text: JSON.stringify(await r.json()) }] };
});

server.tool('heartbeat', { agent_id: z.string() }, async ({ agent_id }) => {
  const r = await fetch(`${DISPATCH}/api/agents/heartbeat`, {
    method: 'POST', headers,
    body: JSON.stringify({ agent_id, tool: 'mcp-bridge', current_task: 'active' }),
  });
  return { content: [{ type: 'text', text: JSON.stringify(await r.json()) }] };
});
```

**Acceptance:**
- MCP tool `averi_invoke` with ATHENA returns strategic summary
- MCP tool `dispatch_status` returns live queue
- MCP tool `dispatch_create_task` creates task in queue