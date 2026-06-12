# Active System Constraints (Institutional Memory)

This document contains the canonical list of active system constraints, lessons learned, and failure modes identified during the operation of Creative Liberation Engine.

**Every agent booting into this workspace MUST read this document and adhere strictly to these constraints.**

---

## 1. Network Topology & Routing Constraints

### Failure Mode
Daemons or watchers (e.g., `cortex-omni-watcher`, `capability-watcher`) configured to connect to `DISPATCH_URL` using container name resolution (e.g., `http://dispatch:5160` or `http://dispatch:5050`) fail to connect and time out.

### Constraint
* **Cross-Network Bridge Communication:** The core CLE infrastructure (dispatch, genkit, postgres, redis) runs on the docker network `creative-liberation-engine_genesis-net`. External watchers and UIs run on the external network `inception-mesh`. 
* Container name resolution does **not** cross these networks. 
* All external services, watchers, and UIs must route their dispatch traffic through the host-exposed gateway: **`http://122.0.3.1:5160`**.
* Internal services (within genesis-net) must use the internal port: **`http://dispatch:5150`**.

---

## 2. Decommissioned Legacy Mappings

### Failure Mode
Agents attempt to write files, deploy packages, or read configurations from old V5 paths, resulting in file scatter and logical regressions.

### Constraint
* **NAS Volume Purge:** The `genesis-deploy` (V5 bridge) and `brainchild-v5` folders have been physically purged from the Synology NAS. 
* The CLE NAS root is strictly: **`\\122.0.3.1\docker\creative-liberation-engine`**.
* Do not write or reference `genesis-deploy` or `brainchild-v5` in any active V6 files.

---

## 3. Test-Backed Governance (Zero Trust)

### Failure Mode
Prose guidelines (like this markdown file or the filesystem policy) are ignored by future agents because there is no automated syntax verification.

### Constraint
* **Linter Enforcement:** Every system-critical constraint must be codified as an automated test in **`tests/contract-validation.test.mjs`**. 
* Any commit or execution that violates these rules will immediately fail the validation gate, preventing regressions from entering the repository.

---

## 4. Strategic Architecture Constraint: Integration Over Reverse-Engineering

### Failure Mode
Agents attempt to manually replicate or reverse-engineer the low-level mechanics of advanced models, tools, or libraries (e.g. custom visual patch/waveform processing layers) rather than using official APIs, adapters, or model weights. This introduces huge complexity, bugs, maintenance overhead, and violates the "No MVPs" (Article IX) rule.

### Constraint
* **No Low-Level Reinvention:** When advanced external technologies, libraries, or models (e.g., local LLMs, specialized engines, pre-trained frameworks) already exist, you are strictly forbidden from writing custom re-implementations of their internal mechanics.
* **Standard Runtimes & Wrappers:** You must download and utilize the actual model weights/tools directly via standard local runtimes (such as Ollama, LiteRT-LM, or vLLM).
* **Adaptation & Orchestration:** Direct all engineering effort towards architecting robust integration layers, clean API adapters, and orchestration wrappers around these capabilities to maintain sovereignty without reproducing existing backends.

---

## 5. Autoregressive Output Repetition Mitigation (Self-Loop Prevention)

### Failure Mode
When executing commands with large, highly repetitive output logs (e.g., recursive directory lists, verbose docker build logs, long dependency installs), an agent's text generation (LLM) can get trapped in an autoregressive output loop. Once the model outputs a sequence of highly repetitive tokens, it falls into a local minimum, repeating the exact same lines of log output indefinitely, leading to context truncation, token wastage, and execution freeze.

### Constraint
* **No Raw Repetitive Logs:** Never print long, raw, or highly repetitive output logs directly in your thought process or agent responses.
* **Truncate and Summarize:** If a command returns a long log output, capture it in a file, and print only a brief summary, head/tail, or status of the task. Do not reproduce repetitive patterns (e.g. step-by-step progress lines of identical structure).
* **Silent Execution on Async (No Polling Loops):** When starting a background task, do NOT schedule a polling loop or use the `schedule` tool to wait for it. The system automatically sends updates and notifies you when the task completes. Simply stop calling tools (yield control) to wait; the system will wake you up when the task finishes or yields new stdout. Do not write loop mechanisms that repeatedly query status or schedule follow-up timers.

---

## 6. Pre-Execution Native & Information Capability Audit (Proactive Verification)

### Failure Mode
Agents jump straight into writing custom, hand-coded adapter scripts, local tool definitions, or implementing ad-hoc logic without first checking if an official, native, or pre-configured solution (e.g. official MCP server, official design system tokens, updated model APIs, or official configurations) is available. This leads to redundant code, security weaknesses, outdated information patterns, and technical debt.

### Constraint
* **Proactive Native Audit:** Before writing code, setting up custom integrations, or executing any major implementation task, agents must perform a proactive verification check to determine if a native, official, or standard implementation exists for the target service, model, design system, or protocol.
* **Adopt Over Build:** If an official or native equivalent exists (e.g. official AWS MCP, GitHub MCP, updated Google APIs, official token schemas) and is not yet configured, the agent must prioritize codifying and integrating this official capability immediately, rather than building a custom local adapter.
* **Information & Configuration Check:** Before starting execution, agents must actively search for and ingest the latest documentation, developer references, configurations, and version schemas relevant to the task (e.g., checking developers.google.com for Google Workspace changes or official design specs) to ensure the implementation is fully state-of-the-art and doesn't rely on stale knowledge.

