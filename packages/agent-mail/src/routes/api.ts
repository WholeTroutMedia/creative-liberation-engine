/**
 * CLE Agent Mail — REST API Routes
 *
 * Hono-based REST API serving all email, draft, label, archive, search,
 * and sender approval operations. All routes require X-API-Key auth.
 */

import { Hono } from 'hono';
import type {
  Env, MessageRow, ThreadRow, DraftRow,
  SendEmailRequest, ReplyRequest, CreateDraftRequest,
  ApproveSenderRequest, AddLabelsRequest,
} from '../types';
import { parseAgentTarget } from '../types';
import { isSenderApproved, approveSender, removeSender, listApprovedSenders, listPending } from '../security/sender-gate';
import { scanOutbound } from '../security/outbound-guard';
import { fireWebhook } from '../dispatch/webhook';
import { sendViaMailchannels } from '../outbound/mailchannels';
import { resolveAgentSender } from '../types';

/** Unified outbound send — Cloudflare primary, Mailchannels fallback, Resend fallback */
async function sendEmail(env: Env, opts: {
  to: string; cc?: string; bcc?: string;
  subject: string; text: string; html?: string;
  agentId?: string | null;
}): Promise<'sent' | 'failed'> {
  const sender = resolveAgentSender(opts.agentId, env.FROM_EMAIL, env.FROM_NAME);

  // Primary: Cloudflare Native Send Email
  if (env.SEND_EMAIL) {
    try {
      await env.SEND_EMAIL.send({
        to: opts.to,
        from: { email: sender.email, name: sender.name },
        subject: opts.subject,
        text: opts.text,
        ...(opts.html ? { html: opts.html } : {}),
        ...(opts.cc ? { cc: opts.cc } : {}),
        ...(opts.bcc ? { bcc: opts.bcc } : {}),
      });
      console.log(`[agent-mail] Sent email via Cloudflare SEND_EMAIL successfully to ${opts.to}`);
      return 'sent';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[agent-mail] Cloudflare SEND_EMAIL failed: ${msg}. Trying fallbacks...`);
    }
  }

  // Fallback 1: Mailchannels
  if (env.MAILCHANNELS_API_KEY) {
    const result = await sendViaMailchannels(env.MAILCHANNELS_API_KEY, {
      to: opts.to, cc: opts.cc, bcc: opts.bcc,
      from: sender.email,
      fromName: sender.name,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    if (result.ok) return 'sent';
  }
  // Fallback 2: Resend
  if (env.RESEND_API_KEY) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${sender.name} <${sender.email}>`,
          to: opts.to, cc: opts.cc, bcc: opts.bcc,
          subject: opts.subject, text: opts.text, html: opts.html,
        }),
      });
      if (resp.ok) return 'sent';
    } catch { /* fall through */ }
  }
  return 'failed';
}

const api = new Hono<{ Bindings: Env }>();

// ─── Auth Middleware ──────────────────────────────────────────────────────────

