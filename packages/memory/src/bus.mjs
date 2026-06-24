/**
 * Memory Bus — core memory record management.
 *
 * Implements the lifecycle state machine from MEMORY_SPINE.md:
 *   draft → active → canonical | superseded | deprecated | archived
 *
 * All memory providers (SCRIBE, VAULT, KI, HANDOFF, DISPATCH, MANUAL)
 * write through this bus.
 *
 * @capabilityId cap_memory_live_bus
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const VALID_STATES = ['draft', 'active', 'canonical', 'superseded', 'deprecated', 'archived'];
const VALID_KINDS = ['decision', 'pattern', 'session', 'reference', 'lesson', 'specification'];
const VALID_PROVIDERS = ['SCRIBE', 'VAULT', 'KI', 'HANDOFF', 'DISPATCH', 'MANUAL'];
const MEMORY_ID_PATTERN = /^mem_[a-z0-9_\-]{6,80}$/;

/**
 * Memory Bus — manages memory collections on disk.
 */
export class MemoryBus {
  /**
   * @param {string} memoryDir - Path to runtime/memory directory
   */
  constructor(memoryDir) {
    this.memoryDir = memoryDir;
    if (!existsSync(memoryDir)) mkdirSync(memoryDir, { recursive: true });
  }

  /**
   * Load a memory collection from disk.
   * @param {string} collection - Collection name (e.g., 'patterns', 'sessions')
   * @returns {object}
   */
  loadCollection(collection) {
    const path = join(this.memoryDir, `${collection}.index.json`);
    if (!existsSync(path)) {
      return { collectionId: collection, version: 'v6.0', entries: [] };
    }
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  /**
   * Save a memory collection to disk.
   * @param {string} collection
   * @param {object} data
   */
  saveCollection(collection, data) {
    const path = join(this.memoryDir, `${collection}.index.json`);
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  }

  /**
   * Create a new memory record.
   * @param {string} collection
   * @param {object} record
   * @returns {object} The created record
   */
  create(collection, record) {
    if (!MEMORY_ID_PATTERN.test(record.memoryId)) {
      throw new Error(`Invalid memoryId: ${record.memoryId}`);
    }
    if (!VALID_KINDS.includes(record.kind)) {
      throw new Error(`Invalid kind: ${record.kind}. Must be one of: ${VALID_KINDS.join(', ')}`);
    }
    if (!VALID_PROVIDERS.includes(record.provider)) {
      throw new Error(`Invalid provider: ${record.provider}. Must be one of: ${VALID_PROVIDERS.join(', ')}`);
    }

    const data = this.loadCollection(collection);
    const existing = data.entries.find(e => e.memoryId === record.memoryId);
    if (existing) throw new Error(`Duplicate memoryId: ${record.memoryId}`);

    const enriched = {
      ...record,
      lifecycleState: record.lifecycleState || 'draft',
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.entries.push(enriched);
    this.saveCollection(collection, data);
    return enriched;
  }

  /**
   * Update the lifecycle state of a memory record.
   * @param {string} collection
   * @param {string} memoryId
   * @param {string} newState
   * @returns {object}
   */
  updateLifecycle(collection, memoryId, newState) {
    if (!VALID_STATES.includes(newState)) {
      throw new Error(`Invalid state: ${newState}`);
    }
    const data = this.loadCollection(collection);
    const record = data.entries.find(e => e.memoryId === memoryId);
    if (!record) throw new Error(`Record not found: ${memoryId}`);

    record.lifecycleState = newState;
    record.updatedAt = new Date().toISOString();
    this.saveCollection(collection, data);
    return record;
  }

  /**
   * Query records across collections.
   * @param {string} collection
   * @param {object} [filter]
   * @param {string} [filter.kind]
   * @param {string} [filter.provider]
   * @param {string} [filter.lifecycleState]
   * @returns {object[]}
   */
  query(collection, filter = {}) {
    const data = this.loadCollection(collection);
    return data.entries.filter(entry => {
      if (filter.kind && entry.kind !== filter.kind) return false;
      if (filter.provider && entry.provider !== filter.provider) return false;
      if (filter.lifecycleState && entry.lifecycleState !== filter.lifecycleState) return false;
      return true;
    });
  }
}

/** Convenience wrappers */
export function createMemoryRecord(memoryDir, collection, record) {
  return new MemoryBus(memoryDir).create(collection, record);
}

export function updateLifecycle(memoryDir, collection, memoryId, newState) {
  return new MemoryBus(memoryDir).updateLifecycle(collection, memoryId, newState);
}

export function queryMemory(memoryDir, collection, filter) {
  return new MemoryBus(memoryDir).query(collection, filter);
}
