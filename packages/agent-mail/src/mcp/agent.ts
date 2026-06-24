/**
 * CLE Agent Mail — MCP Server (Durable Object)
 *
 * Exposes 20 MCP tools via Streamable HTTP transport at /mcp.
 * Runs as a Cloudflare Durable Object.
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env, MessageRow, DraftRow } from '../types';
import { parseAgentTarget } from '../types';
import { approveSender, removeSender, listApprovedSenders, listPending } from '../security/sender-gate';
import { scanOutbound } from '../security/outbound-guard';
import { dispatchInboundTask } from '../dispatch/webhook';

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
}

type ToolHandler = (params: Record<string, unknown>) => Promise<ToolResult>;

/**
 * MCP Agent Durable Object — exposes tools as JSON-RPC over HTTP.
 * Simple Streamable HTTP server (no framework dependency on `agents` SDK).
 */
export class McpAgent extends DurableObject<Env> {

  private tools: Map<string, { description: string; handler: ToolHandler }> = new Map();

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.registerTools();
  }

  private registerTools(): void {
    // ─── Email Tools ─────────────────────────────────────────────
    this.tools.set('send_email', {
      description: 'Send an email from this agent',
      handler: async (params) => {
        const { to, subject, body_text, body_html, cc, bcc, agent_id } = params as {
          to: string; subject: string; body_text: string; body_html?: string; cc?: string; bcc?: string; agent_id?: string;
        };
        if (this.env.OUTBOUND_GUARD_ENABLED !== 'false') {
          const scan = scanOutbound(body_text, subject);
          if (!scan.passed) return this.text(`BLOCKED by outbound guard: ${scan.violations.join(', ')}`);
        }
        const id = crypto.randomUUID();
        const threadId = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);
        await this.env.DB.prepare('INSERT INTO threads (id, subject, last_message_at, message_count) VALUES (?, ?, ?, 1)').bind(threadId, subject, now).run();
        await this.env.DB.prepare(
          `INSERT INTO messages (id, thread_id, from_addr, to_addr, cc, bcc, subject, body_text, body_html, direction, approved, status, agent_target, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'outbound', 1, 'sending', ?, ?)`
        ).bind(id, threadId, this.env.FROM_EMAIL, to, cc ?? '', bcc ?? '', subject, body_text, body_html ?? '', agent_id ?? null, now).run();
        if (this.env.RESEND_API_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: this.env.FROM_EMAIL, to, subject, text: body_text, html: body_html }),
          });
        }
        await this.env.DB.prepare('UPDATE messages SET status = ? WHERE id = ?').bind('sent', id).run();
        return this.text(`Email sent. ID: ${id}, Thread: ${threadId}`);
      },
    });

    this.tools.set('list_messages', {
      description: 'List email messages (only approved messages returned)',
      handler: async (params) => {
        const limit = Math.min((params.limit as number) ?? 20, 100);
        const direction = params.direction as string | undefined;
        const agent = params.agent as string | undefined;
        let query = 'SELECT id, from_addr, to_addr, subject, direction, status, agent_target, created_at FROM messages WHERE approved = 1 AND archived = 0';
        const binds: (string | number)[] = [];
        if (direction) { query += ' AND direction = ?'; binds.push(direction); }
        if (agent) { query += ' AND agent_target = ?'; binds.push(agent); }
        query += ' ORDER BY created_at DESC LIMIT ?';
        binds.push(limit);
        const { results } = await this.env.DB.prepare(query).bind(...binds).all();
        return this.text(JSON.stringify(results, null, 2));
      },
    });

    this.tools.set('read_message', {
      description: 'Read full content of a specific message (must be approved)',
      handler: async (params) => {
        const row = await this.env.DB.prepare('SELECT * FROM messages WHERE id = ? AND approved = 1').bind(params.id as string).first<MessageRow>();
        if (!row) return this.text('Message not found or not approved');
        return this.text(JSON.stringify(row, null, 2));
      },
    });

    this.tools.set('reply_to_message', {
      description: 'Reply to a message',
      handler: async (params) => {
        const { id, body_text, agent_id } = params as { id: string; body_text: string; agent_id?: string };
        const original = await this.env.DB.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first<MessageRow>();
        if (!original) return this.text('Original not found');
        if (this.env.OUTBOUND_GUARD_ENABLED !== 'false') {
          const scan = scanOutbound(body_text, `Re: ${original.subject}`);
          if (!scan.passed) return this.text(`BLOCKED: ${scan.violations.join(', ')}`);
        }
        const replyId = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);
        const replyTo = original.direction === 'inbound' ? original.from_addr : original.to_addr;
        await this.env.DB.prepare(
          `INSERT INTO messages (id, thread_id, from_addr, to_addr, subject, body_text, direction, approved, status, agent_target, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'outbound', 1, 'sent', ?, ?)`
        ).bind(replyId, original.thread_id, this.env.FROM_EMAIL, replyTo, `Re: ${original.subject}`, body_text, agent_id ?? null, now).run();
        return this.text(`Reply sent. ID: ${replyId}`);
      },
    });

    this.tools.set('search_messages', {
      description: 'Full-text search across all approved messages',
      handler: async (params) => {
        const { results } = await this.env.DB.prepare(
          `SELECT m.id, m.from_addr, m.subject, m.created_at FROM messages m
           JOIN messages_fts fts ON m.rowid = fts.rowid
           WHERE messages_fts MATCH ? AND m.approved = 1 ORDER BY rank LIMIT ?`
        ).bind(params.query as string, (params.limit as number) ?? 20).all();
        return this.text(JSON.stringify(results, null, 2));
      },
    });

    this.tools.set('list_threads', {
      description: 'List email threads',
      handler: async (params) => {
        const { results } = await this.env.DB.prepare('SELECT * FROM threads ORDER BY last_message_at DESC LIMIT ?').bind((params.limit as number) ?? 20).all();
        return this.text(JSON.stringify(results, null, 2));
      },
    });

    this.tools.set('get_attachment', {
      description: 'Get attachment info by ID',
      handler: async (params) => {
        const att = await this.env.DB.prepare('SELECT * FROM attachments WHERE id = ?').bind(params.id as string).first<{ r2_key: string; filename: string }>();
        if (!att) return this.text('Attachment not found');
        return this.text(`Attachment: ${att.filename} (use REST /api/attachments/${params.id as string} to download)`);
      },
    });

    // ─── Label Tools ─────────────────────────────────────────────
    this.tools.set('add_labels', {
      description: 'Add labels to a message',
      handler: async (params) => {
        const { message_id, labels } = params as { message_id: string; labels: string[] };
        for (const name of labels) {
          await this.env.DB.prepare('INSERT OR IGNORE INTO labels (name) VALUES (?)').bind(name).run();
          const l = await this.env.DB.prepare('SELECT id FROM labels WHERE name = ?').bind(name).first<{ id: number }>();
          if (l) await this.env.DB.prepare('INSERT OR IGNORE INTO message_labels (message_id, label_id) VALUES (?, ?)').bind(message_id, l.id).run();
        }
        return this.text(`Labels added: ${labels.join(', ')}`);
      },
    });

    this.tools.set('remove_label', {
      description: 'Remove a label from a message',
      handler: async (params) => {
        const { message_id, label } = params as { message_id: string; label: string };
        const l = await this.env.DB.prepare('SELECT id FROM labels WHERE name = ?').bind(label).first<{ id: number }>();
        if (l) await this.env.DB.prepare('DELETE FROM message_labels WHERE message_id = ? AND label_id = ?').bind(message_id, l.id).run();
        return this.text(`Label removed: ${label}`);
      },
    });

    // ─── Draft Tools ─────────────────────────────────────────────
    this.tools.set('create_draft', {
      description: 'Create an email draft for human review',
      handler: async (params) => {
        const id = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);
        await this.env.DB.prepare(
          `INSERT INTO drafts (id, agent_id, to_addr, subject, body_text, thread_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
        ).bind(id, (params.agent_id as string) ?? null, (params.to as string) ?? '', (params.subject as string) ?? '', (params.body_text as string) ?? '', (params.thread_id as string) ?? null, now, now).run();
        return this.text(`Draft created. ID: ${id}. Awaiting human review.`);
      },
    });

    this.tools.set('update_draft', {
      description: 'Update an existing draft',
      handler: async (params) => {
        const now = Math.floor(Date.now() / 1000);
        await this.env.DB.prepare(
          `UPDATE drafts SET to_addr = COALESCE(?, to_addr), subject = COALESCE(?, subject), body_text = COALESCE(?, body_text), updated_at = ? WHERE id = ? AND status = 'draft'`
        ).bind((params.to as string) ?? null, (params.subject as string) ?? null, (params.body_text as string) ?? null, now, params.id as string).run();
        return this.text(`Draft ${params.id as string} updated`);
      },
    });

    this.tools.set('list_drafts', {
      description: 'List all pending drafts',
      handler: async (params) => {
        const { results } = await this.env.DB.prepare("SELECT * FROM drafts WHERE status = 'draft' ORDER BY updated_at DESC LIMIT ?").bind((params.limit as number) ?? 20).all();
        return this.text(JSON.stringify(results, null, 2));
      },
    });

    this.tools.set('send_draft', {
      description: 'Send a draft (HITL approval point)',
      handler: async (params) => {
        const draft = await this.env.DB.prepare("SELECT * FROM drafts WHERE id = ? AND status = 'draft'").bind(params.id as string).first<DraftRow>();
        if (!draft) return this.text('Draft not found or already sent');
        if (this.env.OUTBOUND_GUARD_ENABLED !== 'false') {
          const scan = scanOutbound(draft.body_text, draft.subject);
          if (!scan.passed) return this.text(`BLOCKED: ${scan.violations.join(', ')}`);
        }
        await this.env.DB.prepare("UPDATE drafts SET status = 'sent', updated_at = ? WHERE id = ?").bind(Math.floor(Date.now() / 1000), params.id as string).run();
        return this.text(`Draft ${params.id as string} sent`);
      },
    });

    this.tools.set('delete_draft', {
      description: 'Discard a draft',
      handler: async (params) => {
        await this.env.DB.prepare("UPDATE drafts SET status = 'discarded' WHERE id = ?").bind(params.id as string).run();
        return this.text(`Draft ${params.id as string} discarded`);
      },
    });

    // ─── Archive Tools ───────────────────────────────────────────
    this.tools.set('archive_message', {
      description: 'Archive a message',
      handler: async (params) => {
        await this.env.DB.prepare('UPDATE messages SET archived = 1 WHERE id = ?').bind(params.id as string).run();
        return this.text(`Message ${params.id as string} archived`);
      },
    });

    this.tools.set('unarchive_message', {
      description: 'Unarchive a message',
      handler: async (params) => {
        await this.env.DB.prepare('UPDATE messages SET archived = 0 WHERE id = ?').bind(params.id as string).run();
        return this.text(`Message ${params.id as string} unarchived`);
      },
    });

    // ─── Sender Approval Tools ───────────────────────────────────
    this.tools.set('list_pending', {
      description: 'List unapproved inbound messages (metadata only)',
      handler: async () => {
        const results = await listPending(this.env.DB);
        return this.text(JSON.stringify(results, null, 2));
      },
    });

    this.tools.set('approve_sender', {
      description: 'Approve a sender (retroactively approves all messages)',
      handler: async (params) => {
        const result = await approveSender(this.env.DB, params.email as string, params.name as string | undefined);
        return this.text(`Sender ${params.email as string} approved. ${result.approvedCount} messages retroactively approved.`);
      },
    });

    this.tools.set('remove_sender', {
      description: 'Remove a sender from approved list',
      handler: async (params) => {
        await removeSender(this.env.DB, params.email as string);
        return this.text(`Sender ${params.email as string} removed`);
      },
    });

    this.tools.set('list_approved_senders', {
      description: 'List all approved senders',
      handler: async () => {
        const senders = await listApprovedSenders(this.env.DB);
        return this.text(JSON.stringify(senders, null, 2));
      },
    });

    // ─── CLE-Specific Tools ─────────────────────────────────────
    this.tools.set('route_to_agent', {
      description: 'Route an inbound message to a specific CLE agent',
      handler: async (params) => {
        await this.env.DB.prepare('UPDATE messages SET agent_target = ? WHERE id = ?').bind((params.agent as string).toLowerCase(), params.message_id as string).run();
        return this.text(`Message ${params.message_id as string} routed to ${params.agent as string}`);
      },
    });

    this.tools.set('dispatch_as_task', {
      description: 'Convert an inbound email into a CLE dispatch task',
      handler: async (params) => {
        const msg = await this.env.DB.prepare('SELECT * FROM messages WHERE id = ?').bind(params.message_id as string).first<MessageRow>();
        if (!msg) return this.text('Message not found');
        await dispatchInboundTask(this.env, { id: msg.id, thread_id: msg.thread_id, from: msg.from_addr, to: msg.to_addr, subject: msg.subject, agent_target: msg.agent_target });
        return this.text(`Dispatch task created from message ${params.message_id as string}`);
      },
    });

    this.tools.set('scan_outbound', {
      description: 'Scan text for PII/credentials before sending (dry-run)',
      handler: async (params) => {
        const result = scanOutbound(params.text as string, params.subject as string | undefined);
        if (result.passed) return this.text('CLEAN — no PII or credentials detected');
        return this.text(`BLOCKED — violations: ${result.violations.join(', ')}`);
      },
    });
  }

  private text(t: string): ToolResult {
    return { content: [{ type: 'text', text: t }] };
  }

  // ─── HTTP Handler (Streamable HTTP MCP) ─────────────────────────
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Auth check
    const apiKey = request.headers.get('X-API-Key') ?? request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!apiKey || apiKey !== this.env.API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'GET') {
      // Return tool listing
      const toolList = Array.from(this.tools.entries()).map(([name, { description }]) => ({ name, description }));
      return new Response(JSON.stringify({ tools: toolList }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'POST') {
      const body = await request.json() as { method?: string; params?: { name?: string; arguments?: Record<string, unknown> }; id?: string | number };

      // JSON-RPC style: tools/call
      if (body.method === 'tools/call' && body.params?.name) {
        const tool = this.tools.get(body.params.name);
        if (!tool) {
          return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `Unknown tool: ${body.params.name}` } }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const result = await tool.handler(body.params.arguments ?? {});
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { headers: { 'Content-Type': 'application/json' } });
      }

      // tools/list
      if (body.method === 'tools/list') {
        const toolList = Array.from(this.tools.entries()).map(([name, { description }]) => ({
          name, description, inputSchema: { type: 'object' },
        }));
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { tools: toolList } }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // initialize
      if (body.method === 'initialize') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0', id: body.id,
          result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'CLE Agent Mail', version: '0.1.0' } },
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method Not Allowed', { status: 405 });
  }
}
