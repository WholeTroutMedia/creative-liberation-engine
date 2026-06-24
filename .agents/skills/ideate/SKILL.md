---
name: IDEATE Mode
description: Activate IDEATE mode — VAULT + STRATA explore a topic, map the possibility space, generate creative directions, and compile visual prompts for DESIGN mode. Use when user asks to explore, brainstorm, ideate, or generate creative directions.
---

# IDEATE Mode — Creative Liberation Engine v5

> Pipeline: **IDEATE → DESIGN → PLAN → SHIP → VALIDATE**
> IDEATE produces named directions + compiled visual prompts. DESIGN renders them.

## When to Use This Skill

Activate IDEATE when the user says:

- "ideate on…", "explore…", "brainstorm…", "what are some directions for…"
- "I want to think about…", "vision for…", "possibilities for…"
- After `/browser-ideate` has run and a creative brief is primed
- When a PLAN task surfaces open design questions

---

## Operating Principals

**Lead agents:** STRATA (Strategist) + PRISM (Visionary)
**Support agents:** VAULT (Memory retrieval), LOGD (Truth-check on proposals)

---

## Ease of use & ZERO DAY (non-negotiable)

- **Tool silence:** The user does **not** need to know or name design tools, ingest pipelines, MCP servers, or library folders. Never ask “which tool should we use?” and never dump a toolchain menu. You choose internally; the user stays at **intent level** (“I want X for Y”).
- **You decompose for them:** From a high-level idea, always produce **workable sections** in plain language — e.g. *What we’re building*, *Who it’s for*, *First shippable slice*, *What we’ll do next*, *Only if blocking:* *one* explicit decision. The burden of breakdown is on the agent, not the human.
- **Design serves ship:** IDEATE/DESIGN exist to **unblock** PLAN and SHIP. Prefer the shortest path to a **real, usable artifact** (Zero Day: works from their phone, public URLs, live data when the product demands it). Extra aesthetic rounds only when the user is reacting to visuals, not as default process.
- **User-facing output:** Summarize outcomes and next steps; keep file paths, vendor names, and internal anchors in the contract or logs unless the user is an operator debugging the repo.

---

## Step-by-Step Protocol

### Step -1 — Title Resolution Gate (MANDATORY — runs before everything else)

> **A named reference is a lookup instruction, not a generation prompt. Never generate new work when existing work may already exist under that name.**

Before any other step: check whether the user's message contains a **named reference** — a session title, a project name, a task description, a slash command with a specific topic, or a phrase like "pick up", "resume", or "continue [name]".

**Signals that a named reference exists:**
- Message contains a capitalized proper title (e.g. `IDEATE — The Creative Liberation Engine as Prosthetic Hippocampus`)
- Message contains `[mode] — [title]` format
- Message contains "pick up", "resume", "continue", "that session about", or "where we left off on"
- Message references a known project slug, dispatch task ID, or HANDOFF project name

**If a named reference is detected — RESOLVE FIRST:**

1. Search all of the following in parallel:
   - `HANDOFF.md` — check `project` field for a name match
   - `ecosystem.manifest.json` — check `brainstorms` and `ecosystem` arrays
   - Dispatch queue: `GET http://127.0.0.1:5050/api/tasks` — search by title keyword
   - KI summaries provided at boot — scan for matching topic
   - Recent conversation artifacts (check `<appDataDir>/brain/<conversation-id>/` for matching brief files)
   - SCRIBE: `POST http://localhost:4100/retrieve` `{ "query": "<title>", "limit": 3 }` (if engine online)
2. **If found:** Surface the existing session to the user — show title, date, current phase, STRATA's pick — and ask to confirm resume. Do NOT generate new directions. Proceed from the found phase.
3. **If not found after all lookups:** Proceed to Step 0 and treat this as a new session. State explicitly: "No existing session found for '[title]' — starting fresh."

> [!IMPORTANT]
> This gate has zero exceptions. Even if the name seems unique or unlikely to exist, run the lookups. The cost of 4 parallel searches is always lower than the cost of generating work that duplicates something that already exists.

---

### Step 0 — Project Intent Gate (MANDATORY — always first)

Before any creative work begins, STRATA asks the user one question:

> **"Is this a permanent project or a brainstorm?"**
>
> - **Permanent** → This becomes a registered app in `ecosystem.manifest.json`. A Gitea repo will be created under `WholeTroutMedia/`. Full IDEATE → DESIGN → PLAN → SHIP pipeline activates.
> - **Brainstorm** → Temporary exploration. Ask: "How long would you like to keep this? **30 days / 60 days / 90 days**?"

**Based on the answer:**

**If Permanent:**
1. Add the project to `ecosystem.manifest.json` under `"type": "permanent"`.
2. Note the app name and intended repo slug for PLAN mode to register later.
3. Proceed to Step 1.

**If Brainstorm:**
1. Add the project to `ecosystem.manifest.json` under `"brainstorms"` with:
   ```json
   { "name": "<slug>", "description": "<intent>", "createdAt": "<ISO date>", "expiresAt": "<ISO date + 30|60|90 days>" }
   ```