api.use('/*', async (c, next) => {
  const apiKey = c.req.header('X-API-Key') ?? c.req.header('Authorization')?.replace('Bearer ', '');
  if (!apiKey || apiKey !== c.env.API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

// ─── Send Email ──────────────────────────────────────────────────────────────

api.post('/send', async (c) => {
  const body = await c.req.json<SendEmailRequest>();
  if (!body.to || !body.subject || !body.body_text) {
    return c.json({ error: 'Missing required fields: to, subject, body_text' }, 400);
  }

  // Outbound PII guard
  if (c.env.OUTBOUND_GUARD_ENABLED !== 'false') {
    const scan = scanOutbound(body.body_text, body.subject);
    if (!scan.passed) {
      return c.json({ error: 'Outbound guard blocked', violations: scan.violations }, 403);
    }
  }

  const msgId = crypto.randomUUID();
  const threadId = body.thread_id ?? crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // Ensure thread exists
  await c.env.DB.prepare(
    `INSERT INTO threads (id, subject, last_message_at, message_count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(id) DO UPDATE SET last_message_at = excluded.last_message_at, message_count = message_count + 1`
  ).bind(threadId, body.subject, now).run();

  // Store outbound message
  await c.env.DB.prepare(
    `INSERT INTO messages (id, thread_id, from_addr, to_addr, cc, bcc, subject, body_text, body_html, direction, approved, status, agent_target, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'outbound', 1, 'sending', ?, ?)`
  ).bind(
    msgId, threadId, c.env.FROM_EMAIL, body.to,
    body.cc ?? '', body.bcc ?? '', body.subject,
    body.body_text, body.body_html ?? '',
    body.agent_id ?? null, now,
  ).run();

  // Send via Mailchannels (primary) or Resend (fallback)
  const sendStatus = await sendEmail(c.env, {
    to: body.to, cc: body.cc, bcc: body.bcc,
    subject: body.subject, text: body.body_text, html: body.body_html,
    agentId: body.agent_id,
  });

  // Update status
  await c.env.DB.prepare(
    'UPDATE messages SET status = ? WHERE id = ?'
  ).bind(sendStatus, msgId).run();

  // Fire webhook
  await fireWebhook(c.env, {
    event: 'message.sent',
    data: { id: msgId, thread_id: threadId, from: c.env.FROM_EMAIL, to: body.to, subject: body.subject, direction: 'outbound', approved: 1, agent_target: body.agent_id ?? null },
    timestamp: now,
  });

  return c.json({ id: msgId, thread_id: threadId, status: sendStatus }, 201);
});

import { renderIdeationEmailHtml, renderIdeationEmailText } from '../templates/render';
import type { IdeationEmailProps } from '../templates/IdeationEmail';

// ─── Send Templated Email ────────────────────────────────────────────────────

api.post('/send/template/ideation', async (c) => {
  const body = await c.req.json<{ to: string; cc?: string; bcc?: string; agent_id?: string; props: IdeationEmailProps }>();
  if (!body.to || !body.props) {
    return c.json({ error: 'Missing required fields: to, props' }, 400);
  }

  const html = await renderIdeationEmailHtml(body.props);
  const text = await renderIdeationEmailText(body.props);
  const subject = `[${body.props.jobId}] Ideation Review Required: ${body.props.sourceTitle}`;

  // Use the existing /send logic by calling it directly or invoking sendEmail
  const msgId = crypto.randomUUID();
  const threadId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    `INSERT INTO threads (id, subject, last_message_at, message_count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(id) DO UPDATE SET last_message_at = excluded.last_message_at, message_count = message_count + 1`
  ).bind(threadId, subject, now).run();

  await c.env.DB.prepare(
    `INSERT INTO messages (id, thread_id, from_addr, to_addr, cc, bcc, subject, body_text, body_html, direction, approved, status, agent_target, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'outbound', 1, 'sending', ?, ?)`
  ).bind(
    msgId, threadId, c.env.FROM_EMAIL, body.to,
    body.cc ?? '', body.bcc ?? '', subject,
    text, html,
    body.agent_id ?? null, now,
  ).run();

  const sendStatus = await sendEmail(c.env, {
    to: body.to, cc: body.cc, bcc: body.bcc,
    subject: subject, text: text, html: html,
    agentId: body.agent_id,
  });

  await c.env.DB.prepare(
    'UPDATE messages SET status = ? WHERE id = ?'
  ).bind(sendStatus, msgId).run();

  await fireWebhook(c.env, {
    event: 'message.sent',
    data: { id: msgId, thread_id: threadId, from: c.env.FROM_EMAIL, to: body.to, subject: subject, direction: 'outbound', approved: 1, agent_target: body.agent_id ?? null },
    timestamp: now,
  });

  return c.json({ id: msgId, thread_id: threadId, status: sendStatus }, 201);
});

// ─── List Messages ───────────────────────────────────────────────────────────

api.get('/messages', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');
  const direction = c.req.query('direction');
  const from = c.req.query('from');
  const label = c.req.query('label');
  const agent = c.req.query('agent');
  const includeArchived = c.req.query('include_archived') === 'true';

  let query = 'SELECT m.* FROM messages m';
  const conditions: string[] = ['m.approved = 1'];
  const binds: (string | number)[] = [];

  if (!includeArchived) {
    conditions.push('m.archived = 0');
  }
  if (direction) {
    conditions.push('m.direction = ?');
    binds.push(direction);
  }
  if (from) {
    conditions.push('m.from_addr = ?');
    binds.push(from);
  }
  if (agent) {
    conditions.push('m.agent_target = ?');
    binds.push(agent);
  }
  if (label) {
    query += ' JOIN message_labels ml ON m.id = ml.message_id JOIN labels l ON ml.label_id = l.id';
    conditions.push('l.name = ?');
    binds.push(label);
  }

  query += ` WHERE ${conditions.join(' AND ')} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);

  const stmt = c.env.DB.prepare(query);
  const { results } = await stmt.bind(...binds).all<MessageRow>();
  return c.json({ messages: results, limit, offset });
});

// ─── Read Message ────────────────────────────────────────────────────────────

api.get('/messages/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    'SELECT * FROM messages WHERE id = ? AND approved = 1'
  ).bind(id).first<MessageRow>();
  if (!row) return c.json({ error: 'Not found or not approved' }, 404);
  return c.json(row);
});

// ─── Reply ───────────────────────────────────────────────────────────────────

api.post('/messages/:id/reply', async (c) => {
  const originalId = c.req.param('id');
  const body = await c.req.json<ReplyRequest>();

  const original = await c.env.DB.prepare(
    'SELECT * FROM messages WHERE id = ?'
  ).bind(originalId).first<MessageRow>();
  if (!original) return c.json({ error: 'Original message not found' }, 404);

  // Outbound guard
  if (c.env.OUTBOUND_GUARD_ENABLED !== 'false') {
    const scan = scanOutbound(body.body_text, `Re: ${original.subject}`);
    if (!scan.passed) {
      return c.json({ error: 'Outbound guard blocked', violations: scan.violations }, 403);
    }
  }

  const replyId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const replyTo = original.direction === 'inbound' ? original.from_addr : original.to_addr;

  await c.env.DB.prepare(
    `INSERT INTO messages (id, thread_id, from_addr, to_addr, subject, body_text, body_html, direction, approved, status, agent_target, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'outbound', 1, 'sending', ?, ?)`
  ).bind(
    replyId, original.thread_id, c.env.FROM_EMAIL, replyTo,
    `Re: ${original.subject}`, body.body_text, body.body_html ?? '',
    body.agent_id ?? null, now,
  ).run();

  await c.env.DB.prepare(
    'UPDATE threads SET last_message_at = ?, message_count = message_count + 1 WHERE id = ?'
  ).bind(now, original.thread_id).run();

  // Send via Mailchannels (primary) or Resend (fallback)
  const replyStatus = await sendEmail(c.env, {
    to: replyTo,
    subject: `Re: ${original.subject}`,
    text: body.body_text, html: body.body_html,
  });
  await c.env.DB.prepare('UPDATE messages SET status = ? WHERE id = ?').bind(replyStatus, replyId).run();

  return c.json({ id: replyId, thread_id: original.thread_id }, 201);
});

// ─── Labels ──────────────────────────────────────────────────────────────────

api.post('/messages/:id/labels', async (c) => {
  const msgId = c.req.param('id');
  const { labels } = await c.req.json<AddLabelsRequest>();
  for (const name of labels) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO labels (name) VALUES (?)').bind(name).run();
    const label = await c.env.DB.prepare('SELECT id FROM labels WHERE name = ?').bind(name).first<{ id: number }>();
    if (label) {
      await c.env.DB.prepare('INSERT OR IGNORE INTO message_labels (message_id, label_id) VALUES (?, ?)').bind(msgId, label.id).run();
    }
  }
  return c.json({ ok: true });
});

api.delete('/messages/:id/labels/:label', async (c) => {
  const msgId = c.req.param('id');
  const labelName = c.req.param('label');
  const label = await c.env.DB.prepare('SELECT id FROM labels WHERE name = ?').bind(labelName).first<{ id: number }>();
  if (label) {
    await c.env.DB.prepare('DELETE FROM message_labels WHERE message_id = ? AND label_id = ?').bind(msgId, label.id).run();
  }
  return c.json({ ok: true });
});

// ─── Archive ─────────────────────────────────────────────────────────────────

api.post('/messages/:id/archive', async (c) => {
  await c.env.DB.prepare('UPDATE messages SET archived = 1 WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

api.post('/messages/:id/unarchive', async (c) => {
  await c.env.DB.prepare('UPDATE messages SET archived = 0 WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

// ─── Attachments ─────────────────────────────────────────────────────────────

api.get('/attachments/:id', async (c) => {
  const att = await c.env.DB.prepare('SELECT * FROM attachments WHERE id = ?').bind(c.req.param('id')).first<{ r2_key: string; content_type: string; filename: string }>();
  if (!att) return c.json({ error: 'Attachment not found' }, 404);
  if (!c.env.ATTACHMENTS) return c.json({ error: 'Attachment storage not configured' }, 503);
  const obj = await c.env.ATTACHMENTS.get(att.r2_key);
  if (!obj) return c.json({ error: 'Attachment blob missing' }, 404);
  return new Response(obj.body, {
    headers: { 'Content-Type': att.content_type, 'Content-Disposition': `attachment; filename="${att.filename}"` },
  });
});

// ─── Search ──────────────────────────────────────────────────────────────────

api.get('/search', async (c) => {
  const q = c.req.query('q');
  if (!q) return c.json({ error: 'Missing search query ?q=' }, 400);
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const includeArchived = c.req.query('include_archived') === 'true';

  let query = `
    SELECT m.* FROM messages m
    JOIN messages_fts fts ON m.rowid = fts.rowid
    WHERE messages_fts MATCH ? AND m.approved = 1`;
  if (!includeArchived) query += ' AND m.archived = 0';
  query += ' ORDER BY rank LIMIT ?';

  const { results } = await c.env.DB.prepare(query).bind(q, limit).all<MessageRow>();
  return c.json({ results, query: q });
});

// ─── Threads ─────────────────────────────────────────────────────────────────

api.get('/threads', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM threads ORDER BY last_message_at DESC LIMIT ? OFFSET ?'
  ).bind(limit, offset).all<ThreadRow>();
  return c.json({ threads: results, limit, offset });
});

api.get('/threads/:id', async (c) => {
  const threadId = c.req.param('id');
  const thread = await c.env.DB.prepare('SELECT * FROM threads WHERE id = ?').bind(threadId).first<ThreadRow>();
  if (!thread) return c.json({ error: 'Thread not found' }, 404);
  const { results: messages } = await c.env.DB.prepare(
    'SELECT * FROM messages WHERE thread_id = ? AND approved = 1 ORDER BY created_at ASC'
  ).bind(threadId).all<MessageRow>();
  return c.json({ ...thread, messages });
});

// ─── Drafts ──────────────────────────────────────────────────────────────────

api.get('/drafts', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM drafts WHERE status = 'draft' ORDER BY updated_at DESC LIMIT ? OFFSET ?"
  ).bind(limit, offset).all<DraftRow>();
  return c.json({ drafts: results, limit, offset });
});

api.post('/drafts', async (c) => {
  const body = await c.req.json<CreateDraftRequest>();
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    `INSERT INTO drafts (id, agent_id, to_addr, cc, bcc, subject, body_text, thread_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
  ).bind(id, body.agent_id ?? null, body.to ?? '', body.cc ?? '', body.bcc ?? '', body.subject ?? '', body.body_text ?? '', body.thread_id ?? null, now, now).run();
  return c.json({ id }, 201);
});

api.get('/drafts/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM drafts WHERE id = ?').bind(c.req.param('id')).first<DraftRow>();
  if (!row) return c.json({ error: 'Draft not found' }, 404);
  return c.json(row);
});

