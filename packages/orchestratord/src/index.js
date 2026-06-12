"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmDispatcher = void 0;
const uuid_1 = require("uuid");
class SwarmDispatcher {
    queue = [];
    workers = new Map();
    // Register a new worker daemon (e.g. devd, scribed)
    registerWorker(name, capabilities) {
        const id = (0, uuid_1.v4)();
        this.workers.set(id, {
            id,
            name,
            capabilities,
            status: "idle",
            lastHeartbeat: new Date(),
        });
        console.log(`[orchestratord] Registered worker daemon: ${name} (ID: ${id})`);
        return id;
    }
    // Enqueue a new brief task
    enqueueTask(type, brief, priority = "medium") {
        const task = {
            id: (0, uuid_1.v4)(),
            type,
            brief,
            priority,
            status: "queued",
            createdAt: new Date(),
        };
        this.queue.push(task);
        console.log(`[orchestratord] Enqueued task: [${type}] "${brief}" (Priority: ${priority})`);
        this.matchTasks();
        return task;
    }
    // Match queued tasks to idle workers
    matchTasks() {
        const queuedTasks = this.queue.filter(t => t.status === "queued");
        if (queuedTasks.length === 0)
            return;
        for (const task of queuedTasks) {
            // Find eligible idle worker
            const worker = Array.from(this.workers.values()).find(w => w.status === "idle" && w.capabilities.includes(task.type));
            if (worker) {
                task.status = "assigned";
                task.workerId = worker.id;
                worker.status = "busy";
                console.log(`[orchestratord] Assigned task ${task.id} [${task.type}] to worker daemon ${worker.name}`);
                // Simulate execution
                this.executeTask(task, worker);
            }
        }
    }
    executeTask(task, worker) {
        task.status = "running";
        console.log(`[orchestratord] Swarm worker ${worker.name} executing task: "${task.brief}"`);
        setTimeout(() => {
            task.status = "completed";
            worker.status = "idle";
            console.log(`[orchestratord] Swarm worker ${worker.name} COMPLETED task ${task.id} successfully.`);
            this.matchTasks(); // Trigger next match in queue
        }, 3000);
    }
    getQueueStatus() {
        return {
            totalQueued: this.queue.length,
            activeWorkers: this.workers.size,
            tasks: this.queue,
        };
    }
}
exports.SwarmDispatcher = SwarmDispatcher;
// Instantiate dispatcher singleton
const dispatcher = new SwarmDispatcher();
// Mock worker auto-registrations for V7 UNIX-style testing
dispatcher.registerWorker("devd", ["code", "refactor", "build"]);
dispatcher.registerWorker("scribed", ["copywrite", "script", "document"]);
dispatcher.registerWorker("foleyd", ["audio", "sound_synthesis"]);
// Enqueue basic creative bootstrap tasks
dispatcher.enqueueTask("copywrite", "Drafting core V7 sovereign user documentation");
dispatcher.enqueueTask("code", "Bootstrapping Aegis-Sense local Rust system prober bindings");
//# sourceMappingURL=index.js.map