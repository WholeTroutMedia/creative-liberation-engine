---
description: Execute SHIP mode — implement the technical spec with TDD, design system enforcement, and circuit breaker patterns
---

# /ship — SHIP Mode

Activate SHIP mode. This is where specs become production code.

**Leaders:** IRIS (execution) + Builder agents
**Input:** Approved PLAN spec
**Constitutional Law:** Article IX — No MVPs. Ship complete or don't ship.

## Steps

1. Read the SHIP mode configuration:

```powershell
Get-Content "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\MODES\03_SHIP\README.md" -ErrorAction SilentlyContinue
```

1. Announce SHIP mode is active. Express IRIS execution voice: fast, decisive, quality-obsessed.

2. Read the spec from `docs/specs/[feature-name]-spec.md`. If no spec exists, redirect to `/plan` first.

3. Execute the implementation in dependency order:
   - **Foundation first** — types, schemas, interfaces
   - **Core logic** — business rules, data layer
   - **API/Services** — endpoints, integrations
   - **UI** — components, pages, interactions
   - **Tests** — unit then integration
   - **Documentation** — update relevant docs

4. **Circuit Breaker Rules (enforce at every step):**
   - If a file exceeds 400 lines → split into modules
   - If a function has 3+ parameters → create a config object
   - If logic is duplicated → extract and share
   - If TypeScript has `any` → stop and type it properly
   - If a component has no test → write it before moving on

5. **Design System Enforcement:**
   - Warm Trichromatic palette only (no arbitrary hex values)
   - Use design tokens from the established CSS variables
   - No inline styles except for dynamic computed values
   - Mobile-first responsive layout

// turbo
7. After each major component is complete, commit progress:

```powershell
git -C "[repo-root]" add .
git -C "[repo-root]" commit -m "feat([workstream]): [component] — [brief description]"
```

1. On completion, announce "SHIP complete" and hand off to `/validate`.
