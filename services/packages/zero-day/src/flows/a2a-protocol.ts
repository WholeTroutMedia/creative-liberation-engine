/**
 * @module zero-day/flows/a2a-protocol
 * @description Agent-to-Agent (A2A) Protocol â€” standardised inter-agent message passing
 * for the ZERO DAY autonomous client operations system.
 *
 * Enables ZERO DAY agents to:
 *  1. Emit typed task hand-off messages to other AVERI agents
 *  2. Receive and acknowledge work assignments
 *  3. Report progress and completion with structured payloads
 *  4. Escalate blockers to human-in-the-loop (HILO) queue
 *
 * Connects to: CLE Dispatch Server (http://127.0.0.1:5150)
 * Task: T20260308-506 (HELIX A)
 * Standard: Google A2A draft spec (message-based)
 */
import { z } from 'zod';

// â”€â”€â”€ A2A Message Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const A2AMessageType = {
  TASK_REQUEST: 'task_request',
  TASK_ACCEPT: 'task_accept',
  TASK_DECLINE: 'task_decline',
  PROGRESS_UPDATE: 'progress_update',
  TASK_COMPLETE: 'task_complete',
  TASK_FAILED: 'task_failed',
  ESCALATE: 'escalate',
  HEARTBEAT: 'heartbeat',
  QUERY: 'query',
  QUERY_RESPONSE: 'query_response',
} as const;

export type A2AMessageType = typeof A2AMessageType[keyof typeof A2AMessageType];

// â”€â”€â”€ Base message schema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const A2AMessageSchema = z.object({
  /** Unique message ID (UUID v4) */
  id: z.string().uuid(),
  /** Protocol version */
  protocol: z.literal('a2a/1.0').default('a2a/1.0'),
  /** Message type */
  type: z.enum([
    'task_request', 'task_accept', 'task_decline',
    'progress_update', 'task_complete', 'task_failed',
    'escalate', 'heartbeat', 'query', 'query_response',
  ]),
  /** Sending agent ID */
  from: z.string(),
  /** Receiving agent ID or 'broadcast' */
  to: z.string(),
  /** ISO timestamp */
  sent_at: z.string(),
  /** Correlation ID for tracking message chains */
  correlation_id: z.string().uuid().optional(),
  /** Optional task ID this message is about */
  task_id: z.string().optional(),
  /** Message payload */
  payload: z.record(z.unknown()).default({}),
  /** Priority: 1 (critical) â†’ 5 (background) */
  priority: z.number().int().min(1).max(5).default(3),
  /** Time-to-live in seconds; 0 = no expiry */
  ttl: z.number().int().min(0).default(300),
  /** Whether this message requires acknowledgement */
  requires_ack: z.boolean().default(false),
});

export type A2AMessage = z.infer<typeof A2AMessageSchema>;

// â”€â”€â”€ Specialised payload schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const TaskRequestPayloadSchema = z.object({
  task_type: z.string(),
  description: z.string(),
  deadline_iso: z.string().optional(),
  inputs: z.record(z.unknown()).optional(),
  required_capabilities: z.array(z.string()).optional(),
});

export const ProgressUpdatePayloadSchema = z.object({
  pct_complete: z.number().min(0).max(100),
  current_step: z.string(),
  steps_total: z.number().int().optional(),
  steps_done: z.number().int().optional(),
  artifacts: z.array(z.string()).optional(),
});

