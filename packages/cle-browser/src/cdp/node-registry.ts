/**
 * Node Registry — Universal Browser Mesh
 *
 * Single source of truth for all connected browser nodes across all modes:
 *   - SOVEREIGN (Playwright-managed Chromium)
 *   - CDP ATTACH (your existing Chrome/Edge/Brave/Arc)
 *   - EXTENSION (Firefox, Safari, any browser with the extension installed)
 */

import type { BrowserNode, NodeMode, NodeStatus } from './cdp-manager.js';

export type { BrowserNode, TabRecord } from './cdp-manager.js';
export type { NodeMode, NodeStatus };

interface RegistryEntry {
  node: BrowserNode;
  updatedAt: Date;
}

class NodeRegistry {
  private nodes: Map<string, RegistryEntry> = new Map();

  register(node: BrowserNode): void {
    this.nodes.set(node.id, { node, updatedAt: new Date() });
    console.error(`[Registry] ✅ ${node.mode.toUpperCase()} node registered: ${node.id} (${node.browser})`);
  }

  unregister(nodeId: string): void {
    this.nodes.delete(nodeId);
    console.error(`[Registry] ❌ Node removed: ${nodeId}`);
  }

  updateStatus(nodeId: string, status: NodeStatus): void {
    const entry = this.nodes.get(nodeId);
    if (entry) {
      entry.node.status = status;
      entry.updatedAt = new Date();
    }
  }

  assignTask(nodeId: string, agentId: string, taskId: string): void {
    const entry = this.nodes.get(nodeId);
    if (entry) {
      entry.node.status = 'busy';
      entry.node.agentId = agentId;
      entry.node.taskId = taskId;
      entry.updatedAt = new Date();
    }
  }

  releaseTask(nodeId: string): void {
    const entry = this.nodes.get(nodeId);
    if (entry) {
      entry.node.status = 'available';
      entry.node.agentId = undefined;
      entry.node.taskId = undefined;
      entry.updatedAt = new Date();
    }
  }

  getAll(): BrowserNode[] {
    return Array.from(this.nodes.values()).map(e => e.node);
  }

  getByMode(mode: NodeMode): BrowserNode[] {
    return this.getAll().filter(n => n.mode === mode);
  }

  getAvailable(): BrowserNode[] {
    return this.getAll().filter(n => n.status === 'available' || n.status === 'idle');
  }

  getBestAvailable(): BrowserNode | null {
    const available = this.getAvailable();
    return (
      available.find(n => n.mode === 'sovereign') ??
      available.find(n => n.mode === 'cdp') ??
      available.find(n => n.mode === 'extension') ??
      null
    );
  }

  get(nodeId: string): BrowserNode | undefined {
    return this.nodes.get(nodeId)?.node;
  }

  summary(): {
    total: number;
    available: number;
    busy: number;
    byMode: Record<NodeMode, number>;
  } {
    const all = this.getAll();
    return {
      total: all.length,
      available: all.filter(n => n.status === 'available' || n.status === 'idle').length,
      busy: all.filter(n => n.status === 'busy').length,
      byMode: {
        sovereign: all.filter(n => n.mode === 'sovereign').length,
        cdp: all.filter(n => n.mode === 'cdp').length,
        extension: all.filter(n => n.mode === 'extension').length,
      },
    };
  }
}

export const nodeRegistry = new NodeRegistry();
