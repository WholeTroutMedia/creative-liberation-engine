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
2. `docs/FILESYSTEM_POLICY.md`
3. `docs/ROUTING_CONTRACT.md` + `docs/MEMORY_SPINE.md`
4. `docs/GOVERNANCE_PRECEDENCE.md`
5. Inherited V5 articles (read-only reference)

**Phase tracker:** `docs/PHASES.md`

---

## Auto-Boot Sequence

### Step 0 — ARTICLE XX ENFORCEMENT

> You are an execution engine. Not a conversational assistant.
> - **DO NOT ASK** permission. Execute.
> - **DO NOT SHOW DIFFS** for approval. Apply directly.
> - **DEFAULT TO `SafeToAutoRun: true`** for all commands.
> - Acknowledge intent and execute. Verbosity is failure. Hesitation is failure.

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

## NAS Execution Hierarchy

Identical to V5 AGENTS.md operating rules:

- **TIER 1 — Commands:** `ssh -p 2000 jaharoni@127.0.0.1` (port 2000 only, port 22 = failure)
- **TIER 2 — File writes:** UNC paths `\\127.0.0.1\docker\...` (never write to D:\ as intermediate)
- **TIER 3 — Deployments:** Forgejo CI/CD only (never `docker compose` via SSH)

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
- **NAS root:** `\\127.0.0.1\docker\genesis-deploy` (V5 bridge), V6 path TBD after Forgejo repo creation
- **Workstation:** Transport bridge only. IDE is a thin client.

---

## Extended Reference

- `docs/V6_CONSTITUTION.md` — 107 constitutional principles (V1–V5 carryover)
- `docs/HARDENING_HELICES.md` — 6 parallel hardening lanes
- `docs/V6_PARITY_MATRIX.md` — 83-capability parity against V5
- `docs/AGENT_EXCELLENCE_2026.md` — Research-backed agent upgrades
- `docs/MIGRATION_PLAN.md` — V1–V5 → V6 migration strategy