api.put('/drafts/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<CreateDraftRequest>();
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    `UPDATE drafts SET to_addr = COALESCE(?, to_addr), cc = COALESCE(?, cc), bcc = COALESCE(?, bcc),
     subject = COALESCE(?, subject), body_text = COALESCE(?, body_text), thread_id = COALESCE(?, thread_id), updated_at = ?
     WHERE id = ? AND status = 'draft'`
  ).bind(body.to ?? null, body.cc ?? null, body.bcc ?? null, body.subject ?? null, body.body_text ?? null, body.thread_id ?? null, now, id).run();
  return c.json({ ok: true });
});

api.post('/drafts/:id/send', async (c) => {
  const id = c.req.param('id');
  const draft = await c.env.DB.prepare("SELECT * FROM drafts WHERE id = ? AND status = 'draft'").bind(id).first<DraftRow>();
  if (!draft) return c.json({ error: 'Draft not found or already sent' }, 404);
  if (!draft.to_addr || !draft.subject) return c.json({ error: 'Draft missing to or subject' }, 400);

  // Outbound guard
  if (c.env.OUTBOUND_GUARD_ENABLED !== 'false') {
    const scan = scanOutbound(draft.body_text, draft.subject);
    if (!scan.passed) {
      return c.json({ error: 'Outbound guard blocked', violations: scan.violations }, 403);
    }
  }

  // Mark draft as sent
  await c.env.DB.prepare("UPDATE drafts SET status = 'sent', updated_at = ? WHERE id = ?").bind(Math.floor(Date.now() / 1000), id).run();

  // Actually send via the /send logic
  const sendResp = await api.request('/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': c.env.API_KEY },
    body: JSON.stringify({ to: draft.to_addr, cc: draft.cc, bcc: draft.bcc, subject: draft.subject, body_text: draft.body_text, thread_id: draft.thread_id }),
  }, c.env);

  return sendResp;
});

