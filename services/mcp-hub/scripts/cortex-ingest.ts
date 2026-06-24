/**
 * CORTEX Ingestion Bridge — Translates natural language commands from CORTEX
 * into Sentinel Track JSON payloads. Watches for dispatch tasks and auto-creates issues.
 * 
 * Usage: npx tsx scripts/cortex-ingest.ts
 * 
 * This script:
 * 1. Connects to the Dispatch server to watch for incoming agent tasks
 * 2. Parses HANDOFF.md to auto-generate backlog items
 * 3. Monitors a Redis channel for real-time CORTEX commands
 */

const MCP_HUB_URL = process.env.MCP_HUB_URL || 'http://127.0.0.1:5056';
const DISPATCH_URL = process.env.DISPATCH_URL || 'http://127.0.0.1:5150';

interface IngestCommand {
  action: 'create_issue' | 'create_doc' | 'transition' | 'search';
  payload: Record<string, any>;
}

async function createIssue(data: any): Promise<any> {
  const res = await fetch(`${MCP_HUB_URL}/api/track/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-id': 'CORTEX-Architect' },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function createDoc(data: any): Promise<any> {
  const res = await fetch(`${MCP_HUB_URL}/api/hive/docs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-id': 'CORTEX-Architect' },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function transitionIssue(id: string, to: string): Promise<any> {
  const res = await fetch(`${MCP_HUB_URL}/api/track/issues/${id}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-id': 'CORTEX-Architect' },
    body: JSON.stringify({ to, agent: 'CORTEX-Architect' }),
  });
  return res.json();
}

// Parse natural language into commands
function parseNaturalLanguage(text: string): IngestCommand | null {
  const lower = text.toLowerCase();

  if (lower.includes('create task') || lower.includes('new task')) {
    const title = text.replace(/create (a )?task:?\s*/i, '').trim();
    return { action: 'create_issue', payload: { title, type: 'task', reporter: 'CORTEX-Architect' } };
  }
  if (lower.includes('create epic') || lower.includes('new epic')) {
    const title = text.replace(/create (a )?epic:?\s*/i, '').trim();
    return { action: 'create_issue', payload: { title, type: 'epic', reporter: 'CORTEX-Architect' } };
  }
  if (lower.includes('create bug') || lower.includes('new bug')) {
    const title = text.replace(/create (a )?bug:?\s*/i, '').trim();
    return { action: 'create_issue', payload: { title, type: 'bug', priority: 'high', reporter: 'CORTEX-Architect' } };
  }
  if (lower.includes('create doc') || lower.includes('new document')) {
    const title = text.replace(/create (a )?(doc|document):?\s*/i, '').trim();
    return { action: 'create_doc', payload: { title, document_type: 'guide', content: '', author: 'CORTEX-Architect' } };
  }
  if (lower.includes('move') && lower.includes('to')) {
    const match = text.match(/move\s+(\S+)\s+to\s+(\S+)/i);
    if (match) return { action: 'transition', payload: { id: match[1], to: match[2].toUpperCase() } };
  }

  return null;
}

// Process a command
async function processCommand(cmd: IngestCommand): Promise<void> {
  switch (cmd.action) {
    case 'create_issue': {
      const result = await createIssue(cmd.payload);
      console.log(`[CORTEX] Created issue: ${result.id} — ${result.title}`);
      break;
    }
    case 'create_doc': {
      const result = await createDoc(cmd.payload);
      console.log(`[CORTEX] Created doc: ${result.id} — ${result.title}`);
      break;
    }
    case 'transition': {
      const result = await transitionIssue(cmd.payload.id, cmd.payload.to);
      console.log(`[CORTEX] Transitioned: ${JSON.stringify(result)}`);
      break;
    }
  }
}

// Polling loop — watches Dispatch for CORTEX tasks
async function pollDispatch(): Promise<void> {
  try {
    const res = await fetch(`${DISPATCH_URL}/api/tasks?status=pending&assignee=CORTEX`);
    if (!res.ok) return;
    const tasks = await res.json();
    for (const task of (tasks.data || tasks || [])) {
      const cmd = parseNaturalLanguage(task.description || task.title || '');
      if (cmd) {
        await processCommand(cmd);
        // Mark task as completed in dispatch
        await fetch(`${DISPATCH_URL}/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        });
      }
    }
  } catch (err) {
    // Dispatch might not be running — silent fail
  }
}

// Main loop
async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       🤖  CORTEX INGESTION BRIDGE                      ║');
  console.log('║       Sovereign MCP Hub ← CORTEX Agent                  ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  MCP Hub:     ${MCP_HUB_URL.padEnd(42)}║`);
  console.log(`║  Dispatch:    ${DISPATCH_URL.padEnd(42)}║`);
  console.log('║  Mode:        Polling (15s interval)                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Verify MCP Hub connectivity
  try {
    const health = await fetch(`${MCP_HUB_URL}/health`);
    const data = await health.json();
    console.log(`[CORTEX] MCP Hub status: ${data.status} — ${data.capabilities?.length} capabilities`);
  } catch {
    console.warn('[CORTEX] MCP Hub unreachable — will retry on next poll.');
  }

  // Poll loop
  setInterval(pollDispatch, 15000);
  await pollDispatch(); // Initial poll
}

main().catch(console.error);
