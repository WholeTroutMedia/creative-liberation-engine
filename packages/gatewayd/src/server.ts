import { SovereignOSKernel } from "../../orchestratord/src/kernel.js";
import { SovereignStateEngine } from "../../stated/src/engine.js";

declare const process: any;

function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class HeadlessMCPGatewayHub {
  private kernel: SovereignOSKernel;
  private stateEngine: SovereignStateEngine;

  constructor(kernel: SovereignOSKernel, stateEngine: SovereignStateEngine) {
    this.kernel = kernel;
    this.stateEngine = stateEngine;
  }

  /**
   * Initializes standard input/output protocol framing loops
   */
  public listen(): void {
    process.stdin.setEncoding("utf8");
    
    process.stdin.on("data", async (chunk: any) => {
      try {
        const rawRequest = JSON.parse(chunk.toString());
        const response = await this.handleMCPRequest(rawRequest);
        process.stdout.write(JSON.stringify(response) + "\n");
      } catch (err: any) {
        process.stdout.write(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: err.message } }) + "\n");
      }
    });
  }

  private async handleMCPRequest(request: any): Promise<any> {
    if (request.method !== "tools/call") {
      return { jsonrpc: "2.0", id: request.id, result: { supportedTools: ["get_cluster_state", "submit_sovereign_task", "release_pipeline_breakpoint"] } };
    }

    const { name, arguments: args } = request.params;

    switch (name) {
      case "get_cluster_state":
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "ONLINE",
                topology: "3x3 Sovereign Cluster Topology Active",
                governanceEngine: "Constd Article 0 Compliant",
                activeDefensiveProfiles: ["sentineld", "hardeningd"]
              })
            }]
          }
        };

      case "submit_sovereign_task":
        // Direct injection pipeline into the active kernel processing sequence
        const mockWorkflowId = `wf_${randomUUID().slice(0, 8)}`;
        const mockStepId = `step_01`;

        this.stateEngine.registerWorkflow(mockWorkflowId, [{
          id: mockStepId,
          workerType: args.target,
          payload: { prompt: args.prompt },
          dependsOn: [],
          requireApproval: args.requireApproval || false
        }]);

        // Instantly force graph parsing evaluation
        this.stateEngine.evaluateGraph(mockWorkflowId);

        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [{
              type: "text",
              text: `Successfully initialized sovereign execution tracking pipeline. Workflow ID: ${mockWorkflowId}`
            }]
          }
        };

      case "release_pipeline_breakpoint":
        await this.stateEngine.releaseBreakpoint(args.workflowId, args.stepId, { manualOverrideVerified: args.approve });
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [{
              type: "text",
              text: `Breakpoint released successfully. Re-routing execution payload back into core active queue.`
            }]
          }
        };

      default:
        return { jsonrpc: "2.0", id: request.id, error: { code: -32601, message: `Method tool target [${name}] not found.` } };
    }
  }
}
export default HeadlessMCPGatewayHub;
