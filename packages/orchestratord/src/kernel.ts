import { SovereignStateEngine } from "../../stated/src/engine.js";
import { AgenticMoERouter } from "./moe_router.js";
import { ConstitutionalGuardrail } from "./guardrail.js";

export class EventEmitter {
  private listeners: Record<string, Function[]> = {};

  public on(event: string, listener: Function): this {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
    return this;
  }

  public emit(event: string, ...args: any[]): boolean {
    const list = this.listeners[event];
    if (!list) return false;
    for (const listener of list) {
      listener(...args);
    }
    return true;
  }
}

export interface SovereignEnvelope {
  taskId: string;
  workflowId: string;
  stepId: string;
  payload: Record<string, any>;
  meta: {
    runtimeIdentity: string;
    systemOverride: string;
    governanceEnforcement: "strict" | "permissive";
    securityProfile: { allowNetworkAccess: boolean; maxCpuThreads?: number };
    routedAgents: string[];
    routedLoras: string[];
    vramAllocatedGb: number;
  };
}

export class SovereignOSKernel extends EventEmitter {
  private stateEngine: SovereignStateEngine;
  private moeRouter: AgenticMoERouter;
  private guardrail: ConstitutionalGuardrail;

  constructor(stateEngine: SovereignStateEngine) {
    super();
    this.stateEngine = stateEngine;
    this.moeRouter = new AgenticMoERouter();
    this.guardrail = new ConstitutionalGuardrail();
    this.initListeners();
  }

  private initListeners(): void {
    // Catch deterministic dispatch requests from the state layer
    this.stateEngine.on("workflow:dispatch", async (event: any) => {
      await this.processLifecycle(event.workflowId, event.stepId, event.target, event.payload);
    });

    this.stateEngine.on("workflow:breakpoint", (event: any) => {
      this.emit("kernel:log", `[BREAKPOINT TRIPPED] Workflow ${event.workflowId} halted at Step ${event.stepId}. Awaiting sovereign verification.`);
    });
  }

  /**
   * The absolute end-to-end reactive pipeline execution
   */
  public async processLifecycle(
    workflowId: string,
    stepId: string,
    targetWorker: string,
    rawPayload: Record<string, any>
  ): Promise<void> {
    // Pure JS UUID generator to avoid node:crypto dependency
    const taskId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    
    this.emit("kernel:log", `[INIT] Core Lifecycle initiated for Task [${taskId}] inside Workflow [${workflowId}]`);

    try {
      // 1. Sentineld Pre-Flight Input Threat Guard & Constitutional Pre-Flight Check (Article 0 Verification)
      const verification = await this.guardrail.verifyAction(rawPayload);
      if (!verification.compliant) {
        throw new Error(`[GOVERNANCE REJECTION] Pre-flight security/constitutional check failed: ${verification.violations.join(', ')}`);
      }

      // 2. Context-Aware MoE Routing for 40+ Agents & LoRAs
      const prompt = rawPayload.prompt || rawPayload.systemPrompt || "";
      const routingResult = this.moeRouter.route(prompt);
      this.emit("kernel:log", `[MOE ROUTE] Prompt routed to Agents: [${routingResult.agents.join(', ')}] and LoRAs: [${routingResult.loras.join(', ')}]`);

      // 3. Dynamic LoRA Swapping (S-LoRA/Punica VRAM management)
      const swapResult = await this.moeRouter.swapAdapters(routingResult.loras);
      this.emit("kernel:log", `[VRAM SHIFT] Active LoRAs in GPU: [${swapResult.activeLoras.join(', ')}]. Offloaded to CPU: [${swapResult.offloadedToCpu.join(', ')}]. Current VRAM: ${swapResult.currentUsageGb} GB`);

      // 4. Construct the Immutable Processing Envelope
      const envelope: SovereignEnvelope = {
        taskId,
        workflowId,
        stepId,
        payload: rawPayload,
        meta: {
          runtimeIdentity: `ephemeral_${targetWorker}_${taskId.slice(0, 8)}`,
          systemOverride: rawPayload.systemPrompt || "Execute within strict sovereign parameters.",
          governanceEnforcement: "strict",
          securityProfile: { allowNetworkAccess: false, maxCpuThreads: 4 },
          routedAgents: routingResult.agents,
          routedLoras: routingResult.loras,
          vramAllocatedGb: swapResult.currentUsageGb
        }
      };

      // 5. Dispatch directly to the Isolated Execution Sandbox Factory
      this.emit("kernel:dispatch", envelope);

    } catch (error: any) {
      this.emit("kernel:fault", { taskId, workflowId, stepId, error: error.message });
    }
  }

  public async postFlightVerification(output: any): Promise<boolean> {
    const verification = await this.guardrail.verifyOutput(output);
    if (!verification.compliant) {
      this.emit("kernel:log", `[POST-FLIGHT FAULT] Verification failed: ${verification.violations.join(', ')}`);
      return false;
    }
    return true;
  }
}

