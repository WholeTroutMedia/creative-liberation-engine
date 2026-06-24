/**
 * Agent Router — routes AVERI agent requests to the correct BrowserPool instance.
 * SWITCHBOARD calls this to dispatch browser tasks to the right pool slot.
 */

import { pool } from "./pool.js";
import { taskQueue, type TaskPriority } from "./task-queue.js";

export interface RouteRequest {
    agentId: string;
    tool: string;
    args: Record<string, unknown>;
    priority?: TaskPriority;
}

export interface RouteResult {
    taskId: string;
    instanceId: string;
    agentId: string;
    status: "dispatched" | "queued";
}

export class AgentRouter {
    async route(request: RouteRequest): Promise<RouteResult> {
        const { agentId, tool, args, priority = "P2" } = request;

        try {
            const instance = await pool.acquire(agentId);

            const task = taskQueue.enqueue(agentId, tool, args, priority);
            taskQueue.complete(task.id, { dispatched: true, instanceId: instance.instanceId });

            return {
                taskId: task.id,
                instanceId: instance.instanceId,
                agentId,
                status: "dispatched",
            };
        } catch {
            const task = taskQueue.enqueue(agentId, tool, args, priority);
            return {
                taskId: task.id,
                instanceId: "pending",
                agentId,
                status: "queued",
            };
        }
    }

    status() {
        return {
            pool: pool.status(),
            queue: taskQueue.status(),
            pendingTasks: taskQueue.all().filter(t => t.status === "queued"),
        };
    }
}

export const router = new AgentRouter();
