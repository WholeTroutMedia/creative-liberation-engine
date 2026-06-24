import { SovereignStateEngine } from "../../stated/src/engine.js";
import { SovereignOSKernel } from "./kernel.js";
import { EphemeralSandboxFactory } from "./sandbox.js";
import { HeadlessMCPGatewayHub } from "../../gatewayd/src/server.js";

// 1. Instantiating the underlying state layers
const stateEngine = new SovereignStateEngine();
const osKernel = new SovereignOSKernel(stateEngine);
const sandboxFactory = new EphemeralSandboxFactory();

// 2. Wire the kernel dispatch event layer into the sandboxed hardware runtime
osKernel.on("kernel:dispatch", (envelope: any) => {
  sandboxFactory.spawnSandboxWorker(
    envelope,
    (successData) => {
      console.error(`[KERNEL SUCCESS] Task [${envelope.taskId}] completed flawlessly. Relaying outputs to memd memory spine.`);
      // Update state tracking parameters to clear dependency targets
      stateEngine.releaseBreakpoint(envelope.workflowId, envelope.stepId, { output: successData })
        .catch(err => console.error(`[KERNEL FAULT] Failed to release breakpoint:`, err));
    },
    (runtimeError) => {
      console.error(`[KERNEL CRITICAL FAULT] Execution failed for Task [${envelope.taskId}]: ${runtimeError.message}`);
    }
  );
});

osKernel.on("kernel:log", (log: any) => console.error(log));
osKernel.on("kernel:fault", (fault: any) => console.error(`[EXECUTION FAULT]:`, fault));

// 3. Mount the Headless MCP STDIO Hub
const gateway = new HeadlessMCPGatewayHub(osKernel, stateEngine);
gateway.listen();

console.error("◈ Creative Liberation Engine V7 Operating System Kernel Fully Stabilized.");
