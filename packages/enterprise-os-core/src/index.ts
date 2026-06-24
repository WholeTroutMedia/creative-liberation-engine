import { z } from 'zod';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { ConstitutionMap } from './governance';

// Zod schema based on our JSON schema for runtime validation
const AgentNodeSchema = z.object({
  agentId: z.string(),
  role: z.string(),
  permissions: z.array(z.string()).optional()
});

const AgentEdgeSchema = z.object({
  sourceAgent: z.string(),
  targetAgent: z.string(),
  communicationProtocol: z.enum(['sync', 'async', 'event_stream'])
});

const EnterpriseTopologySchema = z.object({
  version: z.string(),
  topologyId: z.string(),
  governanceLevel: z.enum(['autonomous', 'human_in_the_loop', 'strict_audit']),
  nodes: z.array(AgentNodeSchema),
  edges: z.array(AgentEdgeSchema)
});

type EnterpriseTopology = z.infer<typeof EnterpriseTopologySchema>;

export class AgenticEnterpriseOS {
  private topology: EnterpriseTopology | null = null;
  private messageBus: EventEmitter;
  public constitutionMap: ConstitutionMap;

  constructor() {
    this.messageBus = new EventEmitter();
    this.constitutionMap = new ConstitutionMap(this.messageBus);
  }

  public loadTopology(topologyPath: string): void {
    try {
      const rawData = fs.readFileSync(path.resolve(topologyPath), 'utf-8');
      const parsedData = JSON.parse(rawData);
      
      // Validate against the schema
      this.topology = EnterpriseTopologySchema.parse(parsedData);
      console.log(`[EnterpriseOS] Successfully loaded topology: ${this.topology.topologyId} (Governance: ${this.topology.governanceLevel})`);
      
      this.initializeRouting();
    } catch (error) {
      console.error(`[EnterpriseOS] Failed to load topology:`, error);
      throw error;
    }
  }

  private initializeRouting(): void {
    if (!this.topology) return;

    console.log(`[EnterpriseOS] Initializing routing for ${this.topology.nodes.length} agents...`);
    
    // Register routing rules based on edges
    for (const edge of this.topology.edges) {
      console.log(`[EnterpriseOS] Mapping route: ${edge.sourceAgent} -> ${edge.targetAgent} via ${edge.communicationProtocol}`);
      
      this.messageBus.on(`dispatch:${edge.sourceAgent}:${edge.targetAgent}`, (payload: any) => {
        this.handleDispatch(edge, payload);
      });
    }
  }

  private handleDispatch(edge: z.infer<typeof AgentEdgeSchema>, payload: any): void {
    console.log(`[MessageBus] Routing message from ${edge.sourceAgent} to ${edge.targetAgent} (${edge.communicationProtocol})`);
    
    const governanceLevel = this.topology?.governanceLevel || 'autonomous';
    const canExecute = this.constitutionMap.evaluateDispatch(edge.sourceAgent, edge.targetAgent, payload, governanceLevel);

    if (!canExecute) {
      console.log(`[Governance] Execution halted pending approval for ${edge.targetAgent}`);
      return;
    }

    console.log(`[Governance] Delivering payload to ${edge.targetAgent}`);
    // Simulate delivery
    this.messageBus.emit(`receive:${edge.targetAgent}`, { source: edge.sourceAgent, payload });
  }

  public dispatch(source: string, target: string, payload: any): void {
    if (!this.topology) {
      throw new Error("Topology not loaded");
    }

    // Verify edge exists
    const validRoute = this.topology.edges.find(e => e.sourceAgent === source && e.targetAgent === target);
    
    if (!validRoute) {
      console.error(`[EnterpriseOS] REJECTED: No defined route from ${source} to ${target} in topology.`);
      return;
    }

    this.messageBus.emit(`dispatch:${source}:${target}`, payload);
  }

  // Hook for agents to listen to messages
  public onReceive(agentId: string, callback: (message: any) => void): void {
    this.messageBus.on(`receive:${agentId}`, callback);
  }
}
