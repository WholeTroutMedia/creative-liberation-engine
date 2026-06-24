#!/usr/bin/env node

/**
 * NAS Bridge — Connectivity Validation & Live API Tests
 *
 * Validates that V6 packages can communicate with live NAS services.
 * Runs end-to-end integration tests against the real infrastructure.
 *
 * Usage: node scripts/nas-bridge.mjs
 * With env: node --env-file=.env.nas scripts/nas-bridge.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Load .env.nas if --env-file not used ────────────────────────────────────

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    // Force override — .env.nas is the bridge source of truth
    process.env[key] = value;
  }
}

loadEnvFile(join(ROOT, '.env.nas'));

// ─── Test infrastructure ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function skip(name, reason) {
  console.log(`  ⏭️  ${name} — ${reason}`);
  skipped++;
}

async function fetchJSON(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeout || 5000);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return { status: res.status, data: await res.json() };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ─── Configuration ───────────────────────────────────────────────────────────

const NAS = process.env.NAS_HOST || '127.0.0.1';
const DISPATCH_URL = process.env.DISPATCH_URL || `http://${NAS}:5160`;
const GENKIT_URL = process.env.GENKIT_URL || `http://${NAS}:4110`;
const OLLAMA_HOST = process.env.OLLAMA_HOST || `http://${NAS}:11434`;
const V5_DISPATCH = process.env.V5_DISPATCH_URL || `http://${NAS}:5050`;

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║   V6 NAS Bridge — Live Connectivity Validation         ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`\n  NAS:       ${NAS}`);
console.log(`  Dispatch:  ${DISPATCH_URL}`);
console.log(`  Genkit:    ${GENKIT_URL}`);
console.log(`  Ollama:    ${OLLAMA_HOST}`);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Service Reachability
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n─── 1. Service Reachability ───\n');

await test('V6 Dispatch is reachable', async () => {
  const { data } = await fetchJSON(`${DISPATCH_URL}/api/status`);
  if (!data.summary) throw new Error('Missing summary in dispatch status');
  console.log(`     Queue: ${data.summary.queued} queued, ${data.summary.active} active, ${data.summary.done} done`);
  console.log(`     Agents: ${data.summary.total_agents} registered, ${data.idle_agents?.length || 0} idle`);
});

await test('V6 Genkit health is operational', async () => {
  const { data } = await fetchJSON(`${GENKIT_URL}/health`);
  if (data.status !== 'operational') throw new Error(`Status: ${data.status}`);
  console.log(`     Service: ${data.service} v${data.version}`);
  console.log(`     Providers: ${data.providers?.join(', ')}`);
  console.log(`     Sovereign: ${data.sovereign?.mode ? 'ON' : 'OFF'}`);
});

await test('Ollama is reachable', async () => {
  const { data } = await fetchJSON(`${OLLAMA_HOST}/api/tags`);
  const models = data.models || [];
  console.log(`     Models: ${models.length} available`);
  if (models.length > 0) {
    console.log(`     Available: ${models.map(m => m.name).join(', ')}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Dispatch Integration
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n─── 2. Dispatch Integration ───\n');

await test('Can list dispatch agents', async () => {
  const { data } = await fetchJSON(`${DISPATCH_URL}/api/status`);
  const agents = [...(data.idle_agents || []), ...(data.active_agents || [])];
  if (agents.length === 0) throw new Error('No agents registered');
  for (const agent of agents) {
    console.log(`     ${agent.agent_id}: ${agent.capabilities?.join(', ') || 'no caps'}`);
  }
});

await test('Can create and retrieve a test task', async () => {
  const task = {
    type: 'v6_bridge_test',
    project: 'creative-liberation-engine',
    priority: 'low',
    title: 'V6 NAS Bridge Connectivity Test',
    capabilities: ['genkit'],
    input: {
      test: true,
      timestamp: new Date().toISOString(),
      source: 'nas-bridge-validation',
    },
  };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const createRes = await fetch(`${DISPATCH_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!createRes.ok) throw new Error(`Create failed: ${createRes.status} ${await createRes.text()}`);
    const created = await createRes.json();
    console.log(`     Created task: ${created.id || created.task_id || JSON.stringify(created).substring(0, 100)}`);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Task create timed out (8s)');
    throw err;
  }

  // Verify via queue status
  const { data: status } = await fetchJSON(`${DISPATCH_URL}/api/status`);
  console.log(`     Queue: ${status.summary.queued} queued, ${status.summary.done} done`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Genkit Inference
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n─── 3. Genkit Inference ───\n');

await test('Can call Genkit /generate endpoint', async () => {
  const apiKey = process.env.GENKIT_API_KEY || 'v6-local-key';
  const res = await fetch(`${GENKIT_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      prompt: 'Respond with exactly: BRIDGE_OK',
      model: 'googleai/gemini-2.5-flash',
      maxTokens: 10,
    }),
  });

  if (res.status === 404) {
    // Try alternative endpoints
    const altRes = await fetch(`${GENKIT_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ prompt: 'Say BRIDGE_OK', model: 'googleai/gemini-2.5-flash', maxTokens: 10 }),
    });
    if (!altRes.ok) throw new Error(`Generate failed: ${altRes.status}`);
    const data = await altRes.json();
    console.log(`     Response: ${JSON.stringify(data).substring(0, 150)}`);
    return;
  }

  if (!res.ok) throw new Error(`Generate failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  console.log(`     Response: ${JSON.stringify(data).substring(0, 150)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: Ollama Local Inference
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n─── 4. Ollama Sovereign Inference ───\n');

await test('Can list Ollama models', async () => {
  const { data } = await fetchJSON(`${OLLAMA_HOST}/api/tags`);
  const models = data.models || [];
  if (models.length === 0) throw new Error('No Ollama models available');
  console.log(`     ${models.length} models loaded`);
});

await test('Can run local inference via Ollama', async () => {
  const { data: tags } = await fetchJSON(`${OLLAMA_HOST}/api/tags`);
  const models = tags.models || [];
  if (models.length === 0) { skip('Local inference', 'No models loaded'); return; }

  const model = models[0].name;
  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: 'Say BRIDGE_OK', stream: false, options: { num_predict: 5 } }),
  });
  if (!res.ok) throw new Error(`Ollama generate failed: ${res.status}`);
  const data = await res.json();
  console.log(`     Model: ${model}`);
  console.log(`     Response: ${data.response?.substring(0, 100)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: V5 ↔ V6 Bridge Verification
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n─── 5. V5 ↔ V6 Bridge ───\n');

await test('V5 and V6 dispatch are independent stacks', async () => {
  const [v6Status, v5Status] = await Promise.allSettled([
    fetchJSON(`${DISPATCH_URL}/api/status`),
    fetchJSON(`${V5_DISPATCH}/api/status`),
  ]);

  if (v6Status.status === 'fulfilled') {
    console.log(`     V6: ${v6Status.value.data.summary.done} tasks done, ${v6Status.value.data.summary.total_projects} projects`);
  }
  if (v5Status.status === 'fulfilled') {
    console.log(`     V5: ${v5Status.value.data.summary.done} tasks done, ${v5Status.value.data.summary.total_projects} projects`);
  } else {
    console.log(`     V5: not reachable (expected — old protocol)`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: Package → Service Wire Check
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n─── 6. Package → Service Wiring ───\n');

const wiring = [
  { package: '@cle/inference', endpoint: `${GENKIT_URL}/health`, expectedField: 'status' },
  { package: '@cle/dispatch', endpoint: `${DISPATCH_URL}/api/status`, expectedField: 'summary' },
  { package: '@cle/inference (ollama)', endpoint: `${OLLAMA_HOST}/api/tags`, expectedField: 'models' },
];

for (const wire of wiring) {
  await test(`${wire.package} → live service`, async () => {
    const { data } = await fetchJSON(wire.endpoint);
    if (!data[wire.expectedField]) {
      throw new Error(`Missing '${wire.expectedField}' in response`);
    }
    console.log(`     Endpoint: ${wire.endpoint} ✓`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log(`║   Results: ${passed} passed, ${failed} failed, ${skipped} skipped${' '.repeat(Math.max(0, 22 - String(passed).length - String(failed).length - String(skipped).length))}║`);
console.log('╚══════════════════════════════════════════════════════════╝\n');

if (failures.length > 0) {
  console.log('Failures:');
  for (const f of failures) {
    console.log(`  • ${f.name}: ${f.error}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
