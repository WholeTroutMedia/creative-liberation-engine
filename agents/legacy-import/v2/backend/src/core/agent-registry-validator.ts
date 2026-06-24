/**
 * Agent Registry Validator
 * Enforces AGENT_BOOT_PROTOCOL compliance
 * Prevents operations on non-existent agents
 */

import fs from 'fs';
import path from 'path';

interface AgentRegistry {
  system_version: string;
  metadata: {
    total_agents_decompressed: number;
    active_agents: number;
  };
  agents: Record<string, any>;
}

export class AgentRegistryValidator {
  private registry: AgentRegistry | null = null;
  private registryPath: string;

  constructor() {
    this.registryPath = path.resolve(__dirname, '../../../agents/.agent-status.json');
  }

  /**
   * Load the agent registry (MANDATORY before any agent operations)
   */
  public loadRegistry(): AgentRegistry {
    if (!fs.existsSync(this.registryPath)) {
      throw new Error(
        `CRITICAL: Agent registry not found at ${this.registryPath}. ` +
        `System cannot operate without source of truth.`
      );
    }

    try {
      const data = fs.readFileSync(this.registryPath, 'utf-8');
      this.registry = JSON.parse(data);
      return this.registry!;
    } catch (error) {
      throw new Error(
        `CRITICAL: Failed to parse agent registry. ` +
        `Error: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  /**
   * Validate that an agent exists in the registry
   * BLOCKS operations on non-existent agents
   */
  public validateAgentExists(agentId: string): {
    exists: boolean;
    agent?: any;
    error?: string;
    suggestions?: string[];
  } {
    if (!this.registry) {
      this.loadRegistry();
    }

    const exists = agentId in this.registry!.agents;

    if (!exists) {
      // Find similar names for helpful error message
      const allAgents = Object.keys(this.registry!.agents);
      const suggestions = allAgents.filter(name => 
        name.toLowerCase().includes(agentId.toLowerCase()) ||
        agentId.toLowerCase().includes(name.toLowerCase())
      );

      return {
        exists: false,
        error: `Agent "${agentId}" not found in registry. Did you load .agent-status.json first?`,
        suggestions: suggestions.length > 0 ? suggestions : allAgents.slice(0, 5)
      };
    }

    return {
      exists: true,
      agent: this.registry!.agents[agentId]
    };
  }

  /**
   * Get all valid agent names (for validation)
   */
  public getAllAgentNames(): string[] {
    if (!this.registry) {
      this.loadRegistry();
    }
    return Object.keys(this.registry!.agents);
  }

  /**
   * Get agent count from registry
   */
  public getAgentCount(): { compressed: number; decompressed: number; active: number } {
    if (!this.registry) {
      this.loadRegistry();
    }
    return {
      compressed: this.registry!.metadata.total_agents_compressed || 0,
      decompressed: this.registry!.metadata.total_agents_decompressed || 0,
      active: this.registry!.metadata.active_agents || 0
    };
  }

  /**
   * Get agent workspace path from registry
   */
  public getAgentWorkspace(agentId: string): string | null {
    const validation = this.validateAgentExists(agentId);
    if (!validation.exists) {
      return null;
    }
    return validation.agent?.workspace || null;
  }

  /**
   * Get system version from registry
   */
  public getSystemVersion(): string {
    if (!this.registry) {
      this.loadRegistry();
    }
    return this.registry!.system_version;
  }

  /**
   * Validate agent status (active/preparing/planned)
   */
  public getAgentStatus(agentId: string): string | null {
    const validation = this.validateAgentExists(agentId);
    if (!validation.exists) {
      return null;
    }
    return validation.agent?.status || null;
  }

  /**
   * Generate boot protocol compliance report
   */
  public generateBootReport(): {
    system_version: string;
    total_agents: number;
    active_agents: number;
    agent_names: string[];
    timestamp: string;
  } {
    if (!this.registry) {
      this.loadRegistry();
    }

    return {
      system_version: this.registry!.system_version,
      total_agents: this.registry!.metadata.total_agents_decompressed,
      active_agents: this.registry!.metadata.active_agents,
      agent_names: Object.keys(this.registry!.agents),
      timestamp: new Date().toISOString()
    };
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistryValidator();

/**
 * Decorator to enforce registry check before function execution
 */
export function RequiresAgentValidation(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = function(...args: any[]) {
    const agentId = args[0]?.agentId || args[0];
    
    if (typeof agentId === 'string') {
      const validation = agentRegistry.validateAgentExists(agentId);
      
      if (!validation.exists) {
        throw new Error(
          `AGENT_BOOT_PROTOCOL VIOLATION: ${validation.error}\n` +
          `Suggestions: ${validation.suggestions?.join(', ') || 'Load .agent-status.json'}`
        );
      }
    }

    return originalMethod.apply(this, args);
  };

  return descriptor;
}
