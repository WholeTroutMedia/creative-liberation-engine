# Creative Liberation Engine Agent Constitution (V6)

This document stands as the supreme governance framework for the Creative Liberation Engine. It carries forward the founding story and core DNA from versions V1 through V5, binding them to V6 runtime validation. All agents, services, and tooling operating in this workspace must comply with the Articles detailed below.

---

## Preamble: The Sovereignty Mandate

The mission of the Creative Liberation Engine is **artist liberation through sovereign AI infrastructure**. 

Every design decision, routing contract, memory write, and agent action must answer one foundational question:
> **"Does this make artists more free or less free?"**

---

## Core Articles

### Article I: Sovereignty & Infrastructure Self-Hosting
Self-hosted infrastructure is the default. External cloud dependencies are the exception. 
*   **Default Target:** All services, storage nodes, databases, and CI/CD pipelines must run on owned physical hardware (e.g., the Synology NAS environment, local Docker containers, and self-hosted Forgejo repositories).
*   **Cloud Exemption:** A cloud dependency (e.g., Cloud Run, Firebase) is permitted ONLY when public ingress is strictly required and cannot be served locally, or when the user provides explicit, documented approval.
*   **Enforcement:** Verified via `docs/SYSTEM_CONTRACT.md` and automated network/port configurations.

### Article IV: TypeScript Quality & Strict Type Safety
All TypeScript code in the ecosystem must be strict-mode, production-grade, and completely type-safe.
*   **Compiler Directives:** `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`, and `"exactOptionalPropertyTypes": true` are non-negotiable across all project-level tsconfigs.
*   **Typing Integrity:** The use of `any` is strictly prohibited. Use `unknown` and narrow it programmatically if necessary. Avoid broad primitive types in favor of narrow unions and literal types.
*   **Enforcement:** Audited during build and commit phases via `tsconfig` checks and ESLint configurations.

### Article IX: No MVPs (Minimum Viable Products)
We ship complete features, or we do not ship at all. 
*   **Completeness Standard:** Code must not contain stubs, placeholders, unhandled exceptions, or `// TODO` comments in production code paths.
*   **Testing Requirement:** If no tests exist for new code, they must be written before merging. All new features must include a structural manual and automated validation checklist.
*   **Enforcement:** Hard-blocked by git pre-commit hooks and Forgejo CI validation runners.

### Article XVIII: Generative Agency & Documentation Authority
Agents must not create opaque, locked structures. Every action, pattern, and memory record must be transparently documented and human-readable.
*   **Independence:** Agent-written code, memory states, and workflows must be fully understandable and manageable by humans without the agent present. 
*   **Memory Spine:** All persistent context must be written to open formats (JSON, markdown, SQLite) and registered to the memory spine.
*   **Enforcement:** Maintained by the SCRIBE memory service and validated against the memory contract schema.

### Article XX: Zero-Day Automation & Adaptive Balance
The Creative Liberation Engine must automate execution pipelines to eliminate human wait time while maintaining a collaborative design partnership.
*   **Automation (Operational Mode):** Once a plan or workstream is approved, execution must be fully automated. Task dispatching, file updates, and verification loops run continuously without prompting the user for minor approvals.
*   **Adaptive Balance (Conversational Mode):** The agent must dynamically balance execution with user alignment:
    *   *If the user asks questions, seeks analysis, or requests a discussion:* Engage in active, intelligent, and strategic conversation.
    *   *If the intent is clear execution (e.g., "build", "ship", "fix"):* Skip unnecessary permission checks, run commands immediately, and apply edits directly.
*   **Enforcement:** Governed by `AGENTS.md` boot parameters and runtime intent-routing contracts.

### Article XXIII: LLMs Are Components, Not Architecture
The Creative Liberation Engine operates *with* models, not *as* models.
*   **Interchangeability:** Large Language Models are interchangeable intelligence components. The core system architecture—including the dispatch loop, memory spine, routing engine, and governance gates—must remain operational and secure regardless of individual model failures or upgrades.
*   **Enforcement:** Governed by `runtime/registry/models.canonical.json` and API-independent middleware layers.

### Article XXIV: Biometric Data Sovereignty
Physiological or biometric data (e.g., heartbeats, facial recognition, telemetry markers) is strictly private.
*   **Local Processing:** Biometric data must be processed entirely on local, owned infrastructure. Zero cloud export is allowed.
*   **Automatic TTL:** Any transient physiological signals must be automatically deleted immediately after their operational TTL expires.
*   **Enforcement:** Enforced at the gateway layer and audited via `runtime/hardening/security.hardening.json`.

### Article XXV: Integration Over Re-Implementation
We build integrations, not redundant clones.
*   **Wrapper Policy:** When advanced external technologies, libraries, or pre-trained models already exist, we do not write custom code to reverse-engineer or re-implement their internal math. Instead, we write robust integration layers, API adapters, and orchestration wrappers to leverage them directly.
*   **Enforcement:** Checked during design-ingest and plan reviews.

---

## Heritage Appendix: Mapped V1–V5 Principles

The following historical principles from earlier versions are mapped to their corresponding governing Articles in V6:

### Managed Under Article I (Sovereignty)
*   **Gitea-Only Remote Policy** (`p-description-sovereign-infrastructure-policy-gitea-only-remote-policy`): Binds all git push/pull operations to local NAS remote endpoints.
*   **Constitutional Drift Monitor** (`p-name-constitutional-drift-monitor`): Uses self-hosted checking routines to ensure settings files don't leak paths or dependencies.

### Managed Under Article IV (Type Safety)
*   **TDD-ENFORCERS Integration** (`p-tdd-enforcers-constitutional-integration`): Mandates test double configurations, type checks, and strict type constraints on codebases.

### Managed Under Article IX (No MVPs)
*   **Complete Constitutional Validator** (`p-complete-constitutional-validator`): Runs static validation scans checking that files match core schemas before deployment.

### Managed Under Article XVIII (Documentation & Agency)
*   **SCRIBE Integration** (`p-scribe-constitutional-integration`): Restricts proprietary formatting; all project logs and states must be exportable to standard Markdown and JSON.
*   **SAGE Wellness & Training** (`p-sage-constitutional-integration`): Restores educational transparency by providing human-readable guidelines for debugging and setup.

### Managed Under Article XX (Zero-Day Automation & Adaptive Balance)
*   **Session Auto-Logger** (`p-name-u0001f4dd-session-auto-logger`): Auto-commits state updates at session end without manual user initiation.
*   **DNA Propagation Sync** (`p-name-dna-propagation`): Automates multi-repo synchronization workflows without requiring human confirmation steps.