api.delete('/drafts/:id', async (c) => {
  await c.env.DB.prepare("UPDATE drafts SET status = 'discarded' WHERE id = ?").bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

// ─── Sender Approval ─────────────────────────────────────────────────────────

api.get('/pending', async (c) => {
  const results = await listPending(c.env.DB);
  return c.json({ pending: results });
});

api.post('/approved-senders', async (c) => {
  const body = await c.req.json<ApproveSenderRequest>();
  if (!body.email) return c.json({ error: 'Missing email' }, 400);
  const result = await approveSender(c.env.DB, body.email, body.name);
  return c.json({ ok: true, ...result });
});

api.delete('/approved-senders/:email', async (c) => {
  const removed = await removeSender(c.env.DB, c.req.param('email'));
  return c.json({ ok: removed });
});

api.get('/approved-senders', async (c) => {
  const senders = await listApprovedSenders(c.env.DB);
  return c.json({ senders });
});

// ─── Resend Webhook (delivery status updates) ────────────────────────────────

export const webhooks = new Hono<{ Bindings: Env }>();

webhooks.post('/resend', async (c) => {
  const token = c.req.query('token');
  if (!token || token !== c.env.RESEND_WEBHOOK_SECRET) {
    return c.json({ error: 'Invalid token' }, 401);
  }
  const payload = await c.req.json<{ type: string; data: { email_id?: string } }>();
  const statusMap: Record<string, string> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
  };
  const newStatus = statusMap[payload.type];
  if (newStatus && payload.data.email_id) {
    await c.env.DB.prepare('UPDATE messages SET status = ? WHERE id = ?').bind(newStatus, payload.data.email_id).run();
  }
  return c.json({ ok: true });
});

export default api;
