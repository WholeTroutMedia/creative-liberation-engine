import { VirtualSynchronyMachine, VSMTaskSchema, VSMTask } from './vsm';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Phase 14: Swarm Healing & Live Re-Assignment
 * Monitors the Virtual Synchrony Machine. If an agent crashes natively (Node.js segfault, OOM kill),
 * it cannot cleanly release its VSM lock or its active task.
 * The SwarmHealer detects dead tasks based on `updatedAtMs` staleness and auto-requeues them.
 */
export class SwarmHealer {
  private vsmDir: string;
  private queueFile: string;
  private readonly TASK_TIMEOUT_MS = 1200000; // 20 minutes before an agent is declared KIA

  constructor(workspaceRoot: string) {
    this.vsmDir = path.join(workspaceRoot, '.agents', 'custody', 'vsm');
    this.queueFile = path.join(this.vsmDir, 'queue.json');
  }

  /**
   * Scans the VSM queue. Any task marked 'claimed' that hasn't been updated
   * in 20 minutes is presumed to belong to a dead agent.
   * The SwarmHealer instantly unassigns the task, marks it 'open', and lets
   * another healthy agent pick it up.
   */
  async executeHealingSweep(): Promise<number> {
    try {
      const raw = await fs.readFile(this.queueFile, 'utf-8');
      const queue: VSMTask[] = JSON.parse(raw);
      
      const now = Date.now();
      let healedCount = 0;

      for (const task of queue) {
        if (task.status === 'claimed') {
          const age = now - task.updatedAtMs;
          if (age > this.TASK_TIMEOUT_MS) {
            // Agent crashed. Strip lock, re-assign
            console.warn(`[SWARM-HEALER] Agent ${task.assignedTo} died on Task ${task.id}. Re-routing.`);
            task.status = 'open';
            task.assignedTo = undefined;
            task.updatedAtMs = now;
            healedCount++;
          }
        }
      }

      if (healedCount > 0) {
        // In reality, this requires Arbiter lock to not race the queue write
        await fs.writeFile(this.queueFile, JSON.stringify(queue, null, 2), 'utf-8');
      }

      return healedCount;
    } catch {
      return 0; // VSM hasn't booted yet or no queue exists
    }
  }
}
