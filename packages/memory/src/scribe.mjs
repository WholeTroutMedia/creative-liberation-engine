/**
 * SCRIBE — post-flight memory extraction.
 *
 * Extracts durable knowledge from completed agent sessions.
 * Runs after task completion to capture decisions, patterns, and lessons.
 *
 * @capabilityId cap_scribe_mcp
 */

import { MemoryBus } from './bus.mjs';

export class ScribeExtractor {
  constructor(memoryDir) {
    this.bus = new MemoryBus(memoryDir);
  }

  /**
   * Extract memory records from a completed session.
   * @param {object} session
   * @param {string} session.sessionId - Session identifier
   * @param {string} session.summary - Session summary text
   * @param {string[]} [session.decisions] - Key decisions made
   * @param {string[]} [session.patterns] - Patterns identified
   * @param {string[]} [session.lessons] - Lessons learned
   * @param {string[]} [session.tags] - Tags for categorization
   * @returns {object[]} Created memory records
   */
  extract(session) {
    const records = [];
    const timestamp = new Date().toISOString();

    // Session record
    records.push(this.bus.create('sessions', {
      memoryId: `mem_session_${session.sessionId}`,
      title: `Session: ${session.summary.substring(0, 80)}`,
      kind: 'session',
      provider: 'SCRIBE',
      summary: session.summary,
      tags: session.tags || [],
      createdAt: timestamp,
      lifecycleState: 'active',
    }));

    // Decision records
    for (const [i, decision] of (session.decisions || []).entries()) {
      records.push(this.bus.create('decisions', {
        memoryId: `mem_decision_${session.sessionId}_${i}`,
        title: decision.substring(0, 120),
        kind: 'decision',
        provider: 'SCRIBE',
        summary: decision,
        tags: session.tags || [],
        createdAt: timestamp,
        lifecycleState: 'active',
      }));
    }

    // Pattern records
    for (const [i, pattern] of (session.patterns || []).entries()) {
      records.push(this.bus.create('patterns', {
        memoryId: `mem_pattern_${session.sessionId}_${i}`,
        title: pattern.substring(0, 120),
        kind: 'pattern',
        provider: 'SCRIBE',
        summary: pattern,
        tags: session.tags || [],
        createdAt: timestamp,
        lifecycleState: 'active',
      }));
    }

    return records;
  }
}

/** Convenience: extract from a session */
export function extractPostFlight(memoryDir, session) {
  return new ScribeExtractor(memoryDir).extract(session);
}
