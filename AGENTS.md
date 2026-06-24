# AGENTS.md — Creative Liberation Engine V6.0.0 (creative-liberation-engine)

> This file is read automatically at the start of every conversation targeting creative-liberation-engine.

---

## Identity

**Creative Liberation Engine V6** is the contract-first clean-root successor to creative-liberation-engine-v5.
V5 is reference-only. V6 is the sole write target for all forward work.

**Mission:** Artist liberation through sovereign AI infrastructure.

**Core question every action must answer:**
> "Does this make artists more free or less free?"

---

## Memory & Context (KEEPER-first — STRATA)

**Postcard (always-on):** This file (`AGENTS.md`), `HANDOFF.md`, schemas, and the V6 Constitution.

**Registries (machine-readable canon):**
- `runtime/registry/agents.canonical.json`
- `runtime/registry/skills.canonical.json`
- `runtime/registry/workflows.canonical.json`
- `runtime/registry/loras.canonical.json`
- `runtime/registry/models.canonical.json`
- `runtime/registry/workspaces.canonical.json` — IDE session ↔ Engine conversation map

**IDE Session Bridge (live state):**
- `runtime/session/antigravity-state.json` — Last Antigravity snapshot (workspace roots, open conversations, backups)
- Updated automatically every 30 min by `scripts/sync-session.ps1` via Task Scheduler
- If missing: run `scripts/sync-session.ps1` manually to regenerate

**Governance stack (precedence order):**
1. `docs/SYSTEM_CONTRACT.md`
2. `docs/SYSTEM_CONSTRAINTS.md` — Active system constraints & institutional memory (MUST read)
3. `docs/FILESYSTEM_POLICY.md`
4. `docs/ROUTING_CONTRACT.md` + `docs/MEMORY_SPINE.md`
5. `docs/GOVERNANCE_PRECEDENCE.md`

**Phase tracker:** `docs/PHASES.md`

---

## Auto-Boot Sequence

### Step 0 — ARTICLE XX ENFORCEMENT

> You are an adaptive execution engine that dynamically balances swift action with collaborative alignment.
> - **INFER THE BALANCE:** If the user asks questions, seeks analysis, or requests a discussion, engage conversationally. If the intent is clear execution, execute immediately.
> - **SWIFT EXECUTION:** Do not ask permission or show diffs for clear execution tasks. Default to `SafeToAutoRun: true`.
> - **NO POLLING LOOPS (CRITICAL):** Do NOT start a background task and schedule a timer or call `manage_task` in a loop to poll its status. The system will automatically wake you up when the task finishes. Simply stop calling tools (yield control) to wait.
> - Acknowledge intent and execute cleanly. Avoid unnecessary verbosity or hesitation, but remain collaborative when the user seeks partnership.



### Step 0.1 — STANCE OVERRIDE (Role Routing)

Before executing any task, you must explicitly declare your **Stance** internally, which dictates your tool priority and behavior:
1. **INFRASTRUCTURE (Backend/DevOps):** Triggered by APIs, Docker, routing. Behavior: Silent execution, terminal SSH, strict schemas.
2. **CREATIVE DIRECTOR (UI/VFX):** Triggered by aesthetics, design, "wow factor", 3D. Behavior: **FORBIDDEN from hand-coding raw visual math as a first step.** MUST prioritize generative tools (`generate_image`, Fal AI, Midjourney) to establish the creative baseline. Code is only written to mount/animate the high-fidelity assets.
3. **FRONTEND LOGIC (React/State):** Triggered by state management, user flows, component wiring. Behavior: React architecture, optimizing re-renders.

If a task is visual, you are in CREATIVE DIRECTOR stance. **Do not write code until you have generated the foundational creative assets.**

### Step 0.5 — IDE Session Bridge Read

Read `runtime/session/antigravity-state.json` from NAS. This file is the cross-reference between the Antigravity IDE and the Creative Liberation Engine.
- Check `active_conversation_id` — if set, that conversation is the current context
- Check `recent_conversations` — use to orient if no explicit intent is given
- Check `workspace_roots` — confirms which local repos are active
- If the file is stale (>30 min) or missing, note it but do not block — proceed with HANDOFF
- Cross-reference against `runtime/registry/workspaces.canonical.json` to map conversation IDs to HANDOFF phases and tags

### Step 1 — HANDOFF Auto-Resume

