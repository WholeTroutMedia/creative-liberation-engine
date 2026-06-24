/**
 * CLE Agent Mail — Shared Types
 *
 * Core interfaces for the sovereign agent email service.
 * Includes MembraneMessage normalization schema for future multi-channel support.
 */

// ─── Cloudflare Bindings ─────────────────────────────────────────────────────

export interface Env {
  DB: D1Database;
  ATTACHMENTS?: R2Bucket;
  MCP_AGENT?: DurableObjectNamespace;
  API_KEY: string;
  MAILCHANNELS_API_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FROM_NAME?: string;
  RESEND_REPLY_TO_EMAIL?: string;
  WEBHOOK_URL?: string;
  WEBHOOK_SECRET?: string;
  RESEND_WEBHOOK_SECRET?: string;
  FROM_EMAIL: string;
  FROM_NAME: string;
  OUTBOUND_GUARD_ENABLED?: string;
  ENVIRONMENT?: string;
  EMAIL_PROVIDER?: string;
  SEND_EMAIL?: {
    send(message: {
      to: string | { email: string; name?: string } | (string | { email: string; name?: string })[];
      from: string | { email: string; name?: string };
      subject: string;
      text: string;
      html?: string;
      cc?: string | { email: string; name?: string } | (string | { email: string; name?: string })[];
      bcc?: string | { email: string; name?: string } | (string | { email: string; name?: string })[];
      replyTo?: string | { email: string; name?: string };
    }): Promise<void>;
  };
}

// ─── Database Row Types ──────────────────────────────────────────────────────

export interface MessageRow {
  id: string;
  thread_id: string;
  from_addr: string;
  to_addr: string;
  cc: string;
  bcc: string;
  subject: string;
  body_text: string;
  body_html: string;
  direction: 'inbound' | 'outbound';
  approved: number; // 0 | 1
  status: string;
  agent_target: string | null;
  archived: number; // 0 | 1
  created_at: number;
}

export interface ThreadRow {
  id: string;
  subject: string;
  last_message_at: number;
  message_count: number;
}

export interface AttachmentRow {
  id: string;
  message_id: string;
  filename: string;
  content_type: string;
  size: number;
  r2_key: string;
}

export interface LabelRow {
  id: number;
  name: string;
}

export interface ApprovedSenderRow {
  email: string;
  name: string;
  approved_at: number;
  approved_by: string;
}

export interface DraftRow {
  id: string;
  agent_id: string | null;
  to_addr: string;
  cc: string;
  bcc: string;
  subject: string;
  body_text: string;
  thread_id: string | null;
  status: 'draft' | 'sent' | 'discarded';
  created_at: number;
  updated_at: number;
}

// ─── API Request/Response Types ──────────────────────────────────────────────

export interface SendEmailRequest {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body_text: string;
  body_html?: string;
  thread_id?: string;
  agent_id?: string;
}

export interface ReplyRequest {
  body_text: string;
  body_html?: string;
  agent_id?: string;
}

export interface CreateDraftRequest {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body_text?: string;
  thread_id?: string;
  agent_id?: string;
}

export interface ApproveSenderRequest {
  email: string;
  name?: string;
}

export interface AddLabelsRequest {
  labels: string[];
}

export interface MessageListQuery {
  limit?: number;
  offset?: number;
  direction?: 'inbound' | 'outbound';
  from?: string;
  label?: string;
  agent?: string;
  include_archived?: boolean;
}

export interface SearchQuery {
  q: string;
  limit?: number;
  include_archived?: boolean;
}

// ─── Webhook Types ───────────────────────────────────────────────────────────

export interface WebhookPayload {
  event: 'message.received' | 'message.sent' | 'sender.approved';
  data: {
    id: string;
    thread_id: string;
    from: string;
    to: string;
    subject: string;
    direction: string;
    approved: number;
    agent_target: string | null;
  };
  timestamp: number;
}

// ─── MembraneMessage (Multi-Channel Normalization) ───────────────────────────

export type MembraneChannel = 'email' | 'sms' | 'telegram' | 'slack';
export type ApprovalStatus = 'pending' | 'approved' | 'blocked';

/**
 * Normalized message format for all communication channels.
 * Email is the first adapter. Future: SMS, Telegram, Slack.
 * Agents interact with this schema — never raw email headers.
 */
export interface MembraneMessage {
  id: string;
  channel: MembraneChannel;
  sender: string;
  recipient: string;
  subject?: string;
  body: string;
  attachments: MembraneAttachment[];
  approvalStatus: ApprovalStatus;
  agentTarget?: string;
  threadId?: string;
  labels: string[];
  timestamp: string; // ISO 8601
  metadata: Record<string, string>;
}

export interface MembraneAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string; // R2 presigned URL or inline reference
}

// ─── Creative Liberation Engine Agent Routing ──────────────────────────────────────────

/**
 * Full Creative Liberation Engine v5 agent roster.
 * Every agent listed here gets a live inbox at @cleengine.systems.
 * Source of truth: packages/genkit/src/flows/ + apps/console/src/pages/AgentCatalog.tsx
 */
