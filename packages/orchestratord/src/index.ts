import { v4 as uuidv4 } from "uuid";

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

export class SwarmDispatcher {
  private queue: Task[] = [];
  private workers: Map<string, Worker> = new Map();

  // Register a new worker daemon (e.g. devd, scribed)
  public registerWorker(name: string, capabilities: string[]): string {
    const id = uuidv4();
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
  public enqueueTask(type: string, brief: string, priority: "low" | "medium" | "high" = "medium"): Task {
    const task: Task = {
      id: uuidv4(),
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
  private matchTasks() {
    const queuedTasks = this.queue.filter(t => t.status === "queued");
    if (queuedTasks.length === 0) return;

    for (const task of queuedTasks) {
      // Find eligible idle worker
      const worker = Array.from(this.workers.values()).find(
        w => w.status === "idle" && w.capabilities.includes(task.type)
      );

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

  private executeTask(task: Task, worker: Worker) {
    task.status = "running";
    console.log(`[orchestratord] Swarm worker ${worker.name} executing task: "${task.brief}"`);

    setTimeout(() => {
      task.status = "completed";
      worker.status = "idle";
      console.log(`[orchestratord] Swarm worker ${worker.name} COMPLETED task ${task.id} successfully.`);
      this.matchTasks(); // Trigger next match in queue
    }, 3000);
  }

  public getQueueStatus() {
    return {
      totalQueued: this.queue.length,
      activeWorkers: this.workers.size,
      tasks: this.queue,
    };
  }
}

// Instantiate dispatcher singleton
const dispatcher = new SwarmDispatcher();

// Mock worker auto-registrations for V7 UNIX-style testing
dispatcher.registerWorker("devd", ["code", "refactor", "build"]);
dispatcher.registerWorker("scribed", ["copywrite", "script", "document"]);
dispatcher.registerWorker("foleyd", ["audio", "sound_synthesis"]);
dispatcher.registerWorker("physicaltwind", ["compare_twin", "ingest_scan"]);
dispatcher.registerWorker("authmdhubd", ["register_agent", "verify_token", "discover_oauth"]);
dispatcher.registerWorker("sentineld", ["scan_input", "verify_sandbox"]);
dispatcher.registerWorker("hardeningd", ["audit_hardening", "validate_controls"]);
dispatcher.registerWorker("autonomyd", ["triage_inbox", "watch_email"]);

// Enqueue basic creative bootstrap tasks
dispatcher.enqueueTask("copywrite", "Drafting core V7 sovereign user documentation");
dispatcher.enqueueTask("code", "Bootstrapping Aegis-Sense local Rust system prober bindings");
dispatcher.enqueueTask("compare_twin", "Ingesting drone-scan and checking drywall linear progress");
dispatcher.enqueueTask("register_agent", "Exposing sovereign OAuth discover.md endpoint");
dispatcher.enqueueTask("scan_input", "Adversarial threat analysis on model prompts");
dispatcher.enqueueTask("audit_hardening", "Verifying all 30 controls across 6 hardening helices");
dispatcher.enqueueTask("watch_email", "Polling Cloudflare D1 and triage incoming advisor emails", "high");
