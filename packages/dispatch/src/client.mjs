/**
 * Dispatch Client — task queue interface to the dispatch service.
 *
 * All task operations flow through this client.
 * Maps to routes in dispatch.manifest.json.
 *
 * @capabilityId cap_dispatch_queue
 */

import { getConfig } from '@cle/config';

export class DispatchClient {
  constructor(opts = {}) {
    this.url = opts.url || getConfig('DISPATCH_URL', 'http://localhost:5160');
    this.project = opts.project || getConfig('PROJECT', 'creative-liberation-engine');
  }

  async createTask(task) {
    const res = await fetch(`${this.url}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, project: this.project }),
    });
    if (!res.ok) throw new Error(`Create task failed: ${res.status}`);
    return res.json();
  }

  async claimTask(agentId) {
    const res = await fetch(`${this.url}/api/tasks/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, project: this.project }),
    });
    if (!res.ok) throw new Error(`Claim task failed: ${res.status}`);
    return res.json();
  }

  async completeTask(taskId, result) {
    const res = await fetch(`${this.url}/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    if (!res.ok) throw new Error(`Complete task failed: ${res.status}`);
    return res.json();
  }

  async getStatus() {
    const res = await fetch(`${this.url}/api/status`);
    if (!res.ok) throw new Error(`Status failed: ${res.status}`);
    return res.json();
  }
}

export function createTask(task) { return new DispatchClient().createTask(task); }
export function claimTask(agentId) { return new DispatchClient().claimTask(agentId); }
export function completeTask(taskId, result) { return new DispatchClient().completeTask(taskId, result); }
export function getStatus() { return new DispatchClient().getStatus(); }
