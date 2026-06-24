/**
 * AVERI Invoke — Mobile Sovereignty Gateway
 * Wave 37 / Helix B
 *
 * Unified dispatch-aware invocation for the AVERI trinity:
 *   ATHENA — strategic overview from dispatch + handoff status
 *   VERA   — memory context retrieval from ChromaDB
 *   IRIS   — task creation + blocker filing in dispatch queue
 *
 * Route: POST /averi/invoke
 *
 * Constitutional: Article VIII (Agent Identity), Article XX (Zero Wait)
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import { scribeRecall } from '../memory/scribe.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const ContextSchema = z.object({
  tabs: z.array(z.object({ url: z.string(), title: z.string() })).optional(),
  signal: z.string().describe('Free-form context from caller (voice transcript, note, etc.)'),
  location: z.enum(['desktop', 'mobile']).optional().default('mobile'),
  workstream: z.string().optional(),
});

const AveriInvokeInputSchema = z.object({
  intent: z.enum(['IDEATE', 'STATUS', 'DISPATCH', 'MEMORY']).describe(
    'IDEATE = creative brainstorm, STATUS = engine health check, DISPATCH = create/manage tasks, MEMORY = retrieve prior context'
  ),
  context: ContextSchema,
  trinity_mode: z.enum(['ATHENA', 'VERA', 'IRIS']).describe(
    'ATHENA = strategist, VERA = memory analyst, IRIS = executor'
  ),
  session_id: z.string().optional(),
});

const RecommendationSchema = z.object({
  action: z.string(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
});

const AveriInvokeOutputSchema = z.object({
  mode: z.string(),
  response: z.string(),
  tasks_created: z.array(z.string()).optional(),
  memory_refs: z.array(z.string()).optional(),
  recommendations: z.array(RecommendationSchema).optional(),
  dispatch_status: z.record(z.unknown()).optional(),
  timestamp: z.string(),
});

export type AveriInvokeInput = z.infer<typeof AveriInvokeInputSchema>;
export type AveriInvokeOutput = z.infer<typeof AveriInvokeOutputSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const DISPATCH_URL = process.env.DISPATCH_URL ?? 'http://cle-v6-dispatch-1:5150';
const DISPATCH_API_KEY = process.env.DISPATCH_API_KEY ?? '';

async function fetchDispatchStatus(): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${DISPATCH_URL}/api/status`, {
      headers: DISPATCH_API_KEY ? { Authorization: `Bearer ${DISPATCH_API_KEY}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, reachable: false };
    return { ...(await res.json() as Record<string, unknown>), reachable: true };
  } catch {
    return { error: 'unreachable', reachable: false };
  }
}

async function fetchLatestHandoff(): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${DISPATCH_URL}/api/handoffs/latest`, {
      headers: DISPATCH_API_KEY ? { Authorization: `Bearer ${DISPATCH_API_KEY}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    return await res.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function createDispatchTask(title: string, workstream: string, priority: string): Promise<string> {
  try {
    const res = await fetch(`${DISPATCH_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(DISPATCH_API_KEY ? { Authorization: `Bearer ${DISPATCH_API_KEY}` } : {}),
      },
      body: JSON.stringify({ title, workstream, priority }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return `error:HTTP ${res.status}`;
    const data = await res.json() as { id?: string };
    return data.id ?? 'created';
  } catch {
    return 'error:unreachable';
  }
}

// ── Trinity Handlers ──────────────────────────────────────────────────────────

async function handleAthena(
  intent: string,
  context: z.infer<typeof ContextSchema>
): Promise<AveriInvokeOutput> {
  const [status, handoff] = await Promise.all([
    fetchDispatchStatus(),
    fetchLatestHandoff(),
  ]);

  const prompt = `You are ATHENA — Strategist of the AVERI trinity. 
The operator invoked you from ${context.location ?? 'mobile'} with intent: ${intent}.
Signal: "${context.signal}"
${context.workstream ? `Active workstream: ${context.workstream}` : ''}
${context.tabs?.length ? `Open tabs: ${context.tabs.map(t => t.title).join(', ')}` : ''}

Dispatch status: ${JSON.stringify(status, null, 2)}
Latest handoff: ${JSON.stringify(handoff, null, 2)}

Provide a strategic summary. Surface the most important thing to act on. Be direct and decisive.`;

  const result = await ai.generate({ prompt });
  const text = result.text ?? '';

  return {
    mode: 'ATHENA',
    response: text,
    dispatch_status: status,
    recommendations: extractRecommendations(text),
    timestamp: new Date().toISOString(),
  };
}

async function handleVera(
  intent: string,
  context: z.infer<typeof ContextSchema>
): Promise<AveriInvokeOutput> {
  const query = `${intent}: ${context.signal}${context.workstream ? ` (workstream: ${context.workstream})` : ''}`;
  const memoryRefs: string[] = [];

  let memoryContext = '';
  try {
    const recalled = await scribeRecall({ query, tags: [], limit: 5, successOnly: false });
    if (recalled.results.length > 0) {
      memoryContext = recalled.results.map(r => `[${r.category}] ${r.content}`).join('\n');
      memoryRefs.push(`scribe:${query.slice(0, 40)}`);
    }
  } catch {
    memoryContext = '(memory unavailable)';
  }

  const prompt = `You are VERA — Memory Analyst of the AVERI trinity.
The operator invoked you from ${context.location ?? 'mobile'} with intent: ${intent}.
Signal: "${context.signal}"

Prior memory context:
${memoryContext || '(no prior context found)'}

Synthesize what you recall and surface the most relevant context for this signal. 
Be concise — this is a mobile context. Lead with the key insight.`;

  const result = await ai.generate({ prompt });

  return {
    mode: 'VERA',
    response: result.text ?? '',
    memory_refs: memoryRefs,
    timestamp: new Date().toISOString(),
  };
}

async function handleIris(
  intent: string,
  context: z.infer<typeof ContextSchema>
): Promise<AveriInvokeOutput> {
  const tasksCreated: string[] = [];

  if (intent === 'DISPATCH' && context.workstream) {
    const taskId = await createDispatchTask(
      context.signal,
      context.workstream,
      'P1'
    );
    tasksCreated.push(taskId);
  }

  const prompt = `You are IRIS — Executor of the AVERI trinity.
The operator invoked you from ${context.location ?? 'mobile'} with intent: ${intent}.
Signal: "${context.signal}"
${context.workstream ? `Workstream: ${context.workstream}` : ''}
${tasksCreated.length > 0 ? `Tasks created: ${tasksCreated.join(', ')}` : ''}

Confirm what was done and provide the immediate next action. Be terse.`;

  const result = await ai.generate({ prompt });

  return {
    mode: 'IRIS',
    response: result.text ?? '',
    tasks_created: tasksCreated.length > 0 ? tasksCreated : undefined,
    timestamp: new Date().toISOString(),
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

function extractRecommendations(text: string): Array<{ action: string; priority: 'P0' | 'P1' | 'P2' | 'P3' }> {
  const recs: Array<{ action: string; priority: 'P0' | 'P1' | 'P2' | 'P3' }> = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/P[0-3]/);
    if (match && line.length > 3 && line.length < 200) {
      recs.push({
        action: line.replace(/^[-*•]\s*/, '').trim(),
        priority: match[0] as 'P0' | 'P1' | 'P2' | 'P3',
      });
    }
  }
  return recs.slice(0, 5);
}

// ── Flow ──────────────────────────────────────────────────────────────────────

export const averiInvokeFlow = ai.defineFlow(
  {
    name: 'averi/invoke',
    inputSchema: AveriInvokeInputSchema,
    outputSchema: AveriInvokeOutputSchema,
  },
  async (input) => {
    const { trinity_mode, intent, context } = input;
    switch (trinity_mode) {
      case 'ATHENA': return handleAthena(intent, context);
      case 'VERA':   return handleVera(intent, context);
      case 'IRIS':   return handleIris(intent, context);
    }
  }
);
