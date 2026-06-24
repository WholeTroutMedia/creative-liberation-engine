/**
 * Ouroboros Pair Tracker
 *
 * Records every sequential agent-A → agent-B dispatch relationship.
 * Stored at: .agents/ouroboros/pair-log.jsonl
 *
 * FUSE uses this data to identify agent pairs that always fire
 * together (>80% co-occurrence) and are candidates for merging.
 */

import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '../../../../.agents/ouroboros'
);
const PAIR_LOG = path.join(LOG_DIR, 'pair-log.jsonl');
const PAIR_COUNTS = path.join(LOG_DIR, 'pair-counts.json');

export interface AgentPairEvent {
  timestamp: string;
  from_agent: string;
  to_agent: string;
  workstream: string;
  task_id: string;
  gap_ms: number;
}

export interface PairCount {
  from_agent: string;
  to_agent: string;
  count: number;
  last_seen: string;
}

/**
 * Record that agent B fired immediately after agent A.
 * Called by the dispatch layer on task completion / claim.
 */
export function recordAgentTransition(event: Omit<AgentPairEvent, 'timestamp'>): void {
  try {
    ensureDir();
    const record: AgentPairEvent = { ...event, timestamp: new Date().toISOString() };
    fs.appendFileSync(PAIR_LOG, JSON.stringify(record) + '\n', 'utf8');
    incrementPairCount(record);
  } catch (err) {
    console.error('[ouroboros:pair-tracker] Failed to record transition:', err);
  }
}

function ensureDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function incrementPairCount(event: AgentPairEvent): void {
  let counts: PairCount[] = [];
  if (fs.existsSync(PAIR_COUNTS)) {
    try {
      counts = JSON.parse(fs.readFileSync(PAIR_COUNTS, 'utf8')) as PairCount[];
    } catch {
      counts = [];
    }
  }

  const key = `${event.from_agent}→${event.to_agent}`;
  const existing = counts.find(c => `${c.from_agent}→${c.to_agent}` === key);
  if (existing) {
    existing.count++;
    existing.last_seen = event.timestamp;
  } else {
    counts.push({
      from_agent: event.from_agent,
      to_agent: event.to_agent,
      count: 1,
      last_seen: event.timestamp,
    });
  }

  fs.writeFileSync(PAIR_COUNTS, JSON.stringify(counts, null, 2), 'utf8');
}

/**
 * Returns all tracked pairs sorted by co-occurrence count (descending).
 */
export function getTopPairs(limit: number = 20): PairCount[] {
  if (!fs.existsSync(PAIR_COUNTS)) return [];
  try {
    const counts = JSON.parse(fs.readFileSync(PAIR_COUNTS, 'utf8')) as PairCount[];
    return counts.sort((a, b) => b.count - a.count).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Returns pairs that exceed the FUSE merge threshold (>80% co-occurrence
 * relative to the more-common agent's total appearances).
 */
export function getFuseCandidates(threshold: number = 0.8): PairCount[] {
  const pairs = getTopPairs(100);
  if (pairs.length === 0) return [];

  // Compute each agent's total appearances as 'from_agent'
  const totals: Record<string, number> = {};
  for (const p of pairs) {
    totals[p.from_agent] = (totals[p.from_agent] ?? 0) + p.count;
  }

  return pairs.filter(p => {
    const total = totals[p.from_agent] ?? 0;
    if (total === 0) return false;
    return p.count / total >= threshold;
  });
}
