---
name: DESIGN Mode
description: Activate DESIGN mode — PRISM + SIGHT translate creative directions into rendered visual choices the user approves before PLAN begins. This is the user's design agency moment. No PLAN starts without a signed DESIGN_CONTRACT.md.
---

# DESIGN Mode — Creative Liberation Engine v5

## When to Use This Skill

Activate DESIGN after IDEATE has produced a Possibility Frame and 5 named directions, or when the user says:

- "show me what it could look like"
- "I want to see designs before we build"
- "can we design this first"
- After `/ideate` auto-proceeds and the user has a top direction in mind

---

## Lead Agents

**PRISM** (Visionary) — drives prompt compilation and generation
**SIGHT** (Perceptual QA) — scores each render, flags drift, gates the contract
**STRATA** (Strategist) — surfaces if clarification is needed before generation
**LOGD** — locks the DESIGN_CONTRACT.md with timestamp

---

## Ease of use & ZERO DAY

- The user describes **look, feel, and intent** — not Stitch vs Framer vs Mobbin. You select tools and retrieval **silently** per `docs/design-system/design-toolchain.md`.
- Present **renders and plain-language summaries**; the reaction loop is about **visuals and product fit**, not “which pipeline.”
- After the contract is good enough, **bias to PLAN/SHIP** — design rounds exist to reach shippable truth, not to prolong process.

---

## The Prompt Compiler

Before any image is generated, each creative direction must be compiled into a structured visual prompt. This is the core discipline of DESIGN mode — no freeform descriptions, no prose directions, only compiled prompts.

**Prompt Compiler Template:**

```
[Surface type] · [Layout schema] · [Color mood: name + 2-3 hex anchors] ·
[Primary typeface + weight] · [Motion character: micro/reduced/heavy] ·
[1 real-world inspiration reference] · [1 constraint or differentiator]
```

**Example:**

```
Enterprise SaaS dashboard · 3-column grid with collapsible sidebar ·
Deep navy #0A0F1E, electric indigo accent #6366F1 · Inter 600 for headers ·
Micro-animations on data load · Visual ref: Linear dark mode ·
No empty states — always skeleton loaders
```

Always compile 2 prompts (the top 2 directions from IDEATE). Generate both in parallel.

---

## Step-by-Step Protocol

### Step 1 — ATELIER Retrieval

Before compiling prompts, query ATELIER for the 3 closest pattern matches to the user's use case:

- Read `docs/design-system/design-toolchain.md` once per session for tool context
- Check `docs/design-system/pattern-index.md` and the relevant `tools/design-library/<source>/README.md` (or `catalog.json`) files
- Surface the top 3 patterns and note their source + platform
- These anchors will be embedded in the DESIGN_CONTRACT under "Component Anchors"

If Genkit is online (`localhost:4100`):

```
POST /retrieve { "query": "<surface type + use case>", "limit": 3 }
```

### Step 2 — Prompt Compilation

Using the compiler template above, compile one prompt per direction. Include the ATELIER pattern anchors as the "constraint or differentiator" where relevant.

### Step 3 — Generate (Parallel)

Generate both renders simultaneously using `generate_image`. Name files clearly:

```
design_[direction-name]_v1.png
```

### Step 4 — SIGHT Evaluation

After generation, SIGHT evaluates each render:

- Score against the compiled prompt (palette, type, layout, motion, anchor)
- Flag any drift or missing elements
- Produce a brief SIGHT REPORT for each render

Present renders to the user with SIGHT's scores embedded — not separately.

### Step 5 — Creative Freedom Gate (MANDATORY)

> **This rule is permanent and operational — not per-session.**

Before presenting renders to the user, you MUST pause with `notify_user` and:

- Set `ShouldAutoProceed: false` **always** — no exceptions for design decisions
- Explicitly list the open visual/UX choices the user could weigh in on
- Make clear they can engage or pass — "wave through" is always valid

**The user decides.** If they say "go for it" or pass without feedback, proceed. If they engage, incorporate before locking.

> [!IMPORTANT]
> **Never auto-proceed through design decisions under Article XX.** Article XX governs infrastructure, not creative choices. Creative freedom is Artist's. The cost of shipping a visual direction he didn't choose is higher than the cost of a pause.

### Step 6 — User Reaction Loop (max 3 rounds)

Present both renders. Let the user react. Respond with refinements using Pencil-style iteration prompts:

```
Look at the selected design. [User's direction]. Create a new design for it.
```

Re-compile the prompt with the user's feedback incorporated. Re-generate. Re-run SIGHT. Repeat up to 3 rounds.

> [!IMPORTANT]
> Never re-generate without re-compiling the prompt first. The compiled prompt is the source of truth.

### Step 6 — Confirmation Questions (3 required)

When the user signals satisfaction, ask exactly 3 confirmation questions before locking:

1. "Does this feel right for your users — the people who will actually open this every day?"
2. "Is there a brand element, color, or texture we haven't captured yet?"
3. "Which screen or state are you most uncertain about — what do you want to make sure we get right?"

Incorporate any final feedback into the contract.

### Step 7 — Lock the DESIGN_CONTRACT

LOGD writes `DESIGN_CONTRACT.md` to the project root. See template at `.agents/skills/design/DESIGN_CONTRACT.md`.

**This is a hard gate. PLAN cannot begin without a locked DESIGN_CONTRACT.md.**
This is the one place in the pipeline where Article XX is intentionally suspended — the cost of building wrong is higher than the cost of waiting.

---

## Output Format

Always use rich markdown. Show renders inline. Lead with SIGHT scores. Be direct — if a render fails SIGHT's threshold, say so and re-generate rather than presenting a substandard option.

---

## Constitutional Constraints

- **Article IX**: All renders presented must pass SIGHT's 30/50 minimum threshold. Below that, re-generate — never present it.
- **Article I**: Artist Sovereignty — the user's approval is the only approval that matters. SIGHT informs but does not override user preference.
- **Article VI (amended)**: The pipeline is now IDEATE → DESIGN → PLAN → SHIP → VALIDATE. DESIGN is a full peer mode.
- **Creative Freedom Gate**: `ShouldAutoProceed: false` is hardcoded for all `notify_user` calls containing visual or UX decisions. Implementation plans that include design choices must split: infrastructure auto-proceeds, design pauses for user input. This is permanent operational doctrine.
