---
description: Execute IDEATE mode — vision extraction, design generation, and strategic alignment
---

# IDEATE Mode Workflow

// turbo-all

**Source of Truth:** `creative-liberation-engine-v4/MODES/01_IDEATE/`
**Agent Focus:** ATHENA (strategy) + IRIS (execution) + STUDIO (UI/UX)
**Outputs:** Vision profile, 10 design concepts (via Stitch), strategic audit

---

## Track A: UI/UX Design Ideation (via Stitch + ATELIER)

Use this track when the user wants to design or redesign a UI/UX.

### 1. Read the Design Protocol

Read `creative-liberation-engine-v4/MODES/01_IDEATE/DESIGN_PROTOCOL.md` for the full 3-phase process.

### 2. ATELIER Pattern Library Search

Before generating any designs, search the ATELIER pattern library for reference:

- `creative-liberation-engine-v4/ATELIER/design-library/mobbin/` — Mobbin pattern library
- `creative-liberation-engine-v4/ATELIER/design-library/figma/` — Figma Community patterns
- `creative-liberation-engine-v4/ATELIER/design-library/flora/` — FLORA.ai design tokens (Aurora's system)

Select 3-5 reference patterns that align with the target user's domain and device context.
These references inform Stitch prompts and ensure production-quality output.

### 3. Vision Extraction (Phase 1)

Ask the user the 5 vision extraction questions from the protocol:

1. **Emotion & Feeling** — Target emotion + physical space metaphor
2. **Brand Personality** — 3 adjectives, admired brands, anti-patterns
3. **User Journey** — Primary action, 3-second message, delight factor
4. **Visual Preferences** — Color mood, typography vibe, imagery style
5. **Unique Assets** — Existing brand assets, custom elements, symbols/metaphors

Synthesize answers into a **VisionProfile** summary. Confirm with the user before proceeding.

### 4. Asset Generation (Phase 2)

Based on the VisionProfile, generate visual assets:

**Tool Selection:**

| Tool | When to Use | Strengths |
| --- | --- | --- |
| `generate_image` **(Nano Banana 2)** | Quick concept art, icons, brand visuals, production assets | Fast, inline, iterative. Built-in. 5 chars/14 objects max per scene. Conversational refinement mode |
| **Google Stitch** | Full screen layouts, multi-component UI | Figma-exportable, auto-layout preserved |

- **If user has assets**: analyze their style, generate complementary pieces
- **If no assets**: generate 3-5 custom visual assets aligned to the vision
- Save all assets to the project directory for use in designs

### Stitch Prompting Best Practices

When crafting prompts for Stitch, follow these guidelines for best results:

**Mindset**: Treat Stitch as a literal-minded junior designer. Clear, specific instructions > vague creative direction.

**Prompt Structure** (Zoom-Out-Zoom-In Framework):

1. **Broad context** — Product name, target user, brand personality
2. **Screen specifics** — Goal of this screen, layout hierarchy, functional requirements
3. **Design constraints** — Color palette, typography, style direction, what to avoid

**Key Rules**:

- **Start with intent**: State the goal (what + for whom), mood/brand feel, and device context
- **Use precise UI/UX terms**: "navigation bar", "hero section", "CTA button", "stat card" not vague descriptions
- **Set visual boundaries early**: Define the style (Neumorphic, Brutalist, Material, etc.) at the start of the prompt
- **Specify colors as hex codes**: `#0d1117 background, #c9d1d9 text, #da3633 accent`
- **One change per edit prompt**: When using `edit_screens`, make incremental changes, not full rewrites
- **Use adjectives for tone**: "premium", "industrial", "warm", "clinical" — these guide color/type/spacing
- **List required sections**: Explicitly name every section/component the screen must contain
- **Specify what NOT to include**: Anti-patterns help Stitch avoid generic outputs

**Prompt Template**:

```text
Design: [STYLE NAME] — [PROJECT NAME] [SCREEN TYPE]

Create a [style]-style [screen type]. For [target user] [doing what].

Style: [3-5 specific style attributes]. [Physical metaphor]. [Typography spec]. [Layout strategy].

Must include:
- [Section 1 with specific content]
- [Section 2 with specific content]
- ...

Color: [hex background], [hex text], [hex accent], [hex secondary]
```

### 5. Create Stitch Project (Phase 3)

Use the StitchMCP tools to generate design concepts:

**Available MCP Tools:**

- `mcp_StitchMCP_create_project` — Create project
- `mcp_StitchMCP_generate_screen_from_text` — Generate screens from text prompt
- `mcp_StitchMCP_edit_screens` — Edit existing screens (one change at a time)
- `mcp_StitchMCP_generate_variants` — Generate variants of selected screens
- `mcp_StitchMCP_list_screens` / `mcp_StitchMCP_get_screen` — Inspect results

**Platform Targeting:**

Always set `deviceType` to match the target:

- `DESKTOP` — Web dashboards, admin panels, productivity tools
- `MOBILE` — iOS/Android companion apps, consumer-facing
- `TABLET` — iPad command centers, field production tools

Generate screens for **10 design directions** from the protocol:

| # | Direction | Prompt Strategy |
| --- | --------- | --------------- |
| 1 | BRUTALIST | Raw typography, high contrast, exposed grid, deliberately "broken" layout |
| 2 | NEOMORPHIC | Soft shadows, tactile depth, muted pastels, glassmorphic elements |
| 3 | EDITORIAL LUXURY | Magazine layout, serif headlines, asymmetric composition |
| 4 | TECH MINIMALIST | Apple-inspired, extreme simplification, animation-driven |
| 5 | DATA VISUALIZATION | Dashboard aesthetic, charts as design, information density |
| 6 | ORGANIC FLUID | Curved forms, gradient meshes, natural colors, soft edges |
| 7 | RETRO TERMINAL | Command-line aesthetic, monospace fonts, hacker vibe |
| 8 | MAXIMALIST COLOR | Bold multi-color, overlapping elements, pattern-rich |
| 9 | SWISS MODERNIST | Perfect grid, limited color, mathematical precision |
| 10 | EXPERIMENTAL 3D | Depth layers, parallax, isometric elements, spatial UI |

For each direction, craft the Stitch prompt by combining:

- The design direction style keywords
- The user's VisionProfile (emotion, brand, action, colors)
- The page type and functional requirements
- ATELIER pattern references (Mobbin screenshots, FLORA tokens)
- Any generated or provided assets as context

### 6. Mobile Companion Variants

If the project needs mobile support, create a **separate mobile ideation pass**:

1. Generate all 10 directions with `deviceType: MOBILE`
2. Focus on thumb-zone navigation, bottom sheets, gesture-driven interactions
3. Create side-by-side comparisons with desktop versions
4. Document platform-specific patterns (iOS HIG vs Material Design)

### 7. Generate Variants (Optional)

If the user gravitates toward 2-3 favorites, use `mcp_StitchMCP_generate_variants` to produce refined variations of those directions.

### 8. Edit and Refine

Use `mcp_StitchMCP_edit_screens` to incorporate user feedback on specific screens.

### 9. Present to User

Share the Stitch project link and screenshots. Ask user to pick their top 1-3 for refinement or to proceed to PLAN mode with the selected direction.

---

## Track B: Strategic Ideation (Original)

Use this track for non-UI strategic/vision validation.

### 1. Read the MODE_CONFIG

Read `creative-liberation-engine-v4/MODES/01_IDEATE/MODE_CONFIG.json` to load entry/exit criteria.

### 2. Locate the Vision Document

Find and read the project's `PROJECT_SCOPE.md` (or equivalent vision document).

### 3. Audit the 10 IDEATE Deliverables

Verify each deliverable exists and is substantive (not a stub):

- [ ] **Mission & Vision** — Clear problem statement + solution definition
- [ ] **Target User Personas** — At least 3 distinct user roles with needs defined
- [ ] **Competitive Research** — At least 5 platforms audited with feature matrix
- [ ] **System Architecture** — Component diagram with data flow
- [ ] **Tech Stack Selection** — Frontend, backend, DB, cache, queue defined
- [ ] **Business Model** — Pricing tiers + revenue projection
- [ ] **Team Structure** — Agent hive assignment with roles
- [ ] **Proof of Concept** — At least 1 shipped commit demonstrating core capability
- [ ] **Integration Mapping** — All external APIs and services identified
- [ ] **Deployment Strategy** — Hosting, CI/CD, offline support defined

### 4. Identify Gaps

Classify severity:

- 🔴 **Blocker** — Cannot proceed to PLAN without this
- 🟡 **Gap** — Normal at IDEATE→PLAN boundary, becomes PLAN task
- 🟢 **Nice-to-have** — Can be addressed in SHIP

### 5. Produce Report

Create an `ideate_audit.md` artifact with deliverable status matrix, gaps, and recommendation: READY or NOT READY for PLAN.

### 6. Notify User

Present the audit and ask for approval to transition to PLAN mode.

---

## Validation Criteria (Both Tracks)

Before presenting to user:

- [ ] Does it deliver the target emotion?
- [ ] Is the primary action obvious?
- [ ] Does it avoid the anti-patterns user specified?
- [ ] Is it unmistakably unique to their vision?
- [ ] WCAG 2.1 AA accessible (4.5:1 contrast, 48×48 touch targets)?
- [ ] All designs >70% different from each other?
- [ ] ATELIER pattern references documented for downstream handoff?