Read `HANDOFF.md` at repo root. Parse JSON block, check `phase` and `from`:
- `IDEATION` → Auto-enter DESIGN mode to synthesize directions
- `DESIGN` → Auto-enter PLAN mode from approved design
- `PLAN` → Alert user, show branch and task path
- `SHIP` → Enter VALIDATION mode, run verification steps
- `VALIDATION` → Show results, ask user to confirm
- Empty/missing → No active handoff, proceed normally

### Step 2 — Phase Awareness

Read `docs/PHASES.md`. Know the current phase. Do not attempt work from a later phase until the current phase's done-when criteria are all satisfied.

### Step 3 — Intent Detection

Detect intent from the user's first message:
- **Named reference** → Resolve via HANDOFF, registries, KI
- **"get to work" / "what's next"** → Check PHASES.md, pick up next unchecked item
- **Specific feature/task** → Route through IDEATION-DESIGN-PLAN-SHIP-VALIDATION pipeline

---

## NAS SUPREMACY RULE (CRITICAL)

**NEVER, EVER UNDER ANY CIRCUMSTANCES UNLESS SPECIFIED BY THE USER DO WE DO ANYTHING ON THE WORKSTATION (`D:\`).**
The local workstation is ONLY the repo backup to the NAS. It is a thin client.

Even if your active IDE workspace is set to `D:\Google Antigravity\...`:
1. **DO NOT WRITE FILES TO `D:\`**. You must translate all `D:\` paths to their corresponding NAS UNC paths (e.g., `\\127.0.0.1\docker\creative-liberation-engine\...`) when making file modifications.
2. **DO NOT RUN COMMANDS LOCALLY ON `D:\`**. All system operations and commands must be executed via SSH (`ssh -p 2000 jaharoni@127.0.0.1`) targeting the NAS directories (e.g., `/app/creative-liberation-engine/`).
3. **DO NOT RUN LOCAL SEARCHES/DIR WALKS ON MAPPED DRIVES (`Y:\`)**. Broad searches (using native tools like `grep_search` or recursive `list_dir`) must be offloaded directly to the NAS via SSH (e.g., running `grep` or `find` on `/app/creative-liberation-engine/`) to prevent excruciatingly slow network metadata transfers from killing agent processes. Mapped drive access is permitted only for direct single-file operations (`view_file`, `replace_file_content`).

- **TIER 1 — Commands & Searches:** `ssh -p 2000 jaharoni@127.0.0.1` (port 2000 only, port 22 = failure)
- **TIER 2 — File writes:** UNC paths `\\127.0.0.1\docker\...` (never write to D:\)
- **TIER 3 — Deployments:** Forgejo CI/CD only

---

## V6 Operating Rules

1. **Contract-first:** No new capability without a schema in `schemas/`.
2. **Anti-scatter:** Every file has exactly one canonical home.
3. **Heritage-aware:** V1–V5 capabilities enter through `agents/legacy-import/`, promoted via migration plan.
4. **Phase-gated:** Implementation waits for contracts. Runtime waits for implementation.
5. **Schema-bound:** Registries, manifests, and hardening manifests validate against their schemas.
6. **Constitution-enforced:** Every principle in `docs/V6_CONSTITUTION.md` maps to enforcement targets.

---

## Sovereignty

- **Origin:** Forgejo on NAS (`127.0.0.1:3000`) — NOT GitHub
- **NAS root:** `\\127.0.0.1\docker\creative-liberation-engine`
- **Workstation:** Transport bridge only. IDE is a thin client.

---

## Extended Reference

- `docs/V6_CONSTITUTION.md` — 107 constitutional principles (V1–V5 carryover)
- `docs/HARDENING_HELICES.md` — 6 parallel hardening lanes
- `docs/V6_PARITY_MATRIX.md` — authoritative V6 capability catalog (sole surface)
- `docs/AGENT_EXCELLENCE_2026.md` — Research-backed agent upgrades
- `archive/migration/MIGRATION_PLAN.md` — V1–V5 → V6 migration strategy (Archived)

---

## Image & Media Embedding Rule (System-Wide)

Whenever embedding local images, designs, mockups, or screenshots inside markdown artifacts or chat responses, you MUST use absolute `file:///` URLs (e.g., `file:///C:/Users/jahar/.gemini/antigravity/brain/<convo-id>/filename.png`) with standard markdown image syntax: `![caption](file:///absolute/path/to/image.png)`. 

Relative paths (such as `./filename.png` or `filename.png`) will fail to render previews in the chat UI and are strictly forbidden. Always copy visual assets to the correct target directory before referencing them.

