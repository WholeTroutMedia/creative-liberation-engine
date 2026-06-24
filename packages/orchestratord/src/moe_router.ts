import * as fs from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export interface MappedAgent {
  agentId: string;
  name: string;
  kind: string;
  status: string;
  hive: string;
  aliases: string[];
}

export interface MappedLora {
  loraId: string;
  name: string;
  kind: string;
  status: string;
  aliases: string[];
}

export class AgenticMoERouter {
  private agents: MappedAgent[] = [];
  private loras: MappedLora[] = [];
  
  // VRAM tracking parameters for Punica/S-LoRA simulation
  private vramLimitGb: number = 16.0;
  private baseModelVramGb: number = 10.0;
  private loraVramGb: number = 1.5;
  private loadedLoras: Set<string> = new Set();

  constructor() {
    this.loadRegistries();
  }

  private loadRegistries(): void {
    try {
      const agentsPath = join(__dirname, '../../../../runtime/registry/agents.canonical.json');
      const lorasPath = join(__dirname, '../../../../runtime/registry/loras.canonical.json');

      if (fs.existsSync(agentsPath)) {
        const raw = fs.readFileSync(agentsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.agents = parsed.agents || [];
      }

      if (fs.existsSync(lorasPath)) {
        const raw = fs.readFileSync(lorasPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.loras = parsed.loras || [];
      }
    } catch (err) {
      console.error(`[MOE ROUTER ERROR] Failed to load canonical registries:`, err);
    }
  }

  /**
   * Routes prompt to the top 2-3 target agents and top 2 target LoRAs.
   */
  public route(prompt: string): { agents: string[]; loras: string[] } {
    const tokens = prompt.toLowerCase().split(/\W+/);
    
    // Score agents
    const scoredAgents = this.agents.map(agent => {
      let score = 0;
      const agentKeywords = [
        agent.agentId.toLowerCase(),
        agent.name.toLowerCase(),
        agent.kind.toLowerCase(),
        agent.hive.toLowerCase(),
        ...(agent.aliases || []).map(a => a.toLowerCase())
      ];

      for (const token of tokens) {
        if (token.length < 3) continue;
        for (const kw of agentKeywords) {
          if (kw.includes(token)) {
            score += 1.0;
          }
        }
      }
      return { agentId: agent.agentId, score };
    });

    // Score loras
    const scoredLoras = this.loras.map(lora => {
      let score = 0;
      const loraKeywords = [
        lora.loraId.toLowerCase(),
        lora.name.toLowerCase(),
        lora.kind.toLowerCase(),
        ...(lora.aliases || []).map(a => a.toLowerCase())
      ];

      for (const token of tokens) {
        if (token.length < 3) continue;
        for (const kw of loraKeywords) {
          if (kw.includes(token)) {
            score += 1.0;
          }
        }
      }
      return { loraId: lora.loraId, score };
    });

    // Sort and filter top active matches
    const topAgents = scoredAgents
      .filter(a => a.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(a => a.agentId);

    const topLoras = scoredLoras
      .filter(l => l.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(l => l.loraId);

    // Fallbacks if no keywords matched
    if (topAgents.length === 0) {
      // Default to core orchestrator/athena
      topAgents.push("athena");
    }

    return {
      agents: topAgents,
      loras: topLoras
    };
  }

  /**
   * VRAM-aware dynamic LoRA adapter page table swapping.
   * If adding the requested LoRAs pushes usage over limits, we evict Least Recently Used adapters.
   */
  public async swapAdapters(requiredLoras: string[]): Promise<{
    activeLoras: string[];
    offloadedToCpu: string[];
    currentUsageGb: number;
  }> {
    const offloadedToCpu: string[] = [];
    
    // Add required loras, checking limits
    for (const lora of requiredLoras) {
      if (this.loadedLoras.has(lora)) {
        // Already loaded, bring to front (refresh loaded status)
        this.loadedLoras.delete(lora);
        this.loadedLoras.add(lora);
        continue;
      }

      // Check capacity
      while (this.getCurrentUsageGb() + this.loraVramGb > this.vramLimitGb && this.loadedLoras.size > 0) {
        // Evict oldest (LRU)
        const oldest = this.loadedLoras.values().next().value;
        if (oldest) {
          this.loadedLoras.delete(oldest);
          offloadedToCpu.push(oldest);
        }
      }

      this.loadedLoras.add(lora);
    }

    return {
      activeLoras: Array.from(this.loadedLoras),
      offloadedToCpu,
      currentUsageGb: this.getCurrentUsageGb()
    };
  }

  public getCurrentUsageGb(): number {
    return this.baseModelVramGb + (this.loadedLoras.size * this.loraVramGb);
  }
}
