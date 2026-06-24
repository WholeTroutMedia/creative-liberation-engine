/**
 * ATLAS — Persistent Production Intelligence
 *
 * The Creative Liberation Engine's equivalent of Asteria's Continuum Suite "Atlas" layer.
 * A relational knowledge graph that accumulates context, decisions, characters,
 * scenes, and production state across every agent execution, every session, every flow.
 *
 * Unlike SCRIBE (episodic memory) and WorldState (event bus), Atlas is:
 * - RELATIONAL: nodes reference each other (character → scenes → shots)
 * - PERSISTENT: survives server restarts via JSON-on-disk + ChromaDB semantic index
 * - SELF-UPDATING: every flow commit that touches a production node updates Atlas automatically
 * - QUERYABLE: REST endpoints expose the graph to the Console UI (/atlas)
 *
 * Inspired by: Asteria Continuum Suite "Atlas" (March 2025 launch)
 * Architecture: relational knowledge graph + semantic recall via memoryBus
 */

import { memoryBus } from '@cle/memory';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AtlasNodeType =
  | 'project'
  | 'character'
  | 'scene'
  | 'shot'
  | 'asset'
  | 'decision'
  | 'agent_run'
  | 'deliverable';

export interface AtlasNode {
  id: string;
  type: AtlasNodeType;
  label: string;
  properties: Record<string, string | number | boolean | string[]>;
  relations: AtlasRelation[];
  createdAt: string;
  updatedAt: string;
  /** Provenance chain — who created/modified this node */
  provenance: Array<{ agent: string; action: string; at: string }>;
}

export interface AtlasRelation {
  type: 'belongs_to' | 'references' | 'depends_on' | 'produced_by' | 'approved_by' | 'derived_from';
  targetId: string;
  targetType: AtlasNodeType;
  label: string;
}

export interface AtlasGraph {
  version: number;
  lastUpdated: string;
  nodeCount: number;
  nodes: Record<string, AtlasNode>;
}

export interface AtlasQueryResult {
  nodes: AtlasNode[];
  totalFound: number;
  query: string;
}

export interface AtlasCommitInput {
  type: AtlasNodeType;
  label: string;
  properties?: Record<string, string | number | boolean | string[]>;
  relations?: AtlasRelation[];
  agentName?: string;
  action?: string;
  /** If provided, merges with existing node of this ID instead of creating new */
  existingId?: string;
}

// ── Storage ───────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ATLAS_FILE = path.resolve(__dirname, '../../../data/atlas-graph.json');

