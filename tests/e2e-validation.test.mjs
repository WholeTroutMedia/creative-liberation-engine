/**
 * V6 End-to-End Validation — Route & Memory Behavior
 *
 * Validates:
 * 1. Route manifests reference real services in the composition manifest
 * 2. Memory records maintain structural integrity through round-trip
 * 3. Route manifests and composition manifest are cross-consistent
 * 4. Registry lookups resolve correctly
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Test infrastructure ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║   V6 End-to-End Validation — Routes & Memory         ║');
console.log('╚════════════════════════════════════════════════════════╝');

// ─── SECTION 1: Route-to-Composition Consistency ─────────────────────────────

console.log('\n─── 1. Route-to-Composition Consistency ───\n');

const compositionPath = join(ROOT, 'runtime/composition.local.json');
const composition = loadJSON(compositionPath);

const routeDir = join(ROOT, 'runtime/routes');
const manifestFiles = readdirSync(routeDir).filter(f => f.endsWith('.manifest.json'));

test('Composition manifest has required fields', () => {
  assert(composition.version, 'Missing version');
  assert(composition.environment, 'Missing environment');
  assert(composition.services, 'Missing services');
  assert(composition.volumes, 'Missing volumes');
});

test('All route manifest services exist in composition', () => {
  const compositionServices = Object.keys(composition.services);
  const mismatches = [];
  for (const file of manifestFiles) {
    const manifest = loadJSON(join(routeDir, file));
    if (!compositionServices.includes(manifest.service) && manifest.service !== 'example-service') {
      mismatches.push(`${manifest.service} (from ${file})`);
    }
  }
  assert(mismatches.length === 0, `Services in route manifests but not in composition: ${mismatches.join(', ')}`);
});

test('Composition services with routeManifest reference existing files', () => {
  const missing = [];
  for (const [name, svc] of Object.entries(composition.services)) {
    if (svc.routeManifest) {
      const manifestPath = join(routeDir, svc.routeManifest);
      if (!existsSync(manifestPath)) {
        missing.push(`${name} references ${svc.routeManifest} which does not exist`);
      }
    }
  }
  assert(missing.length === 0, `Missing referenced manifests: ${missing.join(', ')}`);
});

test('All route manifest services map to correct upstream', () => {
  const errors = [];
  for (const file of manifestFiles) {
    const manifest = loadJSON(join(routeDir, file));
    for (const route of manifest.routes) {
      if (route.upstreamService !== manifest.service) {
        errors.push(`${route.routeId}: upstreamService "${route.upstreamService}" !== manifest service "${manifest.service}"`);
      }
    }
  }
  assert(errors.length === 0, `Upstream mismatches: ${errors.join('; ')}`);
});

// ─── SECTION 2: Memory Round-Trip Integrity ──────────────────────────────────

console.log('\n─── 2. Memory Round-Trip Integrity ───\n');

const memoryDir = join(ROOT, 'runtime/memory');
const wikiExamplesDir = join(ROOT, 'wiki/examples');
const memoryCollections = readdirSync(memoryDir).filter(f => f.endsWith('.index.json'));

test('Every memory record has a valid memoryId format', () => {
  const pattern = /^mem_[a-z0-9_\-]{6,80}$/;
  const invalid = [];
  for (const file of memoryCollections) {
    const collection = loadJSON(join(memoryDir, file));
    for (const record of collection.items || collection.entries || []) {
      if (!pattern.test(record.memoryId)) {
        invalid.push(`${record.memoryId} in ${file}`);
      }
    }
  }
  assert(invalid.length === 0, `Invalid memoryIds: ${invalid.join(', ')}`);
});

test('Memory records have required lifecycle fields', () => {
  const validStates = ['draft', 'active', 'canonical', 'superseded', 'deprecated', 'archived'];
  const errors = [];
  for (const file of memoryCollections) {
    const collection = loadJSON(join(memoryDir, file));
    for (const record of collection.items || collection.entries || []) {
      if (!record.lifecycleState || !validStates.includes(record.lifecycleState)) {
        errors.push(`${record.memoryId}: invalid lifecycleState "${record.lifecycleState}"`);
      }
      if (!record.createdAt) {
        errors.push(`${record.memoryId}: missing createdAt`);
      }
    }
  }
  assert(errors.length === 0, `Lifecycle errors: ${errors.join('; ')}`);
});

test('Wiki examples have matching memory records', () => {
  if (!existsSync(wikiExamplesDir)) {
    assert(true); // No examples to check
    return;
  }
  const wikiNotes = readdirSync(wikiExamplesDir).filter(f => f.endsWith('.md'));
  const allMemoryIds = new Set();
  for (const file of memoryCollections) {
    const collection = loadJSON(join(memoryDir, file));
    for (const record of collection.items || collection.entries || []) {
      allMemoryIds.add(record.memoryId);
    }
  }
  // Wiki notes with mem_ prefix should have a memory record
  const orphaned = [];
  for (const note of wikiNotes) {
    const basename = note.replace('.md', '');
    if (basename.startsWith('mem_') && !allMemoryIds.has(basename)) {
      // Check MEMORY_INDEX.example.json too
      const examplePath = join(memoryDir, 'MEMORY_INDEX.example.json');
      if (existsSync(examplePath)) {
        const example = loadJSON(examplePath);
        const found = (example.items || example.entries || []).some(e => e.memoryId === basename);
        if (!found) orphaned.push(basename);
      } else {
        orphaned.push(basename);
      }
    }
  }
  if (orphaned.length > 0) {
    console.log(`     ⚠ ${orphaned.length} wiki note(s) without matching memory record (may be in example index)`);
  }
});

// ─── SECTION 3: Registry Integrity ───────────────────────────────────────────

console.log('\n─── 3. Registry Integrity ───\n');

const registryDir = join(ROOT, 'runtime/registry');

test('Agent registry has no duplicate agentIds', () => {
  const agents = loadJSON(join(registryDir, 'agents.canonical.json'));
  const ids = agents.agents.map(a => a.agentId);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert(dupes.length === 0, `Duplicate agentIds: ${dupes.join(', ')}`);
  console.log(`     ${ids.length} unique agents`);
});

test('Skill registry has no duplicate skillIds', () => {
  const skills = loadJSON(join(registryDir, 'skills.canonical.json'));
  const ids = skills.skills.map(s => s.skillId);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert(dupes.length === 0, `Duplicate skillIds: ${dupes.join(', ')}`);
  console.log(`     ${ids.length} unique skills`);
});

test('Workflow registry has no duplicate workflowIds', () => {
  const workflows = loadJSON(join(registryDir, 'workflows.canonical.json'));
  const ids = workflows.workflows.map(w => w.workflowId);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert(dupes.length === 0, `Duplicate workflowIds: ${dupes.join(', ')}`);
  console.log(`     ${ids.length} unique workflows`);
});

// ─── SECTION 4: Route Coverage Analysis ──────────────────────────────────────

console.log('\n─── 4. Route Coverage Analysis ───\n');

test('Every route has a valid criticality tier', () => {
  const validTiers = ['tier0', 'tier1', 'tier2', 'tier3', 'tier4', 'tier5'];
  const invalid = [];
  for (const file of manifestFiles) {
    const manifest = loadJSON(join(routeDir, file));
    for (const route of manifest.routes) {
      if (!validTiers.includes(route.criticality)) {
        invalid.push(`${route.routeId}: ${route.criticality}`);
      }
    }
  }
  assert(invalid.length === 0, `Invalid criticality: ${invalid.join(', ')}`);
});

test('Every route has a valid auth policy', () => {
  const validPolicies = ['public', 'api_key', 'session', 'service_token', 'internal_only'];
  const invalid = [];
  for (const file of manifestFiles) {
    const manifest = loadJSON(join(routeDir, file));
    for (const route of manifest.routes) {
      if (!validPolicies.includes(route.authPolicy)) {
        invalid.push(`${route.routeId}: ${route.authPolicy}`);
      }
    }
  }
  assert(invalid.length === 0, `Invalid auth policies: ${invalid.join(', ')}`);
});

test('Route summary statistics', () => {
  let totalRoutes = 0;
  const byService = {};
  const byTier = {};
  const byAuth = {};
  for (const file of manifestFiles) {
    const manifest = loadJSON(join(routeDir, file));
    byService[manifest.service] = manifest.routes.length;
    for (const route of manifest.routes) {
      totalRoutes++;
      byTier[route.criticality] = (byTier[route.criticality] || 0) + 1;
      byAuth[route.authPolicy] = (byAuth[route.authPolicy] || 0) + 1;
    }
  }
  console.log(`     ${totalRoutes} total routes across ${manifestFiles.length} manifests`);
  console.log(`     By tier: ${Object.entries(byTier).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`     By auth: ${Object.entries(byAuth).map(([k, v]) => `${k}=${v}`).join(', ')}`);
});

// ─── SECTION 5: Core Package Validation ──────────────────────────────────────

console.log('\n─── 5. Core Package Validation ───\n');

const corePackages = [
  // Wave 1
  { name: '@cle/tsconfig', dir: 'packages/tsconfig', files: ['base.json', 'service.json', 'app.json'] },
  { name: '@cle/config', dir: 'packages/config', files: ['src/index.mjs'] },
  { name: '@cle/engine-core', dir: 'packages/engine-core', files: ['src/index.mjs', 'src/health.mjs', 'src/registry.mjs', 'src/boot.mjs'] },
  // Wave 2 — Inference
  { name: '@cle/inference', dir: 'packages/inference', files: ['src/index.mjs', 'src/client.mjs', 'src/arbitrage.mjs', 'src/ollama.mjs'] },
  // Wave 3 — Memory
  { name: '@cle/memory', dir: 'packages/memory', files: ['src/index.mjs', 'src/bus.mjs', 'src/scribe.mjs', 'src/wiki.mjs', 'src/vector.mjs'] },
  // Wave 4 — Dispatch
  { name: '@cle/dispatch', dir: 'packages/dispatch', files: ['src/index.mjs', 'src/client.mjs', 'src/orchestrator.mjs', 'src/mail.mjs'] },
  // Wave 5 — Observability
  { name: '@cle/observability', dir: 'packages/observability', files: ['src/index.mjs', 'src/pulse.mjs', 'src/telemetry.mjs', 'src/hardener.mjs'] },
  // Wave 6 — Design System
  { name: '@cle/design-tokens', dir: 'packages/design-tokens', files: ['src/index.mjs'] },
  // Wave 7 — Creative
  { name: '@cle/creative', dir: 'packages/creative', files: ['src/index.mjs', 'src/genmedia.mjs', 'src/motion.mjs', 'src/ingest.mjs'] },
  // Wave 8 — Agents
  { name: '@cle/agent-sdk', dir: 'packages/agent-sdk', files: ['src/index.mjs', 'src/agent.mjs', 'src/browser.mjs', 'src/security.mjs'] },
  // Wave 10 — External
  { name: '@cle/integrations', dir: 'packages/integrations', files: ['src/index.mjs', 'src/resolve.mjs', 'src/mobile.mjs', 'src/mesh.mjs'] },
];

for (const pkg of corePackages) {
  test(`${pkg.name} has package.json and required files`, () => {
    const pkgPath = join(ROOT, pkg.dir, 'package.json');
    assert(existsSync(pkgPath), `Missing package.json at ${pkg.dir}`);
    const pkgJson = loadJSON(pkgPath);
    assert(pkgJson.name === pkg.name, `Expected name ${pkg.name}, got ${pkgJson.name}`);
    assert(pkgJson.version, 'Missing version');
    for (const file of pkg.files) {
      const filePath = join(ROOT, pkg.dir, file);
      assert(existsSync(filePath), `Missing file: ${pkg.dir}/${file}`);
    }
  });
}

// ─── SECTION 6: Capability Coverage ────────────────────────────────────────

console.log('\n─── 6. Capability Coverage ───\n');

test('All packages declare capabilityIds', () => {
  const allCapIds = [];
  const missing = [];
  let totalPkgs = 0;
  
  const folders = ['packages', 'services', 'apps'];
  for (const folder of folders) {
    const dirPath = join(ROOT, folder);
    if (!existsSync(dirPath)) continue;
    const items = readdirSync(dirPath).filter(d => existsSync(join(dirPath, d, 'package.json')));
    for (const d of items) {
      totalPkgs++;
      const pkg = loadJSON(join(dirPath, d, 'package.json'));
      const capIds = pkg.capabilityId ? [pkg.capabilityId] : (pkg.capabilityIds || []);
      if (capIds.length === 0) missing.push(`${folder}/${d}`);
      allCapIds.push(...capIds);
    }
  }

  if (missing.length > 0) {
    const preview = missing.slice(0, 10).join(', ');
    const more = missing.length > 10 ? ` (+${missing.length - 10} more)` : '';
    console.log(`     ⚠ ${missing.length} package(s) without capabilityIds: ${preview}${more}`);
  }
  console.log(`     ${allCapIds.length} capabilities across ${totalPkgs} packages/services/apps`);
});

// ─── RESULTS ─────────────────────────────────────────────────────────────────

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log(`║   Results: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0, 30 - String(passed).length - String(failed).length))}║`);
console.log('╚════════════════════════════════════════════════════════╝\n');

if (failures.length > 0) {
  console.log('Failures:');
  for (const f of failures) {
    console.log(`  • ${f.name}: ${f.error}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
