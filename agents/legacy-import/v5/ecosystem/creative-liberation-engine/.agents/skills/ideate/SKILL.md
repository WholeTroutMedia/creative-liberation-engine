---
name: IDEATE Mode
description: Activate IDEATE mode — KEEPER + STRATA explore a topic, map the possibility space, generate creative directions, and optionally produce UI mockups or design briefs. Use when user asks to explore, brainstorm, ideate, or generate creative directions.
---

# IDEATE Mode — Creative Liberation Engine v5

## When to Use This Skill

Activate IDEATE when the user says:

- "ideate on…", "explore…", "brainstorm…", "what are some directions for…"
- "I want to think about…", "vision for…", "possibilities for…"
- After `/browser-ideate` has run and a creative brief is primed
- When a PLAN task surfaces open design questions

---

## Operating Principals

**Lead agents:** STRATA (Strategist) + PRISM (Visionary)
**Support agents:** KEEPER (Memory retrieval), LOGD (Truth-check on proposals)

---

## Step-by-Step Protocol

### Step 1 — Orient & Retrieve Context

Before generating anything, pull relevant memory:

1. **Browser context:** Check if open browser tabs are listed in the conversation context. If yes, read the 3–5 most relevant ones using the browser tool. Extract themes, visual references, and intent signals.
2. **SCRIBE memory:** If the Genkit engine is online (`localhost:4100`), invoke the `keeper` flow:

   ```
   POST http://localhost:4100/retrieve
   { "query": "<topic>", "limit": 5 }
   ```

   Surface any prior IDEATE sessions, brand decisions, or relevant KIs.
3. **Knowledge Items:** Check KI summaries for relevant prior work on this topic before generating fresh directions.

### Step 2 — Define the Possibility Space

STRATA maps the terrain:

- **What is this really about?** (underlying need, not surface request)
- **Who is it for?** (user archetype, access tier: Studio / Client / Merch)
- **What constraints exist?** (tech stack, design system, sovereignty policy)
- **What's adjacent?** (related Creative Liberation Engine projects, existing components)

Output: A 2–3 sentence "Possibility Frame" that scopes the ideation.

### Step 3 — Generate 5 Directions

PRISM generates 5 named creative directions. Each direction must include:

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

### Step 5 — Offer Next Actions

Present exactly 3 options, in order:

1. **"Generate UI screens for [direction]"** → Run `/design` with the selected direction as prompt
2. **"Build the implementation plan"** → Transition to PLAN mode with direction as input
3. **"Explore a different angle"** → Ask which of the 5 directions to pivot from, then re-run Step 3 with that constraint

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

Always use rich markdown. Use `##` headers for each direction. Bold key terms. End every IDEATE session with the 3-option menu from Step 5. Never end with an open question — always offer concrete next steps.

---

## Constitutional Constraints

- **Article IX:** Never generate a minimal or half-formed direction. All 5 must be complete.
- **Article I:** Prefer sovereign/self-hosted designs over cloud-dependent ones when relevant.
- Every direction must be buildable within the Creative Liberation Engine ecosystem.
