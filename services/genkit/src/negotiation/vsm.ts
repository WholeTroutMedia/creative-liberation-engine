import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { NegotiationManager } from './arbiter';

export const VSMTaskSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  status: z.enum(['open', 'claimed', 'completed', 'failed']),
  assignedTo: z.string().optional(),
  createdAtMs: z.number(),
  updatedAtMs: z.number()
});
export type VSMTask = z.infer<typeof VSMTaskSchema>;

/**
 * Phase 10: Virtual Synchrony Machine (VSM)
 * Operates a decentralized masterless task queue for offline Swarms.
 * Uses Pheromone Arbitration to prevent race conditions during task claiming.
 */
export class VirtualSynchronyMachine {
  private vsmDir: string;
  private queueFile: string;
  private arbiter: NegotiationManager;

  constructor(workspaceRoot: string) {
    this.vsmDir = path.join(workspaceRoot, '.agents', 'custody', 'vsm');
    this.queueFile = path.join(this.vsmDir, 'queue.json');
    this.arbiter = new NegotiationManager(workspaceRoot);
  }

  private async init(): Promise<void> {
    await fs.mkdir(this.vsmDir, { recursive: true });
  }

  private async readQueue(): Promise<VSMTask[]> {
    try {
      const raw = await fs.readFile(this.queueFile, 'utf-8');
      return z.array(VSMTaskSchema).parse(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  private async writeQueue(queue: VSMTask[]): Promise<void> {
    await fs.writeFile(this.queueFile, JSON.stringify(queue, null, 2), 'utf-8');
  }

  /** Add a task to the offline swarm queue */
  async publishTask(description: string): Promise<string> {
    await this.init();
    const task: VSMTask = {
      id: randomUUID(),
      description,
      status: 'open',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now()
    };
    
    // In a real high-throughput swarm, publishTask should also acquire arbitrary locks, 
    // but we can assume atomic write capabilities or single-producer for now.
    const queue = await this.readQueue();
    queue.push(task);
    await this.writeQueue(queue);
    return task.id;
  }

  /**
   * Agent requests the next available task from the decentralized queue.
   * Utilizes the Check-the-Checker Arbiter to prevent collisions.
   */
  async claimNextTask(agentId: string): Promise<VSMTask | null> {
    await this.init();

    const resourceId = 'vsm/queue.json';
    const req = await this.arbiter.requestResource({
      agentId,
      resourceId,
      priority: 'high',
      ttlMs: 5000 // Very short TTL, just need to grab the task and release
    });

    if (!req.success) {
      // Failed to acquire lock, another agent is claiming a task right now.
      return null;
    }

    try {
      const queue = await this.readQueue();
      const nextTask = queue.find(t => t.status === 'open');
      
      if (!nextTask) return null;

      nextTask.status = 'claimed';
      nextTask.assignedTo = agentId;
      nextTask.updatedAtMs = Date.now();
      
      await this.writeQueue(queue);
      return nextTask;
    } finally {
      // Must release the resource so other agents can claim their tasks
      await this.arbiter.releaseResource(resourceId, agentId);
    }
  }
}
