---
description: Execute PLAN mode — produce comprehensive technical specification from IDEATE output
---

# PLAN Mode Workflow

// turbo-all

**Source of Truth:** `creative-liberation-engine-v4/MODES/02_PLAN/MODE_CONFIG.json`
**Agent Focus:** ATHENA (architecture) + VERA (documentation/truth)
**Input Required:** Approved IDEATE audit (ideate_audit.md or equivalent)
**Output:** Complete technical specification ready for SHIP

## Steps

### 1. Read Mode Configuration

Read `creative-liberation-engine-v4/MODES/02_PLAN/MODE_CONFIG.json` and `agents_roster.json` to load:

- Exit criteria (technical_spec_complete, architecture_defined, tasks_broken_down, dependencies_mapped)
- Agent roster (ARCH, Aurora, KEEPER, RELAY, VERA + project-specific agents)

### 2. Read IDEATE Artifacts

Gather all IDEATE outputs:

- PROJECT_SCOPE.md (vision document)
- Stitch project screens (selected design direction)
- ATELIER pattern references used during ideation
- Any competitive audit or research docs
- Existing codebase (current state of implementation)
- Previous session artifacts (walkthroughs, task lists)

### 3. Design System Integration

If IDEATE produced Stitch designs, translate them into a design system plan:

#### Design Token Extraction

From the selected Stitch direction, define:

- **Color palette** — primary, secondary, accent, semantic (success/warning/danger)
- **Typography** — font families, size scale, weight scale, line heights
- **Spacing** — base unit, spacing scale, gutter, padding
- **Borders** — radius values, border widths, border colors
- **Shadows** — elevation levels
- **Component tokens** — card, button, input, table, list item, chip

#### Design Tool Selection Matrix

| Tool | Phase | Purpose | Status |
| --- | --- | --- | --- |
| **Stitch** (StitchMCP) | IDEATE → PLAN | Screen layouts, component hierarchy | ✅ Available |
| **Figma MCP** | PLAN → SHIP | Programmatic design token export | ⬜ Requires connector setup |
| `generate_image` **(Nano Banana 2)** | Any phase | Production assets, brand visuals, concept art | ✅ Built-in |

#### FLORA Design Token Spec

If using FLORA (Aurora's design system), read `creative-liberation-engine-v4/ATELIER/design-library/flora/` and
map design tokens to CSS custom properties:

```css
:root {
    --flora-primary: #3B82F6;
    --flora-spacing-base: 16px;
    --flora-radius: 8px;
    --flora-font: 'Inter', system-ui, sans-serif;
}
```

#### Platform Matrix

Document which platforms need design implementation:

| Platform | Technology | Design Export |
| --- | --- | --- |
| Web (Desktop) | Next.js + CSS custom properties | Stitch → CSS classes |
| Web (Mobile) | Responsive CSS or PWA | Stitch Mobile → CSS |
| iOS | SwiftUI | Stitch → SwiftUI components |
| Android | Jetpack Compose | Stitch → Compose components |

### 4. Read CLE Templates Standards

Read `apps/cle-templates/FUTURE_PROOF_CHECKLIST.md` for the production standards matrix.
Read `apps/cle-templates/TEMPLATE_GUIDE.md` for deployment checklist.

### 5. Produce Technical Specification

Create `implementation_plan.md` with these required sections:

#### I. Architecture Design

- System topology diagram (Mermaid)
- Target directory structure
- Component relationships
- Design system architecture (tokens → classes → components)

#### II. Data Model

- Entity Relationship Diagram (Mermaid)
- Table definitions (with ORM schema code)
- Type definitions (TypeScript interfaces)

#### III. API Contracts

- Router/endpoint structure
- Key procedures table (name, type, description)
- WebSocket event types (if real-time needed)

#### IV. Design-to-Code Pipeline

- Stitch screen → CSS custom property mapping
- Component breakdown (which Stitch sections → which React components)
- ATELIER pattern → reusable component mapping
- Accessibility requirements per component (ARIA roles, keyboard navigation)

#### V. Integration Sequence

- Ordered task list with dependencies
- Weekly breakdown (tasks grouped by priority)
- Prerequisite flow (what depends on what)

#### VI. Risk Assessment & DevSecOps

- STRIDE Threat Model (Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation of Privilege)
- Authorization Matrix (RBAC/ABAC mapping)
- 3rd-Party License Audit (Checking for copyleft contamination)
- General Risk table (probability, impact, mitigation)

#### VII. Verification Plan

- Test commands (unit, integration, E2E)
- Coverage targets
- Critical user journeys (at least 5)
- Manual verification steps
- Accessibility audit plan (WCAG 2.1 AA gates)

#### VIII. Telemetry & Observability

- Standard SLIs (Service Level Indicators) defined
- Core business metrics payload mapping
- Feature flags required for rollout

### 6. Validate Against Standards

#### Mode Exit Criteria

```json
{
  "technical_spec_complete": true,
  "architecture_defined": true,
  "tasks_broken_down": true,
  "dependencies_mapped": true,
  "stride_threat_model_completed": true,
  "authorization_rbac_mapped": true,
  "third_party_license_audit_passed": true,
  "telemetry_slos_defined": true,
  "design_system_defined": true,
  "constitutional_compliance": true
}
```

#### CLE Templates Compliance

Map against FUTURE_PROOF_CHECKLIST.md categories:

- Architecture Patterns (modular, API-first, event-driven, stateless)
- Data Layer (CQRS, soft deletes, data export)
- Security (encryption, secrets management, rate limiting)
- AI/ML Integration (model agnostic, prompt versioning, cost monitoring)
- Performance (lazy loading, CDN, Core Web Vitals)
- Developer Experience (TypeScript strict, automated testing ≥80%)
- Accessibility (WCAG 2.1 AA, semantic HTML, keyboard navigation)

### 7. Create Task Checklist

Create `task.md` with:

- Mode progression tracker (IDEATE → PLAN → SHIP → VALIDATE)
- PLAN deliverables (each section above as a checklist item)
- SHIP tasks (ordered, with weekly grouping)
- Design system implementation tasks (CSS tokens → component classes)

### 8. Notify User

Present implementation_plan.md for review and approval to transition to SHIP.