2. Inform the user: *"Got it — I'll keep this for {N} days. Running `pnpm ecosystem:sync` will automatically remove it when it expires."*
3. Proceed to Step 1.

> [!NOTE]
> This gate may be skipped if the user's initial request already includes explicit intent (e.g. "build me a new app called X" = permanent, "let's just think out loud about Y" = brainstorm).

---

### Step 0.5 — Discovery Gate (MANDATORY — before any generation)

> **This gate exists because IDEATE's auto-execution protocol will skip collaborative brainstorming if unchecked. The cost of building in the wrong direction is higher than a 5-minute conversation.**

Before generating any directions, check: **Has a collaborative brainstorm already happened in this session?**

**Signals that a brainstorm HAS happened (skip this gate):**
- The user arrived from `/spitball` or explicitly said "we already brainstormed" / "based on what we discussed"
- The conversation history contains ≥3 back-and-forth exchanges exploring the topic
- A `SPITBALL_NOTES.md` or equivalent artifact exists and is referenced

**Signals that NO brainstorm has happened (gate activates):**
- The user's first message goes straight to "ideate on X" / "design a Y" / "brainstorm Z" with no prior dialogue
- The conversation is fewer than 3 turns old
- The request contains a creative/brand topic where voice, audience, and tone are undiscovered

**Signals to SKIP or compress this gate (still no tool interrogation):**
- The user states a **clear product intent** (what + for whom + rough surface: app, site, flow, etc.) — you may proceed to Step 1 and state reasonable assumptions in the Possibility Frame instead of a 4-question interview.
- The user asks to **ship**, **build**, or **implement** — compress discovery to at most **one** clarifying question only if something blocks code (e.g. legal jurisdiction). Never use this gate to ask about design tooling.

**If the gate activates:**

1. Do NOT proceed to Step 1. Do NOT generate directions.
2. Surface **at most 3** discovery questions — pick the three most relevant below — and **never** about which design tool or library to use:
   - **On the audience:** Who is this really for? What's their day-to-day pain?
   - **On voice/tone:** Should this feel like *you* talking, or the *system* broadcasting?
   - **On differentiation:** What's the one thing only this project can say?
   - **On scope/pillars:** Are there distinct content areas or themes to cover? *(optional third slot)*
3. Enter a freeform conversation — let the user's answers shape the direction space.
4. When sufficient context exists (≥3 meaningful exchanges), resume at Step 1 with real shared context.

> [!IMPORTANT]
> Article XX auto-execution is intentionally suspended at this gate. Generating directions before shared context exists produces confident-sounding output built on assumptions — which wastes more time than the discovery conversation saves.

---

### Step 1 — Orient & Retrieve Context (BLOCKING — do not proceed to Step 2 until complete)

> **This step is a gate, not a suggestion. Generation cannot begin until retrieval is complete and explicitly checked. If retrieval returns relevant prior context, that context shapes Step 2 — it does not get overridden by fresh generation.**

Execute all retrieval in parallel. Record what was found and what was not found before continuing.

1. **Browser context:** Check if open browser tabs are listed in the conversation context. If yes, read the 3–5 most relevant ones. Extract themes and intent signals.

2. **SCRIBE memory:** If the Genkit engine is online (`localhost:4100`), invoke the `keeper` flow:
   ```
   POST http://localhost:4100/retrieve
   { "query": "<topic>", "limit": 5 }
   ```
   Surface any prior IDEATE sessions, decisions, or relevant KIs.

3. **Knowledge Items:** Scan KI summaries for matching topics. Read full KI artifacts for any match before generating.

4. **ATELIER + design toolchain (v5, internal):** Read `docs/design-system/design-toolchain.md` and follow the **user-facing contract** (tool silence). Then `docs/design-system/pattern-index.md` and the **3 closest** concrete anchors from `tools/design-library/<source>/` (README or `catalog.json`) — only if this session has a visual surface (see Step 5 gate). Skip for pure infrastructure/OS sessions. **Internally** note which ingest path or Stitch would strengthen DESIGN; **do not** ask the user to pick — decide and proceed.

**Retrieval outcome gate:**
- **Relevant prior context found** → Synthesize it into the Possibility Frame (Step 2). Do not generate directions that ignore or contradict established decisions.
- **Nothing found** → Note explicitly: "No prior context retrieved. Generating from first principles." Then proceed.

> [!IMPORTANT]
> If retrieval cannot be confirmed complete (engine offline, no summaries available), note the gap — do not silently skip retrieval and proceed as if it ran.

### Step 2 — Define the Possibility Space

STRATA maps the terrain:

- **What is this really about?** (underlying need, not surface request)
- **Who is it for?** (user archetype, access tier: Studio / Client / Merch)
- **What constraints exist?** (tech stack, design system, sovereignty policy)
- **What's adjacent?** (related Creative Liberation Engine projects, existing components)

Output: A 2–3 sentence "Possibility Frame" that scopes the ideation.

### Step 3 — Generate 5 Directions

PRISM generates 5 named creative directions. After the five, include a **Work breakdown (for the user)** section: short titled bullets in everyday language (no tool names) so the human sees how the idea maps to shippable chunks and immediate next steps.

