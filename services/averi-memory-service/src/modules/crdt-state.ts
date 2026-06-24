/**
 * CRDT Local-First State Module — Helix α
 * Extension for averi-memory-service.
 * Offline-resilient state synchronization using CRDTs.
 */
import { randomUUID as uuidv4 } from 'crypto';

export interface CRDTDocument {
  doc_id: string;
  collection: string;
  state: Record<string, CRDTValue>;
  vector_clock: Record<string, number>;
  last_sync: string;
  origin_node: string;
  conflict_count: number;
}

export interface CRDTValue {
  value: unknown;
  timestamp: number;
  node_id: string;
  tombstone: boolean;
}

export interface SyncResult {
  sync_id: string;
  docs_synced: number;
  conflicts_resolved: number;
  bytes_transferred: number;
  duration_ms: number;
  strategy: 'last_writer_wins' | 'merge' | 'manual';
}

const documents = new Map<string, CRDTDocument>();
const NODE_ID = process.env.NODE_ID || `node-${uuidv4().slice(0, 8)}`;

export function createDocument(collection: string, initialState: Record<string, unknown> = {}, docId?: string): CRDTDocument {
  const now = Date.now();
  const state: Record<string, CRDTValue> = {};
  for (const [key, value] of Object.entries(initialState)) {
    state[key] = { value, timestamp: now, node_id: NODE_ID, tombstone: false };
  }
  const doc: CRDTDocument = {
    doc_id: docId || uuidv4(), collection, state,
    vector_clock: { [NODE_ID]: 1 }, last_sync: new Date().toISOString(),
    origin_node: NODE_ID, conflict_count: 0,
  };
  documents.set(doc.doc_id, doc);
  return doc;
}

export function updateField(docId: string, key: string, value: unknown): boolean {
  const doc = documents.get(docId);
  if (!doc) return false;
  doc.state[key] = { value, timestamp: Date.now(), node_id: NODE_ID, tombstone: false };
  doc.vector_clock[NODE_ID] = (doc.vector_clock[NODE_ID] || 0) + 1;
  return true;
}

export function deleteField(docId: string, key: string): boolean {
  const doc = documents.get(docId);
  if (!doc || !doc.state[key]) return false;
  doc.state[key].tombstone = true;
  doc.state[key].timestamp = Date.now();
  doc.state[key].node_id = NODE_ID;
  doc.vector_clock[NODE_ID] = (doc.vector_clock[NODE_ID] || 0) + 1;
  return true;
}

export function mergeRemote(docId: string, remoteState: Record<string, CRDTValue>, remoteClock: Record<string, number>): SyncResult {
  const start = Date.now();
  const doc = documents.get(docId);
  if (!doc) throw new Error(`Document ${docId} not found`);

  let conflicts = 0;
  for (const [key, remoteVal] of Object.entries(remoteState)) {
    const localVal = doc.state[key];
    if (!localVal || remoteVal.timestamp > localVal.timestamp) {
      doc.state[key] = remoteVal;
    } else if (remoteVal.timestamp === localVal.timestamp && remoteVal.node_id !== localVal.node_id) {
      // Conflict — last writer wins by node_id lexicographic order
      if (remoteVal.node_id > localVal.node_id) doc.state[key] = remoteVal;
      conflicts++;
    }
  }

  // Merge vector clocks
  for (const [node, count] of Object.entries(remoteClock)) {
    doc.vector_clock[node] = Math.max(doc.vector_clock[node] || 0, count);
  }

  doc.conflict_count += conflicts;
  doc.last_sync = new Date().toISOString();

  return {
    sync_id: uuidv4(), docs_synced: 1, conflicts_resolved: conflicts,
    bytes_transferred: JSON.stringify(remoteState).length,
    duration_ms: Date.now() - start, strategy: 'last_writer_wins',
  };
}

export function getDocument(docId: string): CRDTDocument | undefined {
  return documents.get(docId);
}

export function getActiveState(docId: string): Record<string, unknown> {
  const doc = documents.get(docId);
  if (!doc) return {};
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(doc.state)) {
    if (!val.tombstone) result[key] = val.value;
  }
  return result;
}
