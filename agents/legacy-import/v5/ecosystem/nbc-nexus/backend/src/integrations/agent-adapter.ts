/**
 * Agent Adapter Base
 * Common interface for connecting agents to NEXUS Gateway
 */

import { EventEmitter } from 'events';

export interface AgentCapability {
  name: string;
  description: string;
  inputSchema?: any;
  outputSchema?: any;
}

export interface AgentMetadata {
  id: string;
  name: string;
  color: string;
  version: string;
  capabilities: AgentCapability[];
  status: 'active' | 'idle' | 'offline';
}

export interface AgentMessage {
  type: string;
  data: any;
  timestamp: number;
  source?: string;
}

/**
 * Base class for agent adapters
 */
export abstract class AgentAdapter extends EventEmitter {
  protected metadata: AgentMetadata;
  protected connected: boolean = false;

  constructor(metadata: AgentMetadata) {
    super();
    this.metadata = metadata;
  }

  /**
   * Connect agent to Gateway
   */
  async connect(): Promise<void> {
    console.log(`[AgentAdapter] Connecting ${this.metadata.name}...`);
    await this.onConnect();
    this.connected = true;
    this.emit('connected', this.metadata);
    console.log(`[AgentAdapter] ${this.metadata.name} connected`);
  }

  /**
   * Disconnect agent from Gateway
   */
  async disconnect(): Promise<void> {
    console.log(`[AgentAdapter] Disconnecting ${this.metadata.name}...`);
    await this.onDisconnect();
    this.connected = false;
    this.emit('disconnected', this.metadata.id);
    console.log(`[AgentAdapter] ${this.metadata.name} disconnected`);
  }

  /**
   * Send message to Gateway
   */
  protected sendToGateway(message: AgentMessage): void {
    if (!this.connected) {
      console.warn(`[AgentAdapter] ${this.metadata.name} not connected`);
      return;
    }
    this.emit('message', message);
  }

  /**
   * Handle message from Gateway
   */
  async handleMessage(message: AgentMessage): Promise<void> {
    console.log(`[AgentAdapter] ${this.metadata.name} received message:`, message.type);
    await this.onMessage(message);
  }

  /**
   * Get agent metadata
   */
  getMetadata(): AgentMetadata {
    return { ...this.metadata };
  }

  /**
   * Update agent status
   */
  protected updateStatus(status: 'active' | 'idle' | 'offline'): void {
    this.metadata.status = status;
    this.emit('status_change', {
      agentId: this.metadata.id,
      status
    });
  }

  // Abstract methods to be implemented by specific agents
  protected abstract onConnect(): Promise<void>;
  protected abstract onDisconnect(): Promise<void>;
  protected abstract onMessage(message: AgentMessage): Promise<void>;
}
