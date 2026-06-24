/**
 * server.ts — MCP Fetch Proxy
 * @cle/mcp-fetch-proxy
 *
 * P0 Fix: COMET browser cannot POST to APIs (no devtools, no JS context for raw fetch).
 * This service acts as an authenticated gateway — COMET sends proxy requests here,
 * we make the actual HTTP calls server-side and return results.
 *
 * Port: 7070
 * CORS: Allows requests from COMET's browser origin
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';

const app: Express = express();
const PORT = parseInt(process.env['PORT'] ?? '7070', 10);
const DISPATCH_URL = process.env['DISPATCH_URL'] ?? 'http://127.0.0.1:5050';
const GENKIT_URL = process.env['GENKIT_URL'] ?? 'http://127.0.0.1:4100';

// ——— Rate Limiting (simple in-memory) ————————————————————————————————————————

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // requests per minute per IP
const RATE_WINDOW_MS = 60_000;

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = (req.ip ?? 'unknown').replace('::ffff:', '');
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    next();
    return;
  }

  if (record.count >= RATE_LIMIT) {
    res.status(429).json({ error: 'Rate limit exceeded', retryAfter: Math.ceil((record.resetAt - now) / 1000) });
    return;
  }

  record.count++;
  next();
}

// ——— Allowed target origins (allowlist) ——————————————————————————————————————

const ALLOWED_HOSTS = [
  '127.0.0.1',
  'localhost',
];

function isAllowedTarget(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

// ——— Middleware ——————————————————————————————————————————————————————————————

const CORS_ORIGINS = [
  // Local development
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:8765',
  'http://localhost:4100',
  // NAS sovereign mesh
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4100',
  'http://127.0.0.1:5050',
  // Production — cleengine.systems
  'https://cleengine.systems',
  'https://www.cleengine.systems',
  'https://app.cleengine.systems',
  'https://api.cleengine.systems',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin / non-browser requests (agents, curl, etc.)
    if (!origin) return callback(null, true);
    if (CORS_ORIGINS.includes(origin) || origin.endsWith('.cleengine.systems')) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin '${origin}' not in allowlist`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Agent-ID', 'X-Session-ID'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(rateLimit);

// ——— Health ——————————————————————————————————————————————————————————————————

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'operational',
    service: 'mcp-fetch-proxy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    targets: { dispatch: DISPATCH_URL, genkit: GENKIT_URL },
  });
});

// ——— Generic Proxy: POST /fetch ——————————————————————————————————————————————

interface ProxyRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

app.post('/fetch', async (req: Request, res: Response): Promise<void> => {
  const { url, method = 'GET', headers = {}, body }: ProxyRequest = req.body as ProxyRequest;

  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  if (!isAllowedTarget(url)) {
    res.status(403).json({ error: `Target host not in allowlist`, url });
    return;
  }

  try {
    const fetchRes = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = fetchRes.headers.get('content-type') ?? '';
    let data: unknown;

    if (contentType.includes('application/json')) {
      data = await fetchRes.json();
    } else {
      data = await fetchRes.text();
    }

    res.status(fetchRes.status).json({
      status: fetchRes.status,
      ok: fetchRes.ok,
      data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: 'Proxy fetch failed', message });
  }
});

// ——— Dispatch Shortcuts: /api/* ——————————————————————————————————————————————

app.all('/api/*', async (req: Request, res: Response): Promise<void> => {
  const path = req.path.replace(/^\/api/, '');
  const targetUrl = `${DISPATCH_URL}${path}`;

  try {
    const fetchRes = await fetch(targetUrl, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await fetchRes.json();
    res.status(fetchRes.status).json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: 'Dispatch proxy failed', message });
  }
});

// ——— Genkit Shortcuts: /genkit/* —————————————————————————————————————————————

app.all('/genkit/*', async (req: Request, res: Response): Promise<void> => {
  const path = req.path.replace(/^\/genkit/, '');
  const targetUrl = `${GENKIT_URL}${path}`;

  try {
    const fetchRes = await fetch(targetUrl, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await fetchRes.json();
    res.status(fetchRes.status).json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: 'Genkit proxy failed', message });
  }
});

// ——— Boot ————————————————————————————————————————————————————————————————————

app.listen(PORT, () => {
  console.log(`[MCP-FETCH-PROXY] ✅ Online :${PORT}`);
  console.log(`[MCP-FETCH-PROXY] Dispatch → ${DISPATCH_URL}`);
  console.log(`[MCP-FETCH-PROXY] Genkit   → ${GENKIT_URL}`);
});
