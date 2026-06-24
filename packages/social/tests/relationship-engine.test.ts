/**
 * Tests for @cle/social — relationship-engine
 * Virtual Strangers: state machine, resonance, peace-first doctrine
 */

import { describe, it, expect } from 'vitest';
import {
  createFriendshipLog,
  recordEvent,
  silenceEntity,
  repairRelationship,
  calculateResonance,
  calculatePlantHealth,
  advanceState,
} from '../src/relationship-engine.js';
import type { RelationshipEntity } from '../src/relationship-types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────

const alice: RelationshipEntity = { id: 'alice-01', handle: 'alice', type: 'human', metadata: {} };
const bob: RelationshipEntity = { id: 'bob-01', handle: 'bob', type: 'agent', metadata: {} };

// ── Tests ─────────────────────────────────────────────────────────────────

describe('createFriendshipLog', () => {
  it('creates a log with stranger state and zero resonance', () => {
    const log = createFriendshipLog(alice, bob);
    expect(log.state).toBe('stranger');
    expect(log.resonanceScore).toBe(0);
    expect(log.plantHealth).toBe(0);
    expect(log.plantState).toBe('seed');
    expect(log.interactionCount).toBe(0);
    expect(log.events).toHaveLength(0);
    expect(log.id).toBe('alice-01::bob-01');
  });

  it('generates a deterministic ID regardless of entity order', () => {
    const log1 = createFriendshipLog(alice, bob);
    const log2 = createFriendshipLog(bob, alice);
    expect(log1.id).toBe(log2.id);
  });
});

describe('recordEvent', () => {
  it('advances state from stranger to acquaintance after first_contact', () => {
    let log = createFriendshipLog(alice, bob);
    log = recordEvent(log, {
      type: 'first_contact',
      initiatorId: alice.id,
      receiverId: bob.id,
      content: 'Hello!',
      sentiment: 0.1,
      topics: ['intro'],
      metadata: {},
    });
    expect(log.state).toBe('acquaintance');
    expect(log.interactionCount).toBe(1);
    expect(log.events).toHaveLength(1);
    expect(log.ledger).toHaveLength(1);
  });

  it('accumulates shared topics across interactions', () => {
    let log = createFriendshipLog(alice, bob);
    log = recordEvent(log, { type: 'interaction', initiatorId: alice.id, receiverId: bob.id, content: 'a', sentiment: 0.2, topics: ['music', 'tech'], metadata: {} });
    log = recordEvent(log, { type: 'interaction', initiatorId: bob.id, receiverId: alice.id, content: 'b', sentiment: 0.3, topics: ['tech', 'art'], metadata: {} });
    expect(log.sharedTopics).toContain('music');
    expect(log.sharedTopics).toContain('tech');
    expect(log.sharedTopics).toContain('art');
  });

  it('does not add events to a silenced relationship', () => {
    let log = createFriendshipLog(alice, bob);
    log = silenceEntity(log, alice.id);
    const before = log.events.length;
    log = recordEvent(log, { type: 'interaction', initiatorId: alice.id, receiverId: bob.id, content: 'ping', sentiment: 0, topics: [], metadata: {} });
    expect(log.events.length).toBe(before);
  });

  it('increases resonance score with positive interactions', () => {
    let log = createFriendshipLog(alice, bob);
    for (let i = 0; i < 8; i++) {
      log = recordEvent(log, {
        type: 'interaction', initiatorId: alice.id, receiverId: bob.id,
        content: `msg ${i}`, sentiment: 0.8, topics: ['music'], metadata: {},
      });
    }
    expect(log.resonanceScore).toBeGreaterThan(0.1);
  });

  it('adds shared_win bonus to resonance', () => {
    let log = createFriendshipLog(alice, bob);
    log = recordEvent(log, { type: 'first_contact', initiatorId: alice.id, receiverId: bob.id, content: 'met', sentiment: 0.1, topics: [], metadata: {} });
    const before = log.resonanceScore;
    log = recordEvent(log, { type: 'shared_win', initiatorId: alice.id, receiverId: bob.id, content: 'we shipped it!', sentiment: 0.9, topics: ['project'], metadata: {} });
    expect(log.resonanceScore).toBeGreaterThanOrEqual(before);
  });
});

describe('silenceEntity (Peace-First Doctrine)', () => {
  it('sets state to silenced', () => {
    let log = createFriendshipLog(alice, bob);
    log = recordEvent(log, { type: 'first_contact', initiatorId: alice.id, receiverId: bob.id, content: 'hi', sentiment: 0, topics: [], metadata: {} });
    log = silenceEntity(log, alice.id);
    expect(log.state).toBe('silenced');
  });

  it('prevents further events after silencing', () => {
    let log = createFriendshipLog(alice, bob);
    log = silenceEntity(log, alice.id);
    const countBefore = log.events.length;
    log = recordEvent(log, { type: 'interaction', initiatorId: bob.id, receiverId: alice.id, content: 'trying', sentiment: 0, topics: [], metadata: {} });
    expect(log.events.length).toBe(countBefore);
  });

  it('does not create enemy state — just silenced', () => {
    let log = createFriendshipLog(alice, bob);
    log = silenceEntity(log, alice.id);
    expect(['enemy', 'blocked']).not.toContain(log.state);
    expect(log.state).toBe('silenced');
  });
});

describe('repairRelationship', () => {
  it('adds a repair event and improves sentiment', () => {
    let log = createFriendshipLog(alice, bob);
    log = recordEvent(log, { type: 'tension', initiatorId: alice.id, receiverId: bob.id, content: 'disagreement', sentiment: -0.5, topics: [], metadata: {} });
    const prevResonance = log.resonanceScore;
    log = repairRelationship(log, alice.id, 'I appreciate you.');
    const repairEvent = log.events.find(e => e.type === 'repair');
    expect(repairEvent).toBeDefined();
    expect(repairEvent!.sentiment).toBeGreaterThan(0);
  });

  it('does not repair a silenced relationship', () => {
    let log = createFriendshipLog(alice, bob);
    log = silenceEntity(log, alice.id);
    const countBefore = log.events.length;
    log = repairRelationship(log, alice.id, 'sorry');
    expect(log.events.length).toBe(countBefore);
    expect(log.state).toBe('silenced');
  });
});

describe('advanceState', () => {
  it('stays at stranger with zero interactions', () => {
    const log = createFriendshipLog(alice, bob);
    expect(advanceState(log)).toBe('stranger');
  });

  it('transitions to dormant when deep relationship loses all resonance', () => {
    let log = createFriendshipLog(alice, bob);
    // Simulate a deep relationship that went quiet
    const forcedClose = { ...log, state: 'close' as const, resonanceScore: 0.02, interactionCount: 25 };
    expect(advanceState(forcedClose)).toBe('dormant');
  });
});

describe('calculatePlantHealth', () => {
  it('returns 0 for silenced relationships', () => {
    let log = createFriendshipLog(alice, bob);
    log = silenceEntity(log, alice.id);
    expect(calculatePlantHealth(log)).toBe(0);
  });

  it('returns reduced health for dormant relationships', () => {
    const dormant = { ...createFriendshipLog(alice, bob), state: 'dormant' as const, resonanceScore: 0.6 };
    const health = calculatePlantHealth(dormant);
    expect(health).toBeLessThan(0.5);
    expect(health).toBeGreaterThan(0);
  });
});
