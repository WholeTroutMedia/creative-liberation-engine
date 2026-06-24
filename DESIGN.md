---
# DESIGN.md — Creative Liberation Engine V6
# Spec: https://github.com/nicholasgasior/design.md (Google Labs format)
# Version: 6.0.0
# Updated: 2026-04-22

design_system:
  name: "Creative Liberation Engine"
  version: "6.0.0"
  description: >
    Sovereign AI production infrastructure for artist liberation.
    Dark-first HUD aesthetic. Glassmorphism for depth. Blue-violet
    gradient axis representing sovereignty and creative energy.

colors:
  # Primary — Sovereign Blue
  primary: "#0EA5E9"
  primary-dark: "#0284C7"
  primary-light: "#38BDF8"
  primary-subtle: "rgba(14, 165, 233, 0.12)"

  # Accent — Creative Violet
  accent: "#8B5CF6"
  accent-dark: "#7C3AED"
  accent-light: "#A78BFA"
  accent-subtle: "rgba(139, 92, 246, 0.12)"

  # Surfaces — Deep Dark
  surface-base: "#0F172A"
  surface-elevated: "#1E293B"
  surface-overlay: "#334155"
  surface-glass: "rgba(15, 23, 42, 0.85)"
  surface-glass-border: "rgba(248, 250, 252, 0.08)"

  # Text
  text-primary: "#F8FAFC"
  text-secondary: "#94A3B8"
  text-tertiary: "#64748B"
  text-disabled: "#475569"

  # Semantic
  success: "#10B981"
  success-subtle: "rgba(16, 185, 129, 0.12)"
  warning: "#F59E0B"
  warning-subtle: "rgba(245, 158, 11, 0.12)"
  error: "#EF4444"
  error-subtle: "rgba(239, 68, 68, 0.12)"
  info: "#06B6D4"
  info-subtle: "rgba(6, 182, 212, 0.12)"

  # Gradients
  gradient-primary: "linear-gradient(135deg, #0EA5E9, #8B5CF6)"
  gradient-surface: "linear-gradient(180deg, #1E293B, #0F172A)"
  gradient-glow: "radial-gradient(ellipse at center, rgba(14, 165, 233, 0.15), transparent 70%)"

typography:
  heading: "Inter"
  body: "Inter"
  mono: "JetBrains Mono"
  scale:
    xs: 12
    sm: 14
    base: 16
    lg: 18
    xl: 20
    2xl: 24
    3xl: 30
    4xl: 36
    5xl: 48
    6xl: 60
  weights:
    regular: 400
    medium: 500
    semibold: 600
    bold: 700
  line-heights:
    tight: 1.25
    normal: 1.5
    relaxed: 1.625

spacing:
  unit: 4
  scale:
    0: 0
    1: 4
    2: 8
    3: 12
    4: 16
    5: 20
    6: 24
    8: 32
    10: 40
    12: 48
    16: 64
    20: 80
    24: 96

radii:
  none: 0
  sm: 4
  md: 8
  lg: 12
  xl: 16
  full: 9999

effects:
  glass:
    blur: "blur(16px)"
    border: "1px solid rgba(248, 250, 252, 0.08)"
    background: "rgba(15, 23, 42, 0.85)"
  shadows:
    sm: "0 1px 2px rgba(0, 0, 0, 0.3)"
    md: "0 4px 12px rgba(0, 0, 0, 0.4)"
    lg: "0 8px 32px rgba(0, 0, 0, 0.5)"
    glow-primary: "0 0 24px rgba(14, 165, 233, 0.25)"
    glow-accent: "0 0 24px rgba(139, 92, 246, 0.25)"

animation:
  duration:
    fast: "150ms"
    default: "200ms"
    slow: "300ms"
    complex: "500ms"
  easing:
    default: "cubic-bezier(0.4, 0, 0.2, 1)"
    in: "cubic-bezier(0.4, 0, 1, 1)"
    out: "cubic-bezier(0, 0, 0.2, 1)"
    spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)"

breakpoints:
  sm: 640
  md: 768
  lg: 1024
  xl: 1280
  2xl: 1536

z-index:
  base: 0
  dropdown: 10
  sticky: 20
  modal: 30
  popover: 40
  toast: 50
  tooltip: 60
---

# Creative Liberation Engine — Design Identity

## Philosophy

The Creative Liberation Engine exists to liberate artists through sovereign AI infrastructure.
Every visual surface — from the dispatch terminal to the portfolio showcase — must
communicate three things:

1. **Sovereignty** — This is infrastructure you own. Not rented. Not borrowed. The
   deep dark surfaces and blue primary palette signal control and self-sufficiency.

