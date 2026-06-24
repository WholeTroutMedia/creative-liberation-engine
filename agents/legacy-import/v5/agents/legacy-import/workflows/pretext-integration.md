# Pretext Integration — ATELIER Typography Engine

> **Helix:** `helix-creative-direction` / `helix-stitch`  
> **Status:** APPROVED — Ready for integration  
> **Date:** 2026-03-29  
> **Author:** COMET + Artist  
> **Dependency:** `@chenglou/pretext` (MIT) — [github.com/chenglou/pretext](https://github.com/chenglou/pretext)

---

## Purpose

Integrate Pretext as the foundational text measurement and layout engine for ATELIER's Design Library. Pretext eliminates DOM reflow for text measurement by implementing pure-arithmetic layout after a one-time `prepare()` pass. This gives agents and components deterministic, programmatic control over typography — a capability CSS alone cannot provide.

## Why This Matters

### The Problem
Browsers compute text layout through synchronous reflow — one of the most expensive operations in the rendering pipeline. Every call to `getBoundingClientRect` or `offsetHeight` on text elements forces the browser to recalculate layout. This creates:
- Unpredictable virtualization (guessed heights for off-screen text)
- Layout shift (CLS penalties when text loads)
- No agent-verifiable typography (agents can't validate text fits without rendering)
- No editorial-grade layout (text can't flow around dynamic obstacles)

### The Solution
Pretext's `prepare()` → `layout()` pipeline moves text measurement into pure JavaScript arithmetic. After the initial measurement pass (~19ms for 500 texts), subsequent layout calls cost ~0.09ms per batch. This unlocks:
- **Exact height prediction** without DOM
- **Per-line layout control** for editorial canvases
- **Shrink-wrap / balanced text** via binary search over `walkLineRanges()`
- **Obstacle-aware text flow** via `layoutNextLine()` with variable widths
- **Multi-target rendering** — DOM, Canvas, SVG, WebGL, server-side

## Research Foundations

### Knuth-Plass Line Breaking (1981)
The seminal algorithm from TeX that treats text as a stream of boxes, glue, and penalties, using dynamic programming to minimize a "badness" function across entire paragraphs. Pretext builds on this lineage — its `walkLineRanges()` and `layoutNextLine()` APIs enable paragraph-level optimization that browsers' greedy first-fit algorithm cannot match.

### CSS `text-wrap: pretty` / `balance` (2025-2026)
WebKit shipped paragraph-level line breaking via `text-wrap: pretty` in 2025, and `text-wrap: balance` equalizes line lengths for headings. However, these are CSS-only, non-programmable, and limited (balance caps at 6-10 lines depending on browser). Pretext provides the same capabilities programmatically with no line-count limits and full agent accessibility.

### NYT Text Balancer Pattern
The New York Times pioneered a JS-based text balancer using binary search over container widths. Pretext's `walkLineRanges()` is a generalized, high-performance version of this pattern — it returns line widths and cursors without building strings, enabling speculative width testing at near-zero cost.

### DOM Reflow Avoidance
Layout reflow is the single most expensive browser operation. React's Virtual DOM, incremental rendering, and content-visibility all attempt to minimize it. Pretext sidesteps the problem entirely for text measurement — no DOM reads, no reflow triggers, pure computation.

### Design System Typography Automation
Modern design systems use semantic tokens for type scales, but validation remains manual. Pretext enables CI-time verification that text at given token sizes fits within component boundaries — automated typography QA that catches overflow before it ships.

## Integration Architecture

### Layer 1: `@atelier/text-measure` (Service)
```
Wrap Pretext as a shared service synchronized with DESIGN_CONTRACT.md tokens:
- Font map: --font-heading → '700 Space Grotesk', --font-body → '400 Inter' / '500 Inter'
- Exposes prepare/layout with token-aware defaults
- Caches prepared text per font+content combination
- Provides clearCache() lifecycle hook for font changes
```

### Layer 2: Component Integration (`helix-stitch`)
```
- VirtualList: Use layout() for exact row heights → zero-guess virtualization
- Card: Pre-compute text height for masonry/grid layouts
- Button/Label: Validate text fits at current token size, flag overflow
- HeroBlock: Balanced text via walkLineRanges() binary search
- PullQuote: Shrink-wrapped editorial typography
```

### Layer 3: Editorial Canvas (`helix-creative-direction`)
```
- Direction Deck renderer using layoutNextLine() for obstacle-aware flow
- Text flowing around mood board imagery, brand swatches, spatial elements
- Multi-column editorial layouts for creative briefs
- Canvas/WebGL rendering path for immersive direction presentations
```

### Layer 4: Typography Validation Agent
```
- CI/build-time agent that runs layout() against component specs
- Reads DESIGN_CONTRACT.md tokens (font, line-height, container width)
- Flags: text overflow, orphan lines, unbalanced headings
- Reports to VALIDATE phase of helix-creative-direction
- Feeds learning log: which token combinations produce overflow
```

## Token Mapping (from DESIGN_CONTRACT.md)

| DESIGN Token | Pretext Font String | Usage |
|---|---|---|
| `--font-heading` | `'700 1em Space Grotesk'` | Headlines, section titles |
| `--font-body` | `'400 1em Inter'` | Body text, descriptions |
| `--font-body-medium` | `'500 1em Inter'` | Labels, emphasis |

Note: Pretext font strings follow canvas `font` shorthand format. Size is parameterized at call time.

## API Quick Reference

### Use Case 1: Height prediction (no DOM)
```typescript
import { prepare, layout } from '@chenglou/pretext'
const prepared = prepare(text, '16px Inter')
const { height, lineCount } = layout(prepared, containerWidth, 20)
```

### Use Case 2: Editorial line-by-line layout
```typescript
import { prepareWithSegments, layoutNextLine } from '@chenglou/pretext'
const prepared = prepareWithSegments(text, '18px "Space Grotesk"')
let cursor = { segmentIndex: 0, graphemeIndex: 0 }
while (true) {
  const width = y < obstacle.bottom ? colWidth - obstacle.width : colWidth
  const line = layoutNextLine(prepared, cursor, width)
  if (!line) break
  ctx.fillText(line.text, 0, y)
  cursor = line.end
  y += lineHeight
}
```

### Use Case 3: Balanced text / shrink-wrap
```typescript
import { prepareWithSegments, walkLineRanges, layoutWithLines } from '@chenglou/pretext'
const prepared = prepareWithSegments(heading, '700 32px "Space Grotesk"')
// Binary search for tightest width that keeps lineCount <= target
let lo = containerWidth * 0.5, hi = containerWidth
while (hi - lo > 1) {
  const mid = (lo + hi) / 2
  let lines = 0
  walkLineRanges(prepared, mid, () => lines++)
  if (lines <= targetLines) hi = mid; else lo = mid
}
const { lines } = layoutWithLines(prepared, hi, lineHeight)
```

## Cross-Helix Impact

| Helix | Impact | Priority |
|---|---|---|
| `helix-stitch` | VirtualList, Card, Button overflow detection | P0 |
| `helix-creative-direction` | Editorial canvas, direction deck renderer | P0 |
| `helix-photo` | Caption layout, gallery text overlays | P1 |
| `helix-content` | Reading time estimation via line count | P2 |
| `helix-marketing` | Hero text balancing, CTA overflow checks | P1 |
| `helix-engineering` | Build-time typography validation CI step | P0 |

## Caveats

- `system-ui` font is unsafe for accuracy on macOS — always use named fonts (we already do: Space Grotesk, Inter)
- Currently targets `white-space: normal` and `overflow-wrap: break-word` defaults
- For textarea-like content, pass `{ whiteSpace: 'pre-wrap' }` to preserve whitespace
- Pretext does not handle `word-break: break-all` or `line-break: strict` yet

## Validation Checklist

- [ ] `@chenglou/pretext` added to `packages/atelier/package.json`
- [ ] `@atelier/text-measure` service wrapper created
- [ ] Token map synced with DESIGN_CONTRACT.md
- [ ] VirtualList height prediction integrated in helix-stitch
- [ ] Typography validation agent spec created
- [ ] Editorial canvas prototype in helix-creative-direction
- [ ] CI step wired for build-time overflow detection

## Version

| Field | Value |
|---|---|
| Version | 1.0.0 |
| Created | 2026-03-29 |
| Author | COMET + Artist |
| Parent | helix-creative-direction.md, helix-stitch.md |