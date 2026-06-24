---
description: Generate UI screens from an IDEATE direction using Stitch MCP — creates a project, generates screens, returns preview links and next steps
---

# /design <prompt>

Use this workflow when you need to design or prototype any UI screen, dashboard, component, or flow within the Creative Liberation Engine ecosystem. Defaults to **Gemini image generation** to save Stitch credits — use `--stitch` flag for full Stitch MCP fidelity.

**Activates on:**

- `/design <what to build>` — Gemini generate_image (default)
- `/design <what to build> --stitch` — Full Stitch MCP project (costs credits)
- `/design-edit "<change>"` — refine an existing screen (uses last known screenId)
- "design a screen for..." / "generate UI for..." / "mock up..." / "prototype..."
- "show me what <feature> could look like"

---

## Steps

// turbo-all

### Step 1 — Resolve Context

Before generating, gather context to make the prompt precise:

1a. Check if an active Stitch project already exists for this workstream:
    - Call `mcp_StitchMCP_list_projects` to list owned projects.
    - Search for a project whose title contains the current workstream name (e.g. "console-ui", "zero-day").
    - If found → use that project ID (we are adding a screen to an existing project).
    - If not found → proceed to Step 2 to create a new project.

1b. Determine the **device type** from the prompt:
    - Contains "mobile", "phone", "iOS", "Android" → `MOBILE`
    - Contains "tablet", "iPad" → `TABLET`
    - Otherwise → `DESKTOP`

1c. Enrich the user's prompt with Creative Liberation Engine context:
    - Add surface-specific context based on the workstream:
      - `console-ui` → "This is the v5 Console — a high-density command center for the Creative Liberation Engine CORTEX collective."
      - `zero-day` → "This is the Zero-Day GTM portal — client intake, LEX contract review, Stripe payment flows, and secure client portal."
      - `comet-browser` → "This is NAVD — a sovereign spatial browser operating surface with multi-session canvases and DOM node graphs."
      - Other → Describe the workstream surface in one sentence.

---

### Step 2 — Create Project (if needed)

If no existing project was found in Step 1a:

```
mcp_StitchMCP_create_project(title="[workstream-name] — Creative Liberation Engine v5")
```

Store the returned `projectId` for all subsequent calls.

---

### Step 3 — Generate Primary Screen

// turbo
3. **Generate screen.**

   **Default (no `--stitch` flag) — Gemini generate_image:**

- Call `generate_image` with:
  - `Prompt`: the enriched prompt from Step 1c
  - `ImageName`: snake_case name derived from the surface + feature (e.g. `zero_day_intake_form`)
- This is fast, free-tier, and sufficient for all IDEATE and PLAN phases.

   **Opt-in (`--stitch` flag) — Stitch MCP:**

- Call `mcp_StitchMCP_generate_screen_from_text` with:
  - `projectId` from Step 1a or Step 2
  - `deviceType` from Step 1b
  - `modelId`: `GEMINI_3_PRO`
  - `prompt`: the enriched prompt from Step 1c
- Use this only for client-facing deliverables or final SHIP-phase design handoffs.
- Wait up to 2 minutes — do not retry.

---

### Step 4 — Generate Variants (optional, if prompt is exploratory)

// turbo
4. **Generate variants (optional).**

- **Default mode:** Call `generate_image` 2 more times with the same prompt, varying one aspect each time:
  - Variant A: add "Emphasize the data table / primary action area"
  - Variant B: add "More minimal, reduce visual noise, breathe"
- **Stitch mode (`--stitch`):** Call `mcp_StitchMCP_generate_variants` with:
  - `projectId` + `selectedScreenIds`: [screenId from Step 3]
  - `variantOptions`: `{ "numberOfVariants": 2, "creativeRange": "MEDIUM" }`

   If the prompt is specific and targeted (not exploratory), skip variants and go to Step 5.

---

### Step 5 — Retrieve and Present Results

For each generated screen, call `mcp_StitchMCP_get_screen` to get the full details including the preview URL.

Present results in the following format:

```
✅ /design complete — [N] screen(s) generated  [engine: Gemini | Stitch]

SURFACE   [workstream surface]
DEVICE    [DESKTOP | MOBILE | TABLET]

─────────────────────────────────────────────

PRIMARY   [image artifact path or screenshotUrl]
VARIANT A [image artifact path or screenshotUrl]
VARIANT B [image artifact path or screenshotUrl]

─────────────────────────────────────────────

NEXT STEPS
  /design-edit "[what to change]"   — refine
  /design <new prompt> --stitch      — upgrade to full Stitch fidelity
  /figma-import                      — pull live Figma spec instead
```

---

### Step 6 — Output Component Suggestions

If `output_components` from Step 3 contains suggestion chips (e.g. "Yes, make them all", "Add a dark variant"):

- Present them as numbered options to the user.
- If the user selects one, call `mcp_StitchMCP_generate_screen_from_text` again with that suggestion as the `prompt`.

---

### Step 7 — Update Task Queue (on first use)

If this is the first time `/design` has been run in this session:

- Mark `T20260305-004` as `done` in `.agents/dispatch/task-queue.md`.
- Update the `Completed Tasks` table with the result.

---

## Rules

- **Default:** Use `generate_image` — fast, no credit cost, sufficient for IDEATE/PLAN phases
- **`--stitch` flag:** Use Stitch MCP only for client-facing or final SHIP-phase deliverables
- Approach all designs as a blank, fresh canvas to encourage full creative freedom
- Never ask for a Stitch project ID — always look it up or create one (only in Stitch mode)
- This workflow owns the `console-ui` workstream — do not modify files in other workstreams
- Always present preview artifacts for immediate visual feedback

---

## Fallback — Stitch MCP Unavailable

**Fallback / Standard path — Gemini generate_image (DEFAULT):**

1. Call `generate_image` with the enriched prompt + design system context
2. The artifact is automatically saved and embedded in the response
3. Note engine in output: `[engine: Gemini]`

**Stitch MCP path (opt-in via `--stitch`):**

1. Proceed with Steps 2–6 above
2. Note engine in output: `[engine: Stitch MCP]`