2. **Creative Energy** — The violet accent axis introduces warmth and creative
   possibility into what would otherwise be a cold technical interface. Art is
   the purpose; technology is the vehicle.

3. **Clarity Under Complexity** — Production environments are complex. The design
   system prioritizes legibility, information density, and progressive disclosure
   over decoration. Every element earns its pixels.

## Dark-First HUD Aesthetic

All CLE surfaces default to dark mode. This is not a theme preference — it's
an architectural decision:

- **Production environments are dark.** Color-grading suites, editing bays, VFX
  workstations, and server rooms all use dark interfaces to reduce eye strain during
  extended sessions and preserve color accuracy.
- **Data density.** Dark backgrounds provide superior contrast for data-heavy
  interfaces — timelines, waveforms, node graphs, and telemetry dashboards.
- **Professional context.** Our users are production professionals. The interface
  must feel like a tool, not a consumer product.

Light mode may be offered in future for documentation and public-facing surfaces,
but all internal tooling and agent interfaces are dark-first.

## Glassmorphism Protocol

Elevated surfaces use glassmorphism to convey depth without visual weight:

```css
.surface-glass {
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(248, 250, 252, 0.08);
  border-radius: 12px;
}
```

**Rules:**
- Glass effects are for *elevated* content only — modals, popovers, floating panels
- Base-level content sits on solid `surface-base` or `surface-elevated`
- Never stack more than 2 glass layers — legibility degrades rapidly
- Glass borders are always `rgba(248, 250, 252, 0.08)` — barely visible, structurally
  essential

## Color Axis: Blue → Violet

The primary-to-accent gradient defines the CLE visual signature:

- **Blue (#0EA5E9):** Primary actions, navigation, links, active states. Represents
  sovereignty, reliability, and technical precision.
- **Violet (#8B5CF6):** Creative accents, highlights, featured content, AI-generated
  elements. Represents creative energy, innovation, and the "magic" of autonomous
  production.
- **Gradient:** Used sparingly for hero elements, progress indicators, and brand
  moments. Never for body text or dense UI.

## Typography

- **Inter** — All headings and body text. Clean, highly legible at all sizes, excellent
  for data-dense interfaces. Loaded from Google Fonts with `font-display: swap`.
- **JetBrains Mono** — All code, terminal output, technical identifiers, and
  monospaced data (timestamps, IDs, file paths). Provides clear differentiation
  between prose and machine-readable content.

### Scale

The type scale follows a harmonious progression using `rem` units with a `16px` base:

| Token | Size | Usage |
|-------|------|-------|
| `xs` | 12px | Captions, metadata, timestamps |
| `sm` | 14px | Secondary text, table cells |
| `base` | 16px | Body text, form inputs |
| `lg` | 18px | Emphasized body, card titles |
| `xl` | 20px | Section headers |
| `2xl` | 24px | Page section titles |
| `3xl` | 30px | Page titles |
| `4xl` | 36px | Hero text |
| `5xl` | 48px | Display text |
| `6xl` | 60px | Large display / splash |

## Spacing

4px base unit provides precise control at small scales while remaining easy to
calculate mentally:

- **Component padding:** `16px` (4 units) default, `24px` (6 units) for cards
- **Section gaps:** `32px` (8 units) between sections, `48px` (12 units) between
  major sections
- **Grid gutter:** `24px` (6 units) for content grids

## Animation

- **Default:** 200ms `ease-out` — the standard for state transitions (hover, focus, active)
- **Complex:** 300ms `ease-out` — for layout shifts, panel openings, multi-element transitions
- **Spring:** 500ms `cubic-bezier(0.175, 0.885, 0.32, 1.275)` — for delightful moments
  (success confirmations, achievement unlocks, celebratory UI)
- **Micro-interactions:** 150ms `ease-out` — button presses, checkbox toggles, icon swaps

**Rule:** Every interactive element must have a transition. Static state changes feel
broken in a production-grade interface.

## Agent-Generated UI Contract

When AVERI agents generate UI components, they MUST:

1. **Read this file** — DESIGN.md is injected into every UI-generation prompt context
2. **Use only defined tokens** — No ad-hoc colors, sizes, or spacing values
3. **Default to dark mode** — All generated components use `surface-base` as background
4. **Apply glassmorphism correctly** — Elevated only, max 2 layers, proper border
5. **Include transitions** — Every interactive element gets the appropriate animation
6. **Test against design-drift-auditor** — Post-generation validation

This is not a suggestion. This is a contract. Design consistency across autonomous
agent outputs is what separates a production system from a prototype.
