#!/usr/bin/env npx ts-node
/**
 * merge-heritage.ts — Merges V1-V6 heritage ideations into the canonical registry.
 * Reads heritage-ideations.json, converts to V2 lifecycle format, merges with
 * existing ideations.canonical.json (dedup by slug), writes back.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename_esm = fileURLToPath(import.meta.url);
const __dirname_esm = path.dirname(__filename_esm);

const REGISTRY_PATH = process.argv[2] || '/app/runtime/registry/ideations.canonical.json';
const HERITAGE_PATH = path.join(__dirname_esm, 'heritage-ideations.json');

interface HeritageEntry {
  id: string; slug: string; title: string; source: string;
  domain: string; status: string; categories: string[];
  relevance: number; created: string;
}

interface RegistryEntry {
  id: string; slug: string; title: string; status: string;
  version: number; source: string; domain: string;
  categories: string[]; relevance: number;
  created: string; updated: string;
  lifecycle: { state: string; transitioned: string; review_due: string };
  heritage: boolean;
}

// Status mapping from heritage labels to V2 lifecycle states
const STATUS_MAP: Record<string, string> = {
  'BRAINSTORM': 'BRAINSTORM',
  'IDEATED': 'IDEATED',
  'ACTIVATED': 'ACTIVATED',
  'IN_PROGRESS': 'ACTIVATED',
  'SHIPPED': 'COMPLETED',
  'COMPLETED': 'COMPLETED',
  'ARCHIVED': 'ARCHIVED',
};

function main() {
  // Load heritage entries
  const heritage: HeritageEntry[] = JSON.parse(fs.readFileSync(HERITAGE_PATH, 'utf-8'));
  console.log(`Loaded ${heritage.length} heritage entries`);

  // Load existing registry (wrapper object format)
  let wrapper: any = { version: '2.0.0', generatedAt: '', stats: {}, ideations: [] };
  let existing: RegistryEntry[] = [];
  if (fs.existsSync(REGISTRY_PATH)) {
    const raw = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    // Handle both array and wrapper-object formats
    if (Array.isArray(raw)) {
      existing = raw;
    } else if (raw.ideations && Array.isArray(raw.ideations)) {
      wrapper = raw;
      existing = raw.ideations;
    }
    console.log(`Loaded ${existing.length} existing registry entries`);
  }

  // Build slug index for dedup
  const slugIndex = new Set(existing.map(e => e.slug));
  const now = new Date().toISOString();
  const reviewDue = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]; // +30 days

  let added = 0;
  let skipped = 0;

  for (const h of heritage) {
    if (slugIndex.has(h.slug)) {
      skipped++;
      continue;
    }

    const state = STATUS_MAP[h.status] || 'BRAINSTORM';
    const entry: RegistryEntry = {
      id: h.id,
      slug: h.slug,
      title: h.title,
      status: h.status,
      version: 2,
      source: h.source,
      domain: h.domain,
      categories: h.categories,
      relevance: h.relevance,
      created: h.created,
      updated: now,
      lifecycle: {
        state,
        transitioned: now,
        review_due: `${reviewDue}T00:00:00Z`,
      },
      heritage: true,
    };

    existing.push(entry);
    slugIndex.add(h.slug);
    added++;
  }

  // Sort by created date
  existing.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());

  // Rebuild stats
  const byStatus: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalRelevance = 0;
  for (const e of existing) {
    const st = e.lifecycle?.state || e.status || 'UNKNOWN';
    byStatus[st] = (byStatus[st] || 0) + 1;
    if (e.domain) byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
    const src = e.source || 'unknown';
    bySource[src] = (bySource[src] || 0) + 1;
    totalRelevance += (e.relevance || 0);
  }

  // Write back in wrapper format
  wrapper.version = '2.0.0';
  wrapper.generatedAt = now;
  wrapper.lastJobNumber = existing.length;
  wrapper.stats = {
    total: existing.length,
    byStatus,
    byDomain,
    bySource,
    avgRelevance: Math.round(totalRelevance / existing.length),
    heritageMigrated: heritage.length,
    heritageAdded: added,
  };
  wrapper.ideations = existing;

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(wrapper, null, 2));
  console.log(`\nMerge complete: ${added} added, ${skipped} skipped (already existed)`);
  console.log(`Total registry size: ${existing.length} entries`);

  // Print summary by state
  const stateCounts: Record<string, number> = {};
  for (const e of existing) {
    const s = e.lifecycle?.state || e.status || 'UNKNOWN';
    stateCounts[s] = (stateCounts[s] || 0) + 1;
  }
  console.log('\nLifecycle Distribution:');
  for (const [state, count] of Object.entries(stateCounts).sort()) {
    console.log(`  ${state}: ${count}`);
  }
}

main();
