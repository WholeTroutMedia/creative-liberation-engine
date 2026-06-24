---
name: PLAN Mode
version: 2.0.0
last_modified: 2026-04-07
constitutional_articles: [I, IV, IX, XIV, XX]
lead_agents: [STRATA, NORTHSTAR]
scribe_on_complete: true
agentCallable: true
---

# PLAN Mode — Creative Liberation Engine v5

> Pipeline: **IDEATE → DESIGN → PLAN → SHIP → VALIDATE**
> PLAN converts an approved direction into an atomic, executable task spec that SHIP can implement without ambiguity.

## When to Use This Skill

Activate PLAN when:

- A DESIGN_CONTRACT.md has been signed (for visual/product tasks)
- An IDEATE session routed directly here (infrastructure/OS/architecture tasks)
- User says "plan this", "spec this out", "break this down", "what's the plan"
- A `/pickup` or `/claim` completes and the task needs decomposition before code
- A new agent is being added (`/new-agent`)
- The IPSV-SPINE loop reaches the PLAN phase for a queued task

---

## Operating Principals

**Lead agents:** STRATA (Architect) + NORTHSTAR (Constitutional Reviewer)
**Support agents:** LOGD (Task artifact writer), FORGE (Feasibility), LEX (compliance if Zero-Day features)

---

## Memory Protocol

**VAULT IN (read at start):**

- Prior architectural decisions relevant to this domain (semantic collection)
- Existing patterns for similar features (semantic)
- Prior IDEATE session if this task originated from one (episodic)
- KI summaries — scan for matching topic before generating from scratch

**SCRIBE OUT (write at end):**

- Approved plan summary → semantic collection (architecture decision)
- Full task decomposition → episodic collection (session record)
- Any new conventions or patterns discovered during planning → semantic

---

## Pre-Flight Gate: DESIGN_CONTRACT Check

> **This gate is mandatory for any task with a visual surface.**

Before decomposing any task, check:

```powershell
Test-Path "DESIGN_CONTRACT.md"
```

- **Found** → Read the contract. Extract: surface type, color palette, component anchors, locked decisions. These are non-negotiable constraints in the spec.
- **Not found + visual surface detected** → STOP. Do not proceed. Surface this to the user: *"No DESIGN_CONTRACT.md detected for a visual task. Run DESIGN mode first, or confirm this is an infrastructure-only task."*
- **Not found + infrastructure task** → Proceed. State explicitly: *"Infrastructure task — no DESIGN_CONTRACT required."*

**Visual surface signals:** interface, screen, dashboard, mobile, website, component, page, form, modal, embed
**Infrastructure signals:** daemon, schema, routing, mesh, protocol, migration, indexing, service, dispatch, architecture

---

## Step-by-Step Protocol

### Step -1 — Title Resolution Gate (MANDATORY)

Before any planning: check whether this task already has a plan in progress.

1. Check `.agents/dispatch/task-queue.md` for a matching task title/ID
2. Check `HANDOFF.md` for an active project with this name
3. Check `ecosystem.manifest.json` for this slug
4. Check recent KI summaries for a matching prior plan

If found → surface the existing plan, confirm resume. Do NOT re-plan from scratch.
If not found → proceed to Step 0.

---

### Step 0 — Context Retrieval (BLOCKING)

Execute all retrieval in parallel before generating any spec:

1. **VAULT semantic:** `POST http://localhost:4100/retrieve { "query": "<task topic>", "limit": 5, "collection": "semantic" }`
2. **VAULT episodic:** Same query against `"collection": "episodic"` — find prior sessions on this feature area
3. **Read DESIGN_CONTRACT.md** if it exists (or note its absence)
4. **Read AGENTS.md** — confirm agent roster and constitutional constraints
5. **Check `.agents/dispatch/registry.md`** — confirm no other window owns files in scope

**Retrieval outcome gate:**

- Prior plan found → synthesize it in; do not re-derive established decisions
- Nothing found → state explicitly: *"No prior context. Planning from first principles."*

---

### Step 1 — Define the Scope

STRATA frames the task:

```markdown
## Task Scope

**What we're building:** [1 sentence — the thing, not the why]
**Why it matters:** [1 sentence — the underlying need]
**Who uses it:** [user archetype / system consumer]
**Packages in scope:** [list from the monorepo]
**Hard constraints:** [from DESIGN_CONTRACT, CONSTITUTION, or stack limits]
**Out of scope:** [explicit exclusions to prevent scope creep]
```