function ensureDataDir(): void {
  const dir = path.dirname(ATLAS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generateId(type: AtlasNodeType): string {
  const prefix = type.slice(0, 3).toUpperCase();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── AtlasManager ─────────────────────────────────────────────────────────────

export class AtlasManager {
  private cache: AtlasGraph | null = null;

  // ── Read ──────────────────────────────────────────────────────────────────

  async getGraph(): Promise<AtlasGraph> {
    if (this.cache) return this.cache;
    ensureDataDir();
    try {
      if (fs.existsSync(ATLAS_FILE)) {
        const raw = fs.readFileSync(ATLAS_FILE, 'utf-8');
        this.cache = JSON.parse(raw) as AtlasGraph;
        return this.cache;
      }
    } catch (err) {
      console.warn('[Atlas] Failed to load graph from disk, starting fresh:', (err as Error).message);
    }
    const empty: AtlasGraph = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      nodeCount: 0,
      nodes: {},
    };
    this.cache = empty;
    return empty;
  }

  async getNode(id: string): Promise<AtlasNode | null> {
    const graph = await this.getGraph();
    return graph.nodes[id] ?? null;
  }

  async queryByType(type: AtlasNodeType): Promise<AtlasNode[]> {
    const graph = await this.getGraph();
    return Object.values(graph.nodes).filter(n => n.type === type);
  }

  /** Semantic search across node labels + properties via memoryBus */
  async search(query: string, limit = 10): Promise<AtlasQueryResult> {
    try {
      const results = await memoryBus.recall({
        query: `atlas-node: ${query}`,
        agentName: 'ATLAS',
        limit,
        successOnly: true,
      });

      // Resolve recalled IDs back to full Atlas nodes
      const graph = await this.getGraph();
      const nodes: AtlasNode[] = [];

      for (const result of results) {
        // outcome stores the node id
        const nodeId = result.outcome?.replace('atlas-node:', '').trim();
        if (nodeId && graph.nodes[nodeId]) {
          nodes.push(graph.nodes[nodeId]);
        }
      }

      // Fallback: if memoryBus returns nothing, do a label substring match
      if (nodes.length === 0) {
        const all = Object.values(graph.nodes);
        const lower = query.toLowerCase();
        nodes.push(...all.filter(n =>
          n.label.toLowerCase().includes(lower) ||
          Object.values(n.properties).some(v => String(v).toLowerCase().includes(lower))
        ).slice(0, limit));
      }

      return { nodes, totalFound: nodes.length, query };
    } catch (err) {
      console.warn('[Atlas] Search fallback (memoryBus unavailable):', (err as Error).message);
      const graph = await this.getGraph();
      const all = Object.values(graph.nodes);
      const lower = query.toLowerCase();
      const nodes = all.filter(n => n.label.toLowerCase().includes(lower)).slice(0, limit);
      return { nodes, totalFound: nodes.length, query };
    }
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  async commit(input: AtlasCommitInput): Promise<AtlasNode> {
    const graph = await this.getGraph();
    const now = new Date().toISOString();

    let node: AtlasNode;

    if (input.existingId && graph.nodes[input.existingId]) {
      // Merge into existing node
      const existing = graph.nodes[input.existingId];
      node = {
        ...existing,
        label: input.label ?? existing.label,
        properties: { ...existing.properties, ...(input.properties ?? {}) },
        relations: [
          ...existing.relations,
          ...(input.relations ?? []).filter(r =>
            !existing.relations.some(er => er.targetId === r.targetId && er.type === r.type)
          ),
        ],
        updatedAt: now,
        provenance: [
          ...existing.provenance,
          { agent: input.agentName ?? 'ATLAS', action: input.action ?? 'update', at: now },
        ],
      };
    } else {
      // Create new node
      const id = generateId(input.type);
      node = {
        id,
        type: input.type,
        label: input.label,
        properties: input.properties ?? {},
        relations: input.relations ?? [],
        createdAt: now,
        updatedAt: now,
        provenance: [{ agent: input.agentName ?? 'ATLAS', action: input.action ?? 'create', at: now }],
      };
    }

    graph.nodes[node.id] = node;
    graph.nodeCount = Object.keys(graph.nodes).length;
    graph.lastUpdated = now;
    graph.version += 1;

    this.cache = graph;
    this._persist(graph);

    // Index in ChromaDB for semantic search
    this._indexNode(node).catch((err: Error) =>
      console.warn('[Atlas] ChromaDB index failed (non-critical):', err.message)
    );

    console.log(`[Atlas] ✦ ${node.type}:${node.id} "${node.label}" — v${graph.version}`);
    return node;
  }

  async deleteNode(id: string): Promise<boolean> {
    const graph = await this.getGraph();
    if (!graph.nodes[id]) return false;
    delete graph.nodes[id];
    graph.nodeCount = Object.keys(graph.nodes).length;
    graph.lastUpdated = new Date().toISOString();
    graph.version += 1;
    this.cache = graph;
    this._persist(graph);
    return true;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(): Promise<{
    totalNodes: number;
    byType: Record<string, number>;
    version: number;
    lastUpdated: string;
  }> {
    const graph = await this.getGraph();
    const byType: Record<string, number> = {};
    for (const node of Object.values(graph.nodes)) {
      byType[node.type] = (byType[node.type] ?? 0) + 1;
    }
    return {
      totalNodes: graph.nodeCount,
      byType,
      version: graph.version,
      lastUpdated: graph.lastUpdated,
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _persist(graph: AtlasGraph): void {
    try {
      ensureDataDir();
      fs.writeFileSync(ATLAS_FILE, JSON.stringify(graph, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[Atlas] Disk persist failed (non-critical):', (err as Error).message);
    }
  }

  private async _indexNode(node: AtlasNode): Promise<void> {
    const text = `${node.type} ${node.label} ${Object.values(node.properties).join(' ')}`;
    await memoryBus.commit({
      agentName: 'ATLAS',
      task: `atlas-index: ${node.type}/${node.id}`,
      outcome: `atlas-node:${node.id}`,
      tags: ['atlas', node.type, node.id],
      sessionId: `atlas_v${node.id}`,
      success: true,
      // Store the text embedding hint
      metadata: { nodeId: node.id, nodeType: node.type, label: node.label, text },
    });
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const atlas = new AtlasManager();
