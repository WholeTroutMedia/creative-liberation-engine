# Creative Liberation Engine V6 — Capability Ideation Open Items

This ledger tracks the eight core capability ideations and their blocking architectural/design questions required to transition them fully into **PLAN** or **DESIGN** mode execution.

---

## 🟢 INFRASTRUCTURE (Routed to PLAN)

### 01 — Procedural Media Synthesis (Render Daemon)
* **RESOLVED:** The daemon is implemented in `services/render-daemon`. It monitors NAS watch folders (`/app/genesis-deploy/runtime/render/input`).
* **Execution Target:** Designed to run directly on the NAS utilizing Wine/Docker or delegating via network protocol to a Windows node with AE installed.
* **Storage Topology:** Input: `runtime/render/input`, Output: `runtime/render/output`.
* **Template Sourcing:** Templates are sourced dynamically from the MDX GitOps repository and placed in the NAS volume.

### 05 — Runtime Logic Compilation & Injection (HMR Mesh)
* **RESOLVED:** Implemented via Node.js HTTP server and ESM dynamic imports inside `services/hmr-mesh`.
* **State Persistence:** Ephemeral NAS memory (`runtime/injections/`); logic clears and rebuilds fresh for immediate iteration.
* **Rollback Tolerance:** The watcher catches compilation/evaluation errors and marks the module with `error` status immediately, safely isolating the failure.

### 06 — Sovereign Declarative Infrastructure (MDX GitOps)
* **RESOLVED:** MDX GitOps daemon created in `services/mdx-gitops` to sync `.mdx` declarative files into runtime states.
* **Webhook vs. Polling:** Polling mechanism via `chokidar` is utilized directly on the NAS directory mapped for the MDX repo output.
* **Docker API vs. Compose:** Emits physical `docker-compose.generated.yml` files which are invoked via the CLI for high observability.
* **Shadow Networking:** Ephemeral playgrounds map to the 4000+ port range to avoid collision with core services.

### 07 — Automated Media Ingestion Mesh (Inotify)
* **RESOLVED:** Ingestion mesh implemented in `services/ingestion-mesh` with chokidar and proxy generation capabilities.
* **Filesystem Constraints:** Features a `usePolling` fallback mode precisely to handle SMB/NFS mounted NAS environments.
* **Memory Spine Integration:** The ingest daemon acts purely as a ledger scribe (SQLite output), while the core Engine pushes to the Obsidian Wiki.
* **Proxy Specs:** Standardized on lightweight 1080p H.264 `.mp4` optimized for rapid browser review via `ffmpeg` fast presets.

---

## 🟣 PRODUCT / EXPERIENCE (Routed to DESIGN)

### 02 — Hardware-Accelerated Telemetry Canvas
* **RESOLVED:** Implemented in `nexus/src/canvas/CanvasLayer.jsx`.
* **Aesthetic Enforcement:** Strictly adhering to Pitch Black Brutalist (`#000000`, `#FF3366`, `#00FFCC`).
* **Node Manipulation:** The layout remains entirely procedural/automatic based on live data streams to minimize operator friction and maximize sovereign automation.

### 03 — Generative Layout Matrix
* **RESOLVED:** Implemented in `nexus/src/panels/MatrixPanel.jsx`.
* **AST Persistence:** Saved physically as `.ast.json` intermediate files in `runtime/layouts/` that the engine dynamically mounts and renders at runtime.
* **Brutalist Constraints:** Utilitarian grid snapping with stark contrast borders, utilizing explicit JSON overrides.

### 04 — Agent Swarm Observability Mesh
* **RESOLVED:** Implemented via `AgentPanel.jsx` inside NEXUS.
* **Intervention Mechanics:** The primary goal of the "Override" button is to pause the swarm immediately, inject a prompt correction, and let it continue generating.
* **Data Retention:** Interface is strictly for live-tailing active tasks and direct operator intervention.

### 08 — Cinematic Presentation Layer
* **RESOLVED:** Output mechanism standardized.
* **Delivery Mechanism:** Hosted behind the sovereign NAS gateway to ensure single source of truth and data sovereignty.
* **Viewport Targeting:** Locked to desktop/16:9 ratios for optimal cinematic fidelity and complex UI overlays.