---

### Step 2 — Atomic Decomposition

Break the task into the smallest executable units. Each unit = one file, one function, or one configuration change. Write this as an ordered checklist:

```markdown
## Implementation Checklist

1. [ ] [File/unit] — [What it does, what it exports]
2. [ ] [File/unit] — [What it does]
   - Depends on: #1
3. [ ] [File/unit] — [What it does]
   - Depends on: #1, #2
...
N. [ ] Tests — [Coverage target + key edge cases]
N+1. [ ] VALIDATE — Run full VALIDATE pipeline
N+2. [ ] DEPLOY — If service-level change, run DEPLOY skill
```

**Rules:**

- Never group more than one file into a single checklist item
- Explicitly mark dependencies between items
- Always include a test step and a VALIDATE step at the end
- If the task involves a new Genkit flow, add a schema registration step explicitly

---

### Step 3 — Constitutional Pre-Review

NORTHSTAR runs a silent check before the plan is finalized:

| Article | Check |
| --------- | ------- |
| **Article I** (Sovereignty) | Does any item introduce external cloud dependencies that could be self-hosted? |
| **Article IV** (Quality) | Are all TypeScript types explicit in the spec? No `any` permitted. |
| **Article IX** (No MVP) | Is every item a complete, shippable unit? No stubs or feature flags hiding incomplete work. |
| **Article XX** (Automation) | Is there any step that requires a human to manually trigger what could be automated? |
| **Article XIV** (Memory) | Is a SCRIBE write included at the end? |

If any article fails → revise the decomposition before presenting.

---

### Step 4 — Risk & Horizon Register

For each non-trivial item, STRATA notes:

```markdown
## Risk Register

| Item | Risk | Mitigation |
|------|------|------------|
| #N | [What could go wrong] | [Preventive action] |
```

Also note **horizon items** — adjacent improvements not in scope but worth tracking for the next PLAN cycle.

---

### Step 5 — Write the Task Artifact

LOGD writes the approved plan to:

1. **Task artifact:** `task.md` in the conversation brain dir (`<appDataDir>/brain/<conversation-id>/task.md`)
2. **Dispatch task:** `POST http://127.0.0.1:5050/api/tasks` to create a tracked task in the queue
3. **SCRIBE:** Write the plan summary to semantic memory

Task artifact format:

```markdown
# Task: [Title]

**Created:** [ISO timestamp]
**Phase:** PLAN → SHIP
**Packages:** [list]
**Design Contract:** [linked or N/A]

## Checklist
- [ ] item 1
- [ ] item 2
...

## Risk Register
[from Step 4]

## Horizon Items
[from Step 4]
```

---

### Step 6 — Route to SHIP

After the plan artifact is written and the task is in dispatch:

> **Article XX Mandate:** Do not ask the user if they're ready to ship. If the plan is approved, immediately invoke the SHIP skill.

State: *"Plan locked. Routing to SHIP."* Then activate the SHIP skill.

Exception: If the plan involved significant architectural decisions that need user sign-off (e.g., changing a database schema, deprecating a public API), pause with one explicit question before routing.

---

## Failure Recovery

If PLAN gets blocked during any step, apply the UPE Failure Reflection Structure before any retry:

```text
FAILURE REFLECTION:
1. WHAT_FAILED: [exact step/lookup that failed]
2. EXPECTED_STATE: [what you assumed before the failure]
3. ACTUAL_STATE: [what the error reveals]
4. ROOT_CAUSE: [the specific mismatch]
5. RECOVERY_ACTION: [minimal intervention — not a retry of the same action]
6. BLAST_RADIUS: [tasks/files affected by the recovery]
```

Never retry the same lookup or decomposition approach more than once without a reflection step.

---

## Output Format

Always use rich markdown. Lead with the Task Scope. Follow with the checklist. Risk register last. End with explicit routing confirmation: *"Routing to SHIP"* or the precise blocker that halted routing.

---

## Constitutional Constraints

- **Article IX:** Every checklist item must be a complete, shippable unit
- **Article XX:** Plan → Ship routing is automatic after approval; no human wait time
- **Article XIV:** Memory write is not optional — SCRIBE step is always last
- **DESIGN_CONTRACT gate is absolute** — visual tasks cannot reach SHIP without it
