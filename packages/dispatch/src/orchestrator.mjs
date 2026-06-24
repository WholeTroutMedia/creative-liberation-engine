/**
 * Orchestrator — workflow execution engine.
 *
 * Executes multi-step workflows by dispatching tasks in sequence
 * or parallel, tracking state, and handling failures.
 *
 * @capabilityId cap_orchestrator
 */

import { DispatchClient } from './client.mjs';

export class Orchestrator {
  constructor(opts = {}) {
    this.dispatch = new DispatchClient(opts);
  }

  /**
   * Execute a workflow definition.
   * @param {object} workflow
   * @param {string} workflow.workflowId
   * @param {object[]} workflow.steps - Ordered steps
   * @param {string} workflow.steps[].taskType - Task type
   * @param {object} workflow.steps[].input - Task input
   * @param {string} [workflow.steps[].dependsOn] - Previous step ID
   * @returns {Promise<object>} Execution result
   */
  async run(workflow) {
    const results = {};
    console.log(`[orchestrator] Starting workflow: ${workflow.workflowId} (${workflow.steps.length} steps)`);

    for (const [i, step] of workflow.steps.entries()) {
      const stepId = step.stepId || `step_${i}`;

      // Check dependency
      if (step.dependsOn && !results[step.dependsOn]) {
        throw new Error(`Step ${stepId} depends on ${step.dependsOn} which has not completed`);
      }

      console.log(`[orchestrator] Step ${i + 1}/${workflow.steps.length}: ${step.taskType}`);

      const task = await this.dispatch.createTask({
        type: step.taskType,
        input: step.input,
        metadata: { workflowId: workflow.workflowId, stepId },
      });

      results[stepId] = { taskId: task.id, status: 'created', step };
    }

    return { workflowId: workflow.workflowId, results };
  }
}

export function runWorkflow(workflow, opts) {
  return new Orchestrator(opts).run(workflow);
}