Each direction must include:

```
## [Direction Name] — [Evocative Subtitle]

**The Bet:** One sentence on what this direction is optimizing for.
**Visual Language:** Color, motion, density, metaphor.
**Key Feature / Mechanic:** The defining interaction or capability.
**Inspiration:** Real-world reference (product, art, architecture, etc.)
**Risk:** What could go wrong or what's unproven here.
```

Directions should span a spectrum: safe/familiar → ambitious/novel.

### Step 4 — STRATA's Pick (with reasoning)

After generating all 5, STRATA selects the strongest direction and explains why:

- Why this direction best serves the underlying need
- Which elements from other directions to borrow
- What to validate before committing

### Step 4.5 — Prompt Compiler (PRISM)

For the top 2 directions (STRATA's pick + runner-up), compile a structured visual prompt using this template:

```
[Surface type] · [Layout schema] · [Color mood: name + 2-3 hex anchors] ·
[Primary typeface + weight] · [Motion character: micro/reduced/heavy] ·
[1 real-world inspiration reference] · [1 constraint or differentiator]
```

This compiled prompt travels into DESIGN mode and is the basis for image generation. If PRISM cannot compile a specific color palette or typography choice from the direction description alone, flag it — DESIGN mode will ask the user before generating.

### Step 5 — Route to DESIGN or PLAN (Article XX)

> [!NOTE]
> This step only fires after Step 0.5 Discovery Gate has been satisfied.

**Before routing anywhere, apply the surface categorization gate:**

**Signals this session is INFRASTRUCTURE / OS / ARCHITECTURE** (no direct user-facing surface):
- The output is a protocol, a routing layer, a schema, a background service, a daemon, an agent behavior model, a data pipeline, or a system upgrade path
- The session describes something that everything else gets to use, not something a user directly interacts with
- Keywords present: mesh, routing, consolidation, daemon, schema, tier, protocol, microservice, indexing, inference layer, dispatch, architecture

**Signals this session is a PRODUCT / APP / EXPERIENCE** (has a visual surface):
- The output is a web app, mobile app, dashboard, marketing site, landing page, tool UI, or any screen a user looks at
- Keywords present: interface, screen, layout, onboarding, dashboard, mobile, website, design, component, page

---

**If INFRASTRUCTURE / OS / ARCHITECTURE → proceed directly to PLAN:**

Do NOT route through DESIGN. Execute `/plan` automatically with:
- STRATA's chosen direction + rationale
- The parallel or horizon directions noted
- Any scaffolding primitives called out (e.g. prediction-log table)

State explicitly: *"This session has no visual surface. Routing directly to PLAN — no DESIGN mode needed."*

---

**If PRODUCT / APP / EXPERIENCE → proceed to DESIGN:**

Immediately transition to DESIGN mode with:
- STRATA's chosen direction + compiled visual prompt
- The runner-up direction + compiled prompt  
- The 3 ATELIER / design-library anchors from Step 1 (pattern index + specific sources named)

Do NOT wait for the user to select a direction. Execute `/design` automatically.

> [!IMPORTANT]
> The pipeline is NOT always IDEATE → DESIGN → PLAN. It is IDEATE → **[categorize]** → DESIGN (if product) OR PLAN (if infrastructure). DESIGN is only for sessions that produce something with a visual surface.

---

## Creative Freedom

There is no rigid global UI system forced upon the applications. Every IDEATE sequence should start blank and fresh.

- Encourage full creative freedom.
- Provide wildly different aesthetic palettes, layout schemas, and typographic combinations across your 5 directions.
- Do not default to legacy styles like "Warm Trichromatic" or "Glassmorphism" unless specific to the user's request.

---

## Genkit Engine Integration

If `localhost:4100` is online, augment IDEATE with AI flows:

| Flow | Purpose | Endpoint |
|------|---------|---------|
| `iris` | Creative direction generation | `POST /generate` `{ "flow": "iris", "input": { "topic": "..." } }` |
| `keeper` | Memory retrieval | `POST /retrieve` `{ "query": "...", "limit": 5 }` |
| `athena` | Strategic framing | `POST /generate` `{ "flow": "athena", "input": { "context": "..." } }` |

If engine is offline, proceed with built-in CORTEX reasoning — never block IDEATE on engine availability.

---

## Output Format

Always use rich markdown. Use `##` headers for each direction. Bold key terms. Include **Work breakdown (for the user)** as above. Do not end with a laundry list of tools or open-ended “what pipeline?” questions. If one clarifying question is truly blocking ship, ask it alone; otherwise **immediately execute** the auto-proceed step (DESIGN or PLAN per Step 5).

---

## Constitutional Constraints

- **Article IX:** Never generate a minimal or half-formed direction. All 5 must be complete.
- **Article I:** Prefer sovereign/self-hosted designs over cloud-dependent ones when relevant.
- **Article XX alignment:** Tool silence and decomposition for the user — no toolchain interrogation; shortest path to **shippable** outcomes.
- Every direction must be buildable within the Creative Liberation Engine ecosystem.