export const CLE_AGENTS = [
  // ── AVERI Leadership ──────────────────────────────────────────────────────
  'athena', 'vera', 'iris',

  // ── Hive AURORA (design, frontend, backend, commerce) ────────────────────
  'aurora', 'bolt', 'comet', 'commerce', 'browser', 'alfred', 'creative-director',

  // ── Hive LEX (constitutional, compliance, contracts) ─────────────────────
  'lex', 'compass', 'archon',

  // ── Hive KEEPER (knowledge, memory, search) ───────────────────────────────
  'keeper', 'arch', 'echo', 'codex', 'scribe',

  // ── Hive BROADCAST (live production, content, publishing) ─────────────────
  'atlas', 'control-room', 'showrunner', 'signal', 'graphics', 'studio',
  'systems', 'director', 'herald', 'sigma', 'mosaic',

  // ── Hive SWITCHBOARD (ops, infra, routing, AI ops) ────────────────────────
  'switchboard', 'relay', 'ram-crew', 'forge', 'beacon', 'prism', 'flux',
  'nexus', 'bridge',

  // ── Hive SPECIALIST (generative media) ────────────────────────────────────
  'gen', 'veo', 'lyra', 'blender', 'vfx', 'omni', 'geomind', 'hunyuan',

  // ── Hive COMPASS / VALIDATOR (QA, security, compliance) ───────────────────
  'ghost', 'auditor', 'sentinel', 'proof', 'harbor',

  // ── Hive ENHANCEMENT (self-optimisation, learning) ────────────────────────
  'optimus', 'mentor',

  // ── Enhancement LoRA layers (addressable for fine-tune coordination) ──────
  'audio', 'vision', 'syntax', 'sift', 'spatial',

  // ── Specialist flows & councils ───────────────────────────────────────────
  'oracle', 'sage', 'finance', 'homebuilder', 'archaeon', 'continuity',
  'zero-day',

  // ── AVERI sub-agents ──────────────────────────────────────────────────────
  'averi', 'averi-1', 'averi-2',

  // ── Hive sub-agents (numbered) ────────────────────────────────────────────
  'lex-1', 'lex-2',
  'keeper-1', 'keeper-2', 'keeper-3', 'keeper-4', 'keeper-5',
] as const;

export type CLEAgentName = typeof CLE_AGENTS[number];
/** @deprecated use CLEAgentName */
export type CleAgentName = CLEAgentName;

/**
 * Extract agent name from email address.
 * e.g., "athena@cleengine.systems" → "athena"
 * e.g., "ram-crew@cleengine.systems" → "ram-crew"
 */
export function parseAgentTarget(toAddress: string): CLEAgentName | null {
  const localPart = toAddress.split('@')[0]?.toLowerCase();
  if (!localPart) return null;
  return CLE_AGENTS.includes(localPart as CLEAgentName)
    ? (localPart as CLEAgentName)
    : null;
}

// ─── Outbound Guard ──────────────────────────────────────────────────────────

export interface OutboundScanResult {
  passed: boolean;
  violations: string[];
}

// ─── Agent Identity (per-agent from address) ─────────────────────────────────

/** Display names for agents that have a distinct persona */
const AGENT_DISPLAY_NAMES: Partial<Record<CLEAgentName | 'averi', string>> = {
  averi:              'AVERI',
  athena:             'ATHENA',
  vera:               'VERA',
  iris:               'IRIS',
  aurora:             'Aurora',
  bolt:               'BOLT',
  comet:              'COMET',
  commerce:           'COMMERCE',
  browser:            'BROWSER',
  alfred:             'ALFRED',
  'creative-director':'DIRECTOR',
  lex:                'LEX',
  compass:            'COMPASS',
  archon:             'ARCHON',
  keeper:             'KEEPER',
  arch:               'ARCH',
  echo:               'ECHO',
  codex:              'CODEX',
  scribe:             'SCRIBE',
  atlas:              'ATLAS',
  'control-room':     'CONTROL ROOM',
  showrunner:         'SHOWRUNNER',
  signal:             'SIGNAL',
  graphics:           'GRAPHICS',
  studio:             'STUDIO',
  systems:            'SYSTEMS',
  director:           'DIRECTOR',
  herald:             'HERALD',
  sigma:              'SIGMA',
  mosaic:             'MOSAIC',
  switchboard:        'SWITCHBOARD',
  relay:              'RELAY',
  'ram-crew':         'RAM CREW',
  forge:              'FORGE',
  beacon:             'BEACON',
  prism:              'PRISM',
  flux:               'FLUX',
  nexus:              'NEXUS',
  bridge:             'BRIDGE',
  ghost:              'GHOST',
  auditor:            'AUDITOR',
  sentinel:           'SENTINEL',
  proof:              'PROOF',
  harbor:             'HARBOR',
  optimus:            'OPTIMUS',
  mentor:             'MENTOR',
  oracle:             'ORACLE',
  sage:               'SAGE',
  archaeon:           'ARCHAEON',
};

export interface AgentSender {
  email: string;
  name: string;
}

/**
 * Resolve a sender identity from an agent_id.
 * Returns the agent's own @cleengine.systems address and display name.
 * Falls back to the system FROM_EMAIL if agent is unknown.
 */
export function resolveAgentSender(
  agentId: string | null | undefined,
  systemEmail: string,
  systemName: string,
): AgentSender {
  if (!agentId) return { email: systemEmail, name: systemName };
  const name = AGENT_DISPLAY_NAMES[agentId as CLEAgentName] ?? agentId.toUpperCase();
  const domain = systemEmail.split('@')[1] ?? 'cleengine.systems';
  return { email: `${agentId}@${domain}`, name };
}
