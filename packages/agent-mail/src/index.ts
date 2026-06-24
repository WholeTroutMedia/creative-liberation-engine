/**
 * CLE Agent Mail — Main Worker Entry Point
 *
 * Cloudflare Worker that handles:
 * 1. Inbound email via CF Email Routing → email() handler
 * 2. REST API via fetch() handler → /api/*
 * 3. MCP server via fetch() handler → /mcp (Durable Object)
 * 4. Resend webhooks via fetch() handler → /webhooks/*
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import PostalMime from 'postal-mime';
import api, { webhooks } from './routes/api';
import type { Env, MessageRow } from './types';
import { parseAgentTarget } from './types';
import { isSenderApproved } from './security/sender-gate';
import { dispatchInboundTask } from './dispatch/webhook';

// Re-export the Durable Object class so CF can find it
export { McpAgent } from './mcp/agent';

// ─── Hono App ────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors({ origin: '*' }));

// Health check
app.get('/', (c) => c.json({
  service: 'CLE Agent Mail',
  version: '0.1.0',
  status: 'operational',
  endpoints: { api: '/api/*', mcp: '/mcp', webhooks: '/webhooks/*' },
}));

// REST API
app.route('/api', api);

// Resend delivery webhooks
app.route('/webhooks', webhooks);

// MCP endpoint — route to Durable Object (requires Workers Paid plan)
app.all('/mcp', async (c) => {
  if (!c.env.MCP_AGENT) return c.json({ error: 'MCP not available — Workers Paid plan required' }, 503);
  const id = c.env.MCP_AGENT.idFromName('default');
  const stub = c.env.MCP_AGENT.get(id);
  return stub.fetch(c.req.raw);
});
app.all('/mcp/*', async (c) => {
  if (!c.env.MCP_AGENT) return c.json({ error: 'MCP not available — Workers Paid plan required' }, 503);
  const id = c.env.MCP_AGENT.idFromName('default');
  const stub = c.env.MCP_AGENT.get(id);
  return stub.fetch(c.req.raw);
});

// ─── Email Handler (CF Email Routing) ────────────────────────────────────────

interface InboundEmail {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}

async function handleEmail(
  message: InboundEmail,
  env: Env,
): Promise<void> {
  // Collect the raw email stream into an ArrayBuffer
  const chunks: Uint8Array[] = [];
  const reader = message.raw.getReader();
  let done = false;
  while (!done) {
    const result = await reader.read();
    if (result.value) chunks.push(result.value);
    done = result.done;
  }
  const rawEmail = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    rawEmail.set(chunk, offset);
    offset += chunk.length;
  }

  const parser = new PostalMime();
  const parsed = await parser.parse(rawEmail.buffer as ArrayBuffer);

  const msgId = crypto.randomUUID();
  const from = message.from;
  const to = message.to;
  const subject = parsed.subject ?? '(no subject)';
  const bodyText = parsed.text ?? '';
  const bodyHtml = parsed.html ?? '';

  // Determine agent target from recipient address
  const agentTarget = parseAgentTarget(to);

  // Check sender approval status
  const approved = await isSenderApproved(env.DB, from);

  // Create thread
  const threadId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    'INSERT INTO threads (id, subject, last_message_at, message_count) VALUES (?, ?, ?, 1)'
  ).bind(threadId, subject, now).run();

  // Store message
  await env.DB.prepare(
    `INSERT INTO messages (id, thread_id, from_addr, to_addr, subject, body_text, body_html, direction, approved, status, agent_target, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'inbound', ?, 'received', ?, ?)`
  ).bind(
    msgId, threadId, from, to, subject, bodyText, bodyHtml,
    approved ? 1 : 0, agentTarget, now,
  ).run();

  // Store attachments in R2 (only if R2 bucket is configured)
  if (env.ATTACHMENTS && parsed.attachments && parsed.attachments.length > 0) {
    for (const att of parsed.attachments) {
      const attId = crypto.randomUUID();
      const r2Key = `attachments/${msgId}/${attId}/${att.filename ?? 'unnamed'}`;
      const attContent = att.content as ArrayBuffer;
      await env.ATTACHMENTS.put(r2Key, attContent);
      await env.DB.prepare(
        'INSERT INTO attachments (id, message_id, filename, content_type, size, r2_key) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(attId, msgId, att.filename ?? 'unnamed', att.mimeType ?? 'application/octet-stream', attContent.byteLength, r2Key).run();
    }
  }

  // Fire webhook to dispatch server
  await dispatchInboundTask(env, {
    id: msgId,
    thread_id: threadId,
    from,
    to,
    subject,
    agent_target: agentTarget,
  });

  console.log(`[agent-mail] Inbound: ${msgId} from=${from} to=${to} agent=${agentTarget ?? 'none'} approved=${approved}`);
}

// ─── Worker Export ───────────────────────────────────────────────────────────

export default {
  fetch: app.fetch,
  email: handleEmail,
};
