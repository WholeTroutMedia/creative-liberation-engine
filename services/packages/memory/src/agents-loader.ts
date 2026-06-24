import fs from 'fs/promises';
import path from 'path';
import { MemoryEnvelope } from './bus.js';

export interface AgentsLoaderOpts {
  serviceName?: string;
  userId?: string;
  projectPath?: string;
}

export class AgentsLoader {
  private readonly REPO_ROOT = process.env.REPO_DIR || (process.platform === 'win32' 
      ? `d:\\Google Antigravity\\Infusion Engine Brainchild\\creative-liberation-engine-v5`
      : `/repo`);

  /**
   * AgentsLoader — Hierarchical instruction layer resolver
   * 
   * Resolution order (most specific wins, all layers merged):
   *   1. ENGINE:  creative-liberation-engine-v5/AGENTS.md
   *   2. SERVICE: creative-liberation-engine-v5/services/{serviceName}/AGENTS.md  (optional)
   *   3. USER:    users/{userId}/AGENTS.md  (sovereign user dir, optional)
   *   4. PROJECT: .agents/AGENTS.md within a project working dir (optional)
   */
  async load(opts: AgentsLoaderOpts = {}): Promise<string> {
    const layers: string[] = [];

    // 1. ENGINE
    const enginePath = path.join(this.REPO_ROOT, 'AGENTS.md');
    try {
      const engineContent = await fs.readFile(enginePath, 'utf8');
      layers.push(`--- ENGINE LAYER (${enginePath}) ---\n${engineContent}`);
    } catch (e) {
      // Missing engine layer is not fatal, but highly unusual
    }

    // 2. SERVICE
    if (opts.serviceName) {
      const servicePath = path.join(this.REPO_ROOT, 'services', opts.serviceName, 'AGENTS.md');
      try {
        const serviceContent = await fs.readFile(servicePath, 'utf8');
        layers.push(`--- SERVICE LAYER (${servicePath}) ---\n${serviceContent}`);
      } catch (e) {}
    }

    // 3. USER
    if (opts.userId) {
      const userPath = path.join(this.REPO_ROOT, 'users', opts.userId, 'AGENTS.md');
      try {
        const userContent = await fs.readFile(userPath, 'utf8');
        layers.push(`--- USER LAYER (${userPath}) ---\n${userContent}`);
      } catch (e) {}
    }

    // 4. PROJECT
    if (opts.projectPath) {
      const projectPath = path.join(opts.projectPath, '.agents', 'AGENTS.md');
      try {
        const projectContent = await fs.readFile(projectPath, 'utf8');
        layers.push(`--- PROJECT LAYER (${projectPath}) ---\n${projectContent}`);
      } catch (e) {}
    }

    return layers.join('\n\n');
  }

  async getInstructionLayer(opts: AgentsLoaderOpts = {}): Promise<MemoryEnvelope> {
    const content = await this.load(opts);

    return {
      id: `mem_instr_${Date.now()}`,
      ts: new Date().toISOString(),
      surface: 'instruction',
      trace_id: 'system',
      agent: 'system:agents-loader',
      level: 'INFO',
      payload: {
        type: 'memory_layer',
        layer: 'instruction',
        content,
      }
    };
  }
}
