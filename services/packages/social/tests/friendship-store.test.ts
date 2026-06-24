/**
 * Tests for @cle/social — FriendshipStore
 * Virtual Strangers: in-memory store, Garden/Constellation projections
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FriendshipStore } from '../src/friendship-store.js';
import { createFriendshipLog, recordEvent, silenceEntity } from '../src/relationship-engine.js';
import type { RelationshipEntity } from '../src/relationship-types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────

const averi: RelationshipEntity = { id: 'agent-averi', handle: 'AVERI', type: 'agent', metadata: {} };
const justin: RelationshipEntity = { id: 'human-justin', handle: 'Artist', type: 'human', metadata: {} };
const jaymee: RelationshipEntity = { id: 'human-jaymee', handle: 'Jaymee', type: 'human', metadata: {} };
const prism: RelationshipEntity = { id: 'agent-prism', handle: 'PRISM', type: 'agent', metadata: {} };

// ── Tests ─────────────────────────────────────────────────────────────────

describe('FriendshipStore — CRUD', () => {
  let store: FriendshipStore;

  beforeEach(() => {
    // No persistence in tests
    store = new FriendshipStore({ persist: false });
  });

  it('starts empty', () => {
    expect(store.size()).toBe(0);
    expect(store.listAll()).toHaveLength(0);
  });

  it('upserts and retrieves a log', () => {
    const log = createFriendshipLog(averi, justin);
    store.upsert(log);
    expect(store.size()).toBe(1);
    const retrieved = store.get(averi.id, justin.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(log.id);
  });

  it('retrieves regardless of entity order', () => {
    const log = createFriendshipLog(averi, justin);
    store.upsert(log);
    const fwd = store.get(averi.id, justin.id);
    const rev = store.get(justin.id, averi.id);
    expect(fwd!.id).toBe(rev!.id);
  });

  it('deletes a log', () => {
    const log = createFriendshipLog(averi, justin);
    store.upsert(log);
    const deleted = store.delete(averi.id, justin.id);
    expect(deleted).toBe(true);
    expect(store.size()).toBe(0);
  });

  it('returns undefined for missing relationships', () => {
    expect(store.get('nobody', 'nobody-else')).toBeUndefined();
  });
});

describe('FriendshipStore — Entity Queries', () => {
  let store: FriendshipStore;

  beforeEach(() => {
    store = new FriendshipStore({ persist: false });
    store.upsert(createFriendshipLog(averi, justin));
    store.upsert(createFriendshipLog(averi, jaymee));
    store.upsert(createFriendshipLog(averi, prism));
    store.upsert(createFriendshipLog(justin, jaymee));
  });

  it('lists all relationships for an entity', () => {
    const logs = store.listByEntity(averi.id);
    expect(logs.length).toBe(3);
  });

  it('does not include unrelated relationships', () => {
    const logs = store.listByEntity(prism.id);
    expect(logs.every(l => l.entityA.id === prism.id || l.entityB.id === prism.id)).toBe(true);
  });

  it('filters by state', () => {
    let log = store.get(averi.id, justin.id)!;
    log = silenceEntity(log, averi.id);
    store.upsert(log);

    const silenced = store.listByState('silenced');
    expect(silenced).toHaveLength(1);
    expect(silenced[0]!.state).toBe('silenced');
  });
});

describe('FriendshipStore — Garden View', () => {
  let store: FriendshipStore;

  beforeEach(() => {
    store = new FriendshipStore({ persist: false });
    let log1 = createFriendshipLog(averi, justin);
    log1 = recordEvent(log1, { type: 'first_contact', initiatorId: averi.id, receiverId: justin.id, content: 'hello', sentiment: 0.5, topics: ['greeting'], metadata: {} });
    store.upsert(log1);

    let log2 = createFriendshipLog(averi, jaymee);
    log2 = silenceEntity(log2, averi.id);
    store.upsert(log2);
  });

  it('returns garden nodes for entity, excluding silenced', () => {
    const nodes = store.getGardenView(averi.id);
    expect(nodes.some(n => n.entityId === justin.id)).toBe(true);
    expect(nodes.some(n => n.entityId === jaymee.id)).toBe(false);
  });

  it('sorts nodes by plant health descending', () => {
    store.upsert(createFriendshipLog(averi, prism));
    const nodes = store.getGardenView(averi.id);
    for (let i = 0; i < nodes.length - 1; i++) {
      expect(nodes[i]!.plantHealth).toBeGreaterThanOrEqual(nodes[i + 1]!.plantHealth);
    }
  });

  it('node has correct entityId for the other entity', () => {
    const nodes = store.getGardenView(averi.id);
    const justinNode = nodes.find(n => n.entityId === justin.id);
    expect(justinNode).toBeDefined();
    expect(justinNode!.handle).toBe('Artist');
  });
});

describe('FriendshipStore — Constellation View', () => {
  let store: FriendshipStore;

  beforeEach(() => {
    store = new FriendshipStore({ persist: false });
    store.upsert(createFriendshipLog(averi, justin));
    store.upsert(createFriendshipLog(averi, prism));
  });

  it('returns subject entity as center node', () => {
    const view = store.getConstellationView(averi.id);
    expect(view.subjectEntityId).toBe(averi.id);
    const subjectNode = view.nodes.find(n => n.entityId === averi.id);
    expect(subjectNode).toBeDefined();
    expect(subjectNode!.brightness).toBe(1);
  });

  it('returns edges connecting subject to each other entity', () => {
    const view = store.getConstellationView(averi.id);
    expect(view.edges.some(e => e.source === averi.id && e.target === justin.id)).toBe(true);
    expect(view.edges.some(e => e.source === averi.id && e.target === prism.id)).toBe(true);
  });
});

describe('FriendshipStore — Stats', () => {
  it('returns accurate stats', () => {
    const store = new FriendshipStore({ persist: false });
    store.upsert(createFriendshipLog(averi, justin));
    store.upsert(createFriendshipLog(averi, jaymee));

    const stats = store.getStats();
    expect(stats.total).toBe(2);
    expect(stats.byState['stranger']).toBe(2);
    expect(typeof stats.avgResonance).toBe('number');
  });
});