export const TaskCompletePayloadSchema = z.object({
  result: z.record(z.unknown()),
  artifacts: z.array(z.string()).optional(),
  duration_ms: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const EscalatePayloadSchema = z.object({
  reason: z.string(),
  blocker_type: z.enum(['auth_required', 'human_decision', 'resource_unavailable', 'policy_violation', 'unknown']),
  context: z.record(z.unknown()).optional(),
  proposed_resolution: z.string().optional(),
});

// â”€â”€â”€ Message factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let _msgCounter = 0;

function newId(): string {
  _msgCounter++;
  // Use crypto.randomUUID() if available (Node 14.17+), fall back to RFC4122 template
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Build a typed A2A message, adding id + sent_at automatically. */
export function buildMessage(
  type: A2AMessageType,
  from: string,
  to: string,
  payload: Record<string, unknown>,
  opts: {
    task_id?: string;
    correlation_id?: string;
    priority?: number;
    ttl?: number;
    requires_ack?: boolean;
  } = {}
): A2AMessage {
  return A2AMessageSchema.parse({
    id: newId(),
    protocol: 'a2a/1.0',
    type,
    from,
    to,
    sent_at: new Date().toISOString(),
    payload,
    ...opts,
  });
}

// â”€â”€â”€ A2A Client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface A2AClientConfig {
  agentId: string;
  dispatchUrl?: string;
  /** How long to wait for acknowledgement (ms). Default 10_000. */
  ackTimeoutMs?: number;
}

export interface SendResult {
  message_id: string;
  delivered: boolean;
  ack_received: boolean;
  latency_ms?: number;
}

export interface A2ATask {
  task_id: string;
  type: string;
  description: string;
  inputs?: Record<string, unknown>;
  required_capabilities?: string[];
  deadline_iso?: string;
}

/**
 * A2AClient â€” sends and receives A2A protocol messages via the CLE Dispatch Server.
 *
 * @example
 * const client = new A2AClient({ agentId: 'ZERO_DAY', dispatchUrl: 'http://127.0.0.1:5150' });
 * const result = await client.requestTask('AURORA', { task_type: 'generate_image', description: 'Hero shot' });
 */
export class A2AClient {
  private readonly config: Required<A2AClientConfig>;
  private readonly outbox: A2AMessage[] = [];
  private readonly inbox: A2AMessage[] = [];
  private readonly handlers = new Map<A2AMessageType, Array<(msg: A2AMessage) => void>>();

  constructor(config: A2AClientConfig) {
    this.config = {
      agentId: config.agentId,
      dispatchUrl: config.dispatchUrl ?? 'http://127.0.0.1:5150',
      ackTimeoutMs: config.ackTimeoutMs ?? 10_000,
    };
  }

  // â”€â”€ Sending â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** Request a task from another agent */
  async requestTask(toAgentId: string, task: A2ATask): Promise<SendResult> {
    const payload = TaskRequestPayloadSchema.parse({
      task_type: task.type,
      description: task.description,
      inputs: task.inputs,
      required_capabilities: task.required_capabilities,
      deadline_iso: task.deadline_iso,
    });

    const msg = buildMessage(
      A2AMessageType.TASK_REQUEST,
      this.config.agentId,
      toAgentId,
      payload as Record<string, unknown>,
      { task_id: task.task_id, priority: 2, requires_ack: true }
    );

    return this._send(msg);
  }

  /** Accept an incoming task request */
  acceptTask(taskId: string, toAgentId: string): A2AMessage {
    return buildMessage(
      A2AMessageType.TASK_ACCEPT,
      this.config.agentId,
      toAgentId,
      { task_id: taskId, accepted_at: new Date().toISOString() },
      { task_id: taskId }
    );
  }

  /** Report progress on a running task */
  progress(taskId: string, toAgentId: string, update: z.infer<typeof ProgressUpdatePayloadSchema>): A2AMessage {
    return buildMessage(
      A2AMessageType.PROGRESS_UPDATE,
      this.config.agentId,
      toAgentId,
      ProgressUpdatePayloadSchema.parse(update) as Record<string, unknown>,
      { task_id: taskId }
    );
  }

  /** Report successful task completion */
  complete(taskId: string, toAgentId: string, payload: z.infer<typeof TaskCompletePayloadSchema>): A2AMessage {
    return buildMessage(
      A2AMessageType.TASK_COMPLETE,
      this.config.agentId,
      toAgentId,
      TaskCompletePayloadSchema.parse(payload) as Record<string, unknown>,
      { task_id: taskId, priority: 2 }
    );
  }

  /** Escalate a blocker to human-in-the-loop */
  escalate(taskId: string, toAgentId: string, reason: z.infer<typeof EscalatePayloadSchema>): A2AMessage {
    return buildMessage(
      A2AMessageType.ESCALATE,
      this.config.agentId,
      toAgentId,
      EscalatePayloadSchema.parse(reason) as Record<string, unknown>,
      { task_id: taskId, priority: 1, requires_ack: true }
    );
  }

  /** Emit a heartbeat to the dispatch server */
  heartbeat(): A2AMessage {
    return buildMessage(
      A2AMessageType.HEARTBEAT,
      this.config.agentId,
      'dispatch',
      { status: 'alive', queue_depth: this.outbox.length }
    );
  }

  // â”€â”€ Receiving â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€-

  /** Register a handler for incoming messages of a specific type */
  on(type: A2AMessageType, handler: (msg: A2AMessage) => void): this {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
    return this;
  }

  /** Process an incoming message (called when a message arrives from transport) */
  receive(raw: unknown): void {
    try {
      const msg = A2AMessageSchema.parse(raw);
      this.inbox.push(msg);
      const handlers = this.handlers.get(msg.type as A2AMessageType) ?? [];
      for (const h of handlers) h(msg);
    } catch (err) {
      console.error('[A2AClient] invalid message received:', err);
    }
  }

  /** Drain the inbox (returns all pending messages and clears) */
  drainInbox(): A2AMessage[] {
    return this.inbox.splice(0);
  }

  // â”€â”€ Transport â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async _send(msg: A2AMessage): Promise<SendResult> {
    const start = Date.now();
    this.outbox.push(msg);

    try {
      const resp = await fetch(`${this.config.dispatchUrl}/api/a2a/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
        signal: AbortSignal.timeout(this.config.ackTimeoutMs),
      });

      const latency_ms = Date.now() - start;
      const ok = resp.ok;

      return {
        message_id: msg.id,
        delivered: ok,
        ack_received: ok && msg.requires_ack,
        latency_ms,
      };
    } catch {
      // Dispatch server offline â€” queue for retry
      return {
        message_id: msg.id,
        delivered: false,
        ack_received: false,
        latency_ms: Date.now() - start,
      };
    }
  }

  /** Get outbox depth (messages waiting to be delivered) */
  outboxDepth(): number {
    return this.outbox.length;
  }

  /** Clear sent messages from outbox */
  clearOutbox(): void {
    this.outbox.length = 0;
  }
}

// â”€â”€â”€ Singleton factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const _clients = new Map<string, A2AClient>();

/** Get or create a singleton A2AClient for the given agent. */
export function getA2AClient(agentId: string, dispatchUrl?: string): A2AClient {
  if (!_clients.has(agentId)) {
    _clients.set(agentId, new A2AClient({ agentId, dispatchUrl }));
  }
  return _clients.get(agentId)!;
}

// â”€â”€â”€ MCP Tool descriptors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const SendTaskRequestSchema = z.object({
  from_agent: z.string().describe('Sending agent ID (e.g. ZERO_DAY)'),
  to_agent: z.string().describe('Receiving agent ID (e.g. AURORA)'),
  task_id: z.string().describe('Dispatch task ID'),
  task_type: z.string().describe('Task classification (e.g. generate_image, run_qa)'),
  description: z.string().describe('Human-readable task description'),
  inputs: z.record(z.unknown()).optional().describe('Input parameters for the receiving agent'),
  required_capabilities: z.array(z.string()).optional(),
  deadline_iso: z.string().optional(),
});

export const A2A_TOOLS = [
  {
    name: 'a2a_send_task_request',
    description: 'Send an A2A task request from one agent to another via the CLE Dispatch Server.',
    inputSchema: SendTaskRequestSchema,
    handler: async (args: z.infer<typeof SendTaskRequestSchema>) => {
      const client = getA2AClient(args.from_agent);
      return client.requestTask(args.to_agent, {
        task_id: args.task_id,
        type: args.task_type,
        description: args.description,
        inputs: args.inputs,
        required_capabilities: args.required_capabilities,
        deadline_iso: args.deadline_iso,
      });
    },
    agentPermissions: ['ZERO_DAY', 'KEEPER', 'IRIS', 'VERA', 'ATHENA', 'AURORA'],
    estimatedCost: 'Free',
  },
  {
    name: 'a2a_send_heartbeat',
    description: 'Emit a heartbeat message from the specified agent to the dispatch server.',
    inputSchema: z.object({ agent_id: z.string() }),
    handler: ({ agent_id }: { agent_id: string }) => {
      const client = getA2AClient(agent_id);
      return client.heartbeat();
    },
    agentPermissions: ['*'],
    estimatedCost: 'Free',
  },
  {
    name: 'a2a_escalate',
    description: 'Escalate a blocker from an agent to the human-in-the-loop queue via A2A protocol.',
    inputSchema: z.object({
      from_agent: z.string(),
      task_id: z.string(),
      reason: z.string(),
      blocker_type: EscalatePayloadSchema.shape.blocker_type,
      proposed_resolution: z.string().optional(),
    }),
    handler: async (args: any) => {
      const client = getA2AClient(args.from_agent);
      return client.escalate(args.task_id, 'HILO', {
        reason: args.reason,
        blocker_type: args.blocker_type,
        proposed_resolution: args.proposed_resolution,
      });
    },
    agentPermissions: ['*'],
    estimatedCost: 'Free',
  },
];
