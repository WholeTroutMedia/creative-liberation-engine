/**
 * Agent Mail — inter-agent messaging.
 *
 * Allows agents to send structured messages to each other
 * through the dispatch queue. Messages are tasks with type 'agent_mail'.
 *
 * @capabilityId cap_agent_mail
 */

import { DispatchClient } from './client.mjs';

export class AgentMail {
  constructor(agentId, opts = {}) {
    this.agentId = agentId;
    this.dispatch = new DispatchClient(opts);
  }

  async send(toAgentId, message) {
    return this.dispatch.createTask({
      type: 'agent_mail',
      input: {
        from: this.agentId,
        to: toAgentId,
        subject: message.subject,
        body: message.body,
        priority: message.priority || 'normal',
        timestamp: new Date().toISOString(),
      },
    });
  }

  async check() {
    // Check for mail addressed to this agent
    return this.dispatch.claimTask(this.agentId);
  }
}

export function sendMail(fromAgent, toAgent, message, opts) {
  return new AgentMail(fromAgent, opts).send(toAgent, message);
}
export function checkMail(agentId, opts) {
  return new AgentMail(agentId, opts).check();
}
