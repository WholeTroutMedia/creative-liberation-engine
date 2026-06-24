# IPSV SPINE — Universal Workflow Architecture

> **IDEATE → PLAN → SHIP → VALIDATE**
> The invariant backbone for every workflow in Creative Liberation Engine.
> Strong enough to feel like an enterprise. Light enough to not suffocate creativity.

---

## 0. INTAKE / QUALIFY (Pre-IDEATE Stop Measure)

Before ANY helix activates, every inbound task passes through this gate.
This prevents agents from sprinting in the wrong direction.

### Qualifying Questions (ask 3–7 depending on complexity)

1. **What artifact are we producing?** (not the activity — the deliverable)
2. **Who experiences it and how?** (audience + channel/surface)
3. **What constraints are fixed?** (brand, tech stack, deadlines, approvals)
4. **Does this match an existing helix?** (content, marketing, stitch/UI, photo, engineering, etc.)
5. **What does success look like?** (measurable outcome or quality bar)
6. **Who needs to approve before ship?** (user, stakeholder, automated gate)
7. **What's the urgency class?** (now / today / this week / backlog)

### Routing Logic

- If task matches a known helix → route to that helix
- If task spans multiple helices → spawn parallel tracks, designate a lead helix
- If task matches NO helix → create an **ad-hoc helix** (see §5 below)
- If task is ambiguous → ask clarifying questions before proceeding

---

## 1. IDEATE

**Purpose:** Generate options, references, and constraints. Pick a direction.

### Universal Outputs
- Direction chosen (with rationale)
- References / inspiration / prior art gathered
- Constraints and anti-patterns documented
- Scope boundaries drawn

### Agent Behavior
- Explore broadly before narrowing
- Surface relevant memory (SCRIBE episodes, past patterns)
- Present 2–3 options when direction isn't obvious
- Flag risks or unknowns early

---

## 1.5. TEAM ASSEMBLE

**Purpose:** Initialize and coordinate the virtual swarm (UI/UX Architect, Typographer/Asset Lead, Visual FX Director, Kinetic/Animation Designer) to audit layout widths, typography hierarchies, navigation parameters, and logic before and during implementation.

### Universal Outputs
- Swarm roster and task assignments
- Viewport scaling and text safety validation checklist
- Blank Agnostic Slate verification
- Integrated navigation and state flow map

### Agent Behavior
- UI/UX Architect audits viewport sizes, container bounds, and scaling transforms.
- Typographer/Asset Lead checks text wrapping, clipping, font family scaling, and contrast.
- Visual FX Director ensures color harmony on a clean agnostic base.
- Kinetic Designer tests transitions, interactive states (e.g., node drag-and-drop), and micro-animations.
- Never proceed to PLAN/SHIP without swarm clearance on visual, backend, frontend, and navigational readiness.

---

## 2. PLAN

**Purpose:** Turn the chosen direction into a brief, checklist, and resourcing.

### Universal Outputs
- Brief / spec (scope, audience, success criteria)
- Checklist of deliverables
- Dependencies and blockers identified
- Timeline or sequence established

### Agent Behavior
- Reference DESIGN.md / CONSTITUTION.md where applicable
- Break work into atomic, shippable units
- Identify handoff points between agents or helices
- Never start SHIP without a plan artifact

---

## 3. SHIP

**Purpose:** Execute, review, refine, publish/merge.

### Universal Outputs
- The artifact itself (code, design, content, asset, etc.)
- Review pass completed (self-review or peer)
- Deployed / published / committed

### Agent Behavior
- Work in iterations, not one giant pass
- Check work against the PLAN checklist
- Surface blockers immediately, don't bury them
- Commit/publish with clear messaging

---

## 4. VALIDATE

**Purpose:** Check impact and quality. Feed learnings back into the system.

### Universal Outputs
- Quality check against original brief
- Impact measurement (metrics, user feedback, heuristic review)
- Learning log: "What should change in this helix next time?"
- SCRIBE episode persisted to memory

### Agent Behavior
- Never skip VALIDATE even on small tasks
- Compare output to PLAN success criteria
- Propose helix improvements when patterns emerge
- Archive reusable patterns for future runs

---

## 5. Helix Registry

Each work type is a "helix" — a named workflow frame that defines specific artifacts per IPSV phase.

### Active Helices

| Helix ID | Work Type | Workflow File | Status |
|---|---|---|---|
| `helix-content` | Content Creation | `helix-content.md` | active |
| `helix-marketing` | Marketing & Campaigns | `helix-marketing.md` | active |
| `helix-stitch` | Stitch / UI Design | `helix-stitch.md` | active |
| `helix-photo` | Photography & Visual | `helix-photo.md` | active |
| `helix-engineering` | Engineering & Code | `helix-engineering.md` | active |
| `helix-creative-direction` | Creative Direction | `helix-creative-direction.md` | active |

### Ad-Hoc Helix Creation

When INTAKE can't match an existing helix:

1. Identify the nearest neighbor helix (e.g., podcast → seed from content + photo)
2. Auto-draft a minimal frame: "For this work type, IDEATE produces X, PLAN produces Y, SHIP produces Z, VALIDATE checks W"
3. Ask 2–3 meta-questions: "What MUST this workflow produce? What does failure look like?"
4. Run the task using the temporary frame
5. In VALIDATE: "Did this ad-hoc helix work? If yes, promote to permanent. If not, log deltas."

---

## 6. Cross-Helix Rules

- **Deviations are allowed** but must be explained ("skipping PLAN because...")
- **VALIDATE always runs.** No exceptions. Even if it's one sentence.
- **Learning compounds.** Every VALIDATE feeds back into helix definitions.
- **Parallel helices** designate a lead and sync at SHIP boundaries.
- **Handoffs are explicit.** Never assume another agent knows context — write it down.

---

## 7. Enterprise Feel

To make this feel like an organization backing the user, not a solo agent:

- Every task is greeted with a consistent intake ritual
- Each helix exposes its expectations in a short card the user can see
- VALIDATE loops learnings back so the system visibly improves
- Agents reference the CONSTITUTION and DESIGN.md — institutional knowledge, not ad-hoc guessing
- Handoffs between agents read like professional team transitions

---

## 8. Version

| Field | Value |
|---|---|
| Version | 1.0.0 |
| Created | 2026-03-27 |
| Author | COMET + Artist |
| Governance | CONSTITUTION.md Article VII (Knowledge Compounding) |
| Supersedes | Individual workflow-only patterns |