# Helix: Stitch / UI Design

> Parent: [IPSV-SPINE.md](./IPSV-SPINE.md)
> Helix ID: `helix-stitch`

---

## IDEATE

### Outputs
- UX goals and user journey defined
- Screen list / information architecture
- Vibe board: mood, references, visual direction
- DESIGN.md tokens confirmed or extended
- Layout pattern candidates identified (from library or new)

### Questions to Resolve
- What is this UI for? (installer, dashboard, marketing page, app flow)
- Who uses it? (end user, developer, internal team)
- What device/viewport constraints exist?
- Does an existing design system apply? Which DESIGN.md?
- What Stitch mode fits? (Ideate for exploration, Flash for speed, Thinking for polish)

---

## PLAN

### Outputs
- DESIGN.md loaded or created (tokens, typography, spacing, color)
- IA document: page/screen map with hierarchy
- Layout patterns selected and named (e.g., `NC-Hero-Bento-01`, `IE-Wizard-5Step`)
- Component inventory: what needs to be built vs. reused
- Stitch prompt strategy: single mega-prompt vs. iterative refinement

### Constraints
- Never start Stitch generation without DESIGN.md loaded
- Never let Stitch introduce colors/fonts outside the approved system
- Break complex UIs into structure-first, then style passes

---

## SHIP

### Phase 1: Structure (wireframe pass)
- Prompt Stitch for wireframe-style layouts only
- Focus on information hierarchy, responsive behavior, component placement
- Use Ideate mode; minimal copy, gray-box thinking

### Phase 2: System Styling
- Apply DESIGN.md tokens exactly (colors, typography, spacing)
- Micro-prompts for refinement: grid alignment, contrast, CTA emphasis
- Do NOT introduce new visual elements not in the system

### Phase 3: Component Lock
- Identify repeating blocks and name them as reusable components
- Document component patterns for future Stitch prompts
- Example: `IE-StepRail`, `IE-HealthCard`, `IE-EnvBlock`

### Phase 4: Export & Reconcile
- Export HTML/React from Stitch
- Manual pass: replace Stitch-generated values with exact design tokens (CSS vars)
- Write to target file in repo
- Handoff to Antigravity/IDE agent for JS logic layer

### Outputs
- Exported HTML/component code committed to repo
- Screenshot of final Stitch output
- List of elements Stitch didn't generate (JS logic, API calls, etc.)
- Handoff notes for IDE agent

---

## VALIDATE

### Checks
- **System adherence:** Only approved colors, fonts, spacing scales used
- **Layout semantics:** Clear hierarchy, consistent nav, responsive breakpoints
- **Implementation fit:** No stray frameworks/utilities outside chosen stack
- **Component reuse:** Were patterns properly named and documented?
- **Accessibility:** Contrast ratios, semantic HTML, keyboard nav basics

### Learning Log
- Did the Stitch prompt strategy work? (mega-prompt vs. iterative)
- Which components should be added to the permanent library?
- Were there system deviations that need DESIGN.md updates?
- What should the next Stitch project do differently?

---

## Relationship to Legacy Workflow

This helix supersedes `comet-stitch.md` (the linear 9-step Stitch build workflow).
The old workflow is preserved for reference but new Stitch work should follow this helix.

---
## Typography Engine: Pretext Integration

This helix now incorporates `@chenglou/pretext` for deterministic text measurement and layout. See [pretext-integration.md](./pretext-integration.md) for the full spec.

### Component-Level Capabilities
- **VirtualList:** Use `layout()` for exact row heights — zero-guess virtualization
- **Card:** Pre-compute text height for masonry/grid layouts without DOM reads
- **Button/Label:** Validate text fits at current token size, flag overflow at build time
- **HeroBlock:** Balanced text via `walkLineRanges()` binary search (shrink-wrap)
- **PullQuote:** Shrink-wrapped editorial typography
- **DataGrid:** Exact cell height prediction for dense `--density: compact` layouts

### VALIDATE Additions
- **Typography overflow check:** Run Pretext `layout()` against component specs at all breakpoints
- **Balance score:** Heading line-length variance must be < 1.5x (longest vs shortest)
- **Orphan detection:** Body text last-line width must exceed 25% of container
- See [typography-validation-agent.md](./typography-validation-agent.md) for full assertion definitions



## Version

| Field | Value |
|---|---|
| Version | 1.0.0 |
| Created | 2026-03-27 |
| Author | COMET + Artist |
| Parent | IPSV-SPINE.md |