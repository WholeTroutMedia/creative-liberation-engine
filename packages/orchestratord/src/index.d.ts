export interface Task {
    id: string;
    type: string;
    brief: string;
    priority: "low" | "medium" | "high";
    status: "queued" | "assigned" | "running" | "completed" | "failed";
    workerId?: string;
    createdAt: Date;
}
export interface Worker {
    id: string;
    name: string;
    capabilities: string[];
    status: "idle" | "busy" | "offline";
    lastHeartbeat: Date;
}
export declare class SwarmDispatcher {
    private queue;
    private workers;
    registerWorker(name: string, capabilities: string[]): string;
    enqueueTask(type: string, brief: string, priority?: "low" | "medium" | "high"): Task;
    private matchTasks;
    private executeTask;
    getQueueStatus(): {
        totalQueued: number;
        activeWorkers: number;
        tasks: Task[];
    };
}
//# sourceMappingURL=index.d.ts.map