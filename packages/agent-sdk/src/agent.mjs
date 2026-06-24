/**
 * Agent — core agent lifecycle.
 * @capabilityId cap_cle_agent_sdk
 */
export class Agent {
  constructor({ agentId, name, skills = [], config = {} }) {
    this.agentId = agentId; this.name = name; this.skills = skills; this.config = config;
    this.state = 'idle';
  }
  async init() { this.state = 'ready'; return this; }
  async execute(task) { this.state = 'running'; return { agentId: this.agentId, task, status: 'completed' }; }
  async shutdown() { this.state = 'stopped'; }
}
export function createAgent(opts) { return new Agent(opts).init(); }
export function defineSkill(id, handler) { return { skillId: id, handler }; }
export function defineWorkflow(id, steps) { return { workflowId: id, steps }; }
