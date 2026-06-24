---
description: Execute SHIP mode — implement the technical spec with TDD, design system enforcement, and circuit breaker patterns
---

# SHIP Mode Workflow

**Source of Truth:** `creative-liberation-engine-v4/MODES/03_SHIP/` + `.creative-liberation-engine/config.yml`
**Agent Focus:** IRIS (execution) + BUILDER swarm (BOLT, COMET, SIGNAL, etc.)
**Input Required:** Approved PLAN (implementation_plan.md)
**Output:** Live, deployed, tested application

## Steps

### 1. Read PLAN Artifacts

Load implementation_plan.md and task.md to get:

- Architecture design (directory structure, technology choices)
- Data model (table schemas, migrations)
- API contracts (router structure, procedures)
- Design system tokens (colors, typography, spacing, components)
- Task breakdown (weekly ordering)
- Verification plan (test targets, user journeys)

### 2. Load Configuration

Read `.creative-liberation-engine/config.yml` for:

```yaml
tdd:
  enabled: true
  require_tests_first: true
  min_coverage: 80
circuit_breaker:
  enabled: true
  max_attempts: 3
  escalate_to: ATHENA
```

### 3. Set Up Development Environment

// turbo

```bash
npm install
```

### 4. Design System Foundation (Before Components)

If the PLAN includes a design system, build it first:

#### a. Create Design Tokens File

Implement CSS custom properties from the PLAN's design token spec:

```css
:root {
    --nx-bg: #0d1117;
    --nx-surface: #161b22;
    --nx-text: #e4e4e4;
    --nx-accent: #00d4ff;
    /* ... all tokens from PLAN */
}
```

#### b. Create Design System CSS

Build `nx-*` utility classes and component classes using BEM nomenclature:

- Layout utilities (flex, grid, gap, margin, padding)
- Typography utilities (size, weight, color)
- Component classes (card, button, chip, table, list-item, stat, etc.)
- Theme-specific overrides (per `data-nexus-theme` attribute)

#### c. Enforce No Inline CSS Rule

All styling MUST use CSS classes or CSS custom properties.
`style={{}}` is only acceptable for truly dynamic computed values (e.g., progress bar widths).
This ensures:

- Theme switching works correctly
- Consistent design language
- Zero CSS lint warnings

### 5. Design-to-Code Pipeline

When translating Stitch screens to code:

#### a. Screen → Component Mapping

Break each Stitch screen into React components:

- Identify reusable patterns (cards, lists, headers, stat cards)
- Map Stitch layers to component hierarchy
- Assign `nx-*` classes to each element

#### b. Stitch → Code Translation Rules

| Stitch Element | React Implementation |
| --- | --- |
| Container/Frame | `<div className="nx-card">` |
| Text Layer | `<p className="nx-ts-13 nx-c-text">` |
| Button | `<button className="nx-btn nx-btn--primary">` |
| Status Indicator | `<span className="nx-status nx-status--online">` |
| Data Table | `<table className="nx-table">` |
| Progress Bar | `<div className="nx-meter">` |

#### c. Accessibility Enforcement

Every component must include:

- Semantic HTML elements (`<nav>`, `<main>`, `<section>`, `<article>`)
- ARIA labels on interactive elements
- Keyboard navigation support
- 4.5:1 minimum contrast ratio (WCAG AA)
- 48×48px minimum touch targets on mobile

### 6. Execute Tasks in Order

For each task in task.md SHIP sections, follow this cycle:

#### a. Write Test First (TDD)

Create test file before implementation (per config: `require_tests_first: true`)

#### b. Implement

Write the code to pass the test.

#### c. Verify

// turbo

```bash
npm run test
npm run typecheck
npm run lint
```

#### d. Circuit Breaker Enforcement (Zero-Day Resilience)

If an implementation or test cycle fails 3 times sequentially:

- **IMMEDIATE HALT**: Stop current approach.
- Do not attempt brute-force hacking or guessing.
- Escalate to ATHENA/SYSTEMS for architectural guidance and root cause analysis.
- If an alternative elegant approach is found, execute it.
- If still failing, trigger the Circuit Breaker: flag as a critical blocker, isolate the module, and pivot to the next viable task.

#### e. Commit

```bash
git add -A
git commit -m "feat(component): description of what was built"
```

### 7. Update task.md

Mark each completed task as `[x]` and in-progress tasks as `[/]`.

### 8. Build Validation

// turbo

```bash
npm run build
```

Ensure zero errors before proceeding.

### 9. Grep for Inline CSS (Zero-Day Enforcement)

// turbo

```bash
grep -rn "style={{" frontend/src/app/ --include="*.tsx" | grep -v "width:" | grep -v "height:" | head -20
```

Any results (except dynamic width/height for progress bars) must be converted to CSS classes. This is non-negotiable for Masterclass standards.

### 10. SAST & Static Analysis (Non-Negotiable)

Before declaring SHIP complete, run static analysis and type checking.

// turbo

```bash
npm run lint -- --max-warnings=0
npx npm-audit-ci-wrapper || npm audit
```

If SAST tools, dependency audits, or strict linting throw warnings or errors, they **MUST** be fixed. You cannot transition to VALIDATE mode with lingering vulnerabilities or lint warnings.

### 10. Notify User

When all SHIP tasks are complete (or a meaningful milestone reached), present a walkthrough.md summarizing what was built, tests passing, and readiness for VALIDATE.
