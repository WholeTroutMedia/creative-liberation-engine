/**
 * @module social/friendship-store
 * @description Virtual Strangers — FriendshipStore
 * In-memory relationship log store with JSON persistence.
 * Sovereign: no cloud dependency. Data lives at ~/.cle/vs-store.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type {
  FriendshipLog,
  GardenNode,
  ConstellationView,
  ConstellationNode,
  ConstellationEdge,
  RelationshipEntity,
} from './relationship-types.js';
import { makePairId } from './relationship-types.js';

// ── Store Config ──────────────────────────────────────────────────────────

const STORE_DIR = join(homedir(), '.cle');
const STORE_PATH = join(STORE_DIR, 'vs-store.json');

// ── FriendshipStore ───────────────────────────────────────────────────────

export class FriendshipStore {
  private logs: Map<string, FriendshipLog> = new Map();
  private persistOnWrite: boolean;

  constructor(options: { persist?: boolean } = {}) {
    this.persistOnWrite = options.persist ?? true;
    this._load();
  }

  // ── CRUD ──────────────────────────────────────────────────────────────

  upsert(log: FriendshipLog): FriendshipLog {
    this.logs.set(log.id, log);
    if (this.persistOnWrite) this._flush();
    return log;
  }

  get(entityAId: string, entityBId: string): FriendshipLog | undefined {
    return this.logs.get(makePairId(entityAId, entityBId));
  }

  getById(id: string): FriendshipLog | undefined {
    return this.logs.get(id);
  }

  delete(entityAId: string, entityBId: string): boolean {
    const deleted = this.logs.delete(makePairId(entityAId, entityBId));
    if (deleted && this.persistOnWrite) this._flush();
    return deleted;
  }

  listAll(): FriendshipLog[] {
    return Array.from(this.logs.values());
  }

  // ── Entity-scoped Queries ─────────────────────────────────────────────

  listByEntity(entityId: string): FriendshipLog[] {
    return Array.from(this.logs.values()).filter(
      (log) => log.entityA.id === entityId || log.entityB.id === entityId,
    );
  }

  listByState(state: FriendshipLog['state']): FriendshipLog[] {
    return Array.from(this.logs.values()).filter((log) => log.state === state);
  }

  // ── Garden View ───────────────────────────────────────────────────────

  getGardenView(entityId: string): GardenNode[] {
    const logs = this.listByEntity(entityId);
    return logs
      .filter((log) => log.state !== 'silenced')
      .map((log): GardenNode => {
        const other = log.entityA.id === entityId ? log.entityB : log.entityA;
        return {
          id: log.id,
          entityId: other.id,
          handle: other.handle,
          entityType: other.type,
          state: log.state,
          plantState: log.plantState,
          plantHealth: log.plantHealth,
          resonanceScore: log.resonanceScore,
          lastInteractionAt: log.lastInteractionAt,
          interactionCount: log.interactionCount,
        };
      })
      .sort((a, b) => b.plantHealth - a.plantHealth);
  }

  // ── Constellation View ────────────────────────────────────────────────

  getConstellationView(entityId: string): ConstellationView {
    const logs = this.listByEntity(entityId);
    const nodeMap = new Map<string, ConstellationNode>();
    const edges: ConstellationEdge[] = [];

    // Add subject entity as center node
    const firstLog = logs[0];
    if (firstLog) {
      const subject = firstLog.entityA.id === entityId ? firstLog.entityA : firstLog.entityB;
      nodeMap.set(entityId, {
        id: entityId,
        entityId,
        handle: subject.handle,
        entityType: subject.type,
        brightness: 1,
        state: 'close', // Subject is always fully bright
      });
    }

    for (const log of logs) {
      if (log.state === 'silenced') continue;

      const other = log.entityA.id === entityId ? log.entityB : log.entityA;

      if (!nodeMap.has(other.id)) {
        nodeMap.set(other.id, {
          id: other.id,
          entityId: other.id,
          handle: other.handle,
          entityType: other.type,
          brightness: log.plantHealth,
          state: log.state,
        });
      }

      edges.push({
        source: entityId,
        target: other.id,
        strength: log.resonanceScore,
        state: log.state,
      });
    }

    return {
      nodes: Array.from(nodeMap.values()),
      edges,
      subjectEntityId: entityId,
    };
  }

  // ── Stats ─────────────────────────────────────────────────────────────

  getStats(): {
    total: number;
    byState: Record<string, number>;
    avgResonance: number;
  } {
    const all = this.listAll();
    const byState: Record<string, number> = {};
    let totalResonance = 0;

    for (const log of all) {
      byState[log.state] = (byState[log.state] ?? 0) + 1;
      totalResonance += log.resonanceScore;
    }

    return {
      total: all.length,
      byState,
      avgResonance: all.length > 0 ? totalResonance / all.length : 0,
    };
  }

  size(): number {
    return this.logs.size;
  }

  // ── Persistence ───────────────────────────────────────────────────────

  private _load(): void {
    try {
      if (!existsSync(STORE_PATH)) return;
      const raw = readFileSync(STORE_PATH, 'utf-8');
      const data = JSON.parse(raw) as Record<string, FriendshipLog>;
      for (const [id, log] of Object.entries(data)) {
        this.logs.set(id, log);
      }
    } catch {
      // Store doesn't exist or is corrupt — start fresh
    }
  }

  private _flush(): void {
    try {
      if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
      const data: Record<string, FriendshipLog> = {};
      for (const [id, log] of this.logs.entries()) {
        data[id] = log;
      }
      writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Persistence failure is non-fatal — in-memory still works
    }
  }

  /** Force a manual flush (useful in tests and shutdown hooks) */
  flush(): void {
    this._flush();
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

let _instance: FriendshipStore | undefined;

export function getFriendshipStore(options?: { persist?: boolean }): FriendshipStore {
  if (!_instance) {
    _instance = new FriendshipStore(options);
  }
  return _instance;
}

/** Reset singleton (test isolation) */
export function resetFriendshipStore(): void {
  _instance = undefined;
}

