interface AgentConfig {
  name: string;
  port: number;
  endpoint: string;
}

interface AgentResult {
  success: boolean;
  message: string;
  filesChanged?: string[];
}

export class AgentRouter {
  private agents: Map<string, AgentConfig> = new Map([
    ['COMET', { name: 'COMET', port: 3002, endpoint: '/api/task' }],
    ['Aurora', { name: 'Aurora', port: 3003, endpoint: '/api/design' }],
    ['BOLT', { name: 'BOLT', port: 3004, endpoint: '/api/build' }],
  ]);

  async startAgents(): Promise<void> {
    for (const [name, config] of this.agents) {
      const isRunning = await this.checkAgentHealth(config);
      console.log(`   ${name}: ${isRunning ? '✅' : '⏸️  (not started)'}`);
    }
  }

  async stopAgents(): Promise<void> {}

  async route(agentName: string, task: string, context?: string[]): Promise<AgentResult> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      return {
        success: false,
        message: `Agent "${agentName}" not found. Available: ${Array.from(this.agents.keys()).join(', ')}`
      };
    }

    try {
      const response = await fetch(`http://localhost:${agent.port}${agent.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, context }),
        signal: AbortSignal.timeout(300000)
      });

      if (!response.ok) throw new Error(`Agent returned ${response.status}`);
      const result = await response.json();
      return {
        success: true,
        message: result.message || `${agentName} completed the task`,
        filesChanged: result.filesChanged
      };
    } catch (error: any) {
      return {
        success: false,
        message: `${agentName} is offline. Start with: npm run agent:${agentName.toLowerCase()}`
      };
    }
  }

  private async checkAgentHealth(config: AgentConfig): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${config.port}/health`, {
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
