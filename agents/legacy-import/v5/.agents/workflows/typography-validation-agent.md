# Typography Validation Agent

> **Parent:** [pretext-integration.md](./pretext-integration.md)  
> **Helix:** `helix-engineering` (CI) / `helix-creative-direction` (VALIDATE)  
> **Status:** SPEC  
> **Date:** 2026-03-29  
> **Author:** COMET + Artist

---

## Purpose

Automated typography quality assurance agent that uses Pretext to validate text-bearing components at build time. Catches overflow, orphan lines, and unbalanced headings before they reach production — without requiring a browser or DOM rendering.

## Trigger Conditions

- CI pipeline on PR / merge to `main`
- DESIGN_CONTRACT.md token changes
- Component spec updates in `helix-stitch`
- Manual invocation via `@comet validate typography`

## Agent Behavior

### INPUTS
```
1. DESIGN_CONTRACT.md → font tokens, container widths, density mode
2. Component registry → text-bearing components with max-width constraints
3. Content samples → representative text strings per component type
4. Breakpoint definitions → viewport widths to test against
```

### PROCESS
```
For each (component, content, breakpoint) tuple:
  1. Resolve font token → Pretext font string
     e.g. --font-heading at 32px → '700 32px "Space Grotesk"'
  2. prepare(content, fontString)
  3. layout(prepared, componentMaxWidth, componentLineHeight)
  4. Check assertions:
     a. height <= componentMaxHeight (overflow detection)
     b. lineCount <= maxAllowedLines (truncation risk)
     c. For headings: run walkLineRanges() and check line length variance
        (flag if longest line > 1.5x shortest → unbalanced)
     d. For body: check last line length > 25% of container width
        (flag orphan lines)
  5. Collect results per component
```

### OUTPUTS
```
1. PASS/WARN/FAIL status per component
2. Overflow report: which components overflow at which breakpoints
3. Balance report: heading balance scores
4. Orphan report: body text orphan line detections
5. Suggested fixes: recommend font size reduction, container width increase,
   or text-wrap: balance annotation
```

## Assertion Definitions

| Assertion | Severity | Condition |
|---|---|---|
| `overflow` | FAIL | `height > componentMaxHeight` |
| `line-overflow` | FAIL | `lineCount > maxAllowedLines` |
| `unbalanced-heading` | WARN | Longest line > 1.5x shortest line length |
| `orphan-line` | WARN | Last line width < 25% of container width |
| `single-word-wrap` | WARN | Any line contains only 1 word (for buttons/labels) |
| `density-violation` | FAIL | Component exceeds `--density: compact` viewport fit |

## Component Registry Format

```yaml
components:
  - name: HeroHeadline
    font_token: --font-heading
    font_size: 48px
    line_height: 56
    max_width: [360, 768, 1200]  # mobile, tablet, desktop
    max_height: [168, 168, 112]  # 3 lines mobile, 3 tablet, 2 desktop
    max_lines: [3, 3, 2]
    balance: true

  - name: CardTitle
    font_token: --font-heading
    font_size: 20px
    line_height: 28
    max_width: [280, 320, 360]
    max_lines: [2, 2, 2]
    balance: true

  - name: ButtonLabel
    font_token: --font-body-medium
    font_size: 14px
    line_height: 20
    max_width: [120, 160, 200]
    max_lines: [1, 1, 1]

  - name: BodyParagraph
    font_token: --font-body
    font_size: 16px
    line_height: 24
    max_width: [340, 640, 720]
    max_lines: null  # no limit
    orphan_check: true

  - name: DataGridCell
    font_token: --font-body
    font_size: 13px
    line_height: 18
    max_width: [80, 120, 160]
    max_lines: [1, 1, 2]
```

## Integration Points

### CI Pipeline
```
1. Run after build, before deploy
2. Read component registry from packages/atelier/typography-registry.yaml
3. Execute validation against content samples
4. Output report to design-output/typography-validation/
5. Block deploy on FAIL, warn on WARN
```

### helix-creative-direction VALIDATE Phase
```
Feed results into the VALIDATE checks:
- "Executability: Can agents and tools actually produce work at this quality bar?"
- Typography validation report answers this definitively
- Learning log: track which token combinations are fragile
```

### helix-stitch Component Development
```
During component development:
- Run validation against new/modified components
- Auto-suggest max-width and font-size adjustments
- Generate visual diff of text layout changes
```

## Report Format

```markdown
## Typography Validation Report
**Run:** 2026-03-29T08:00:00Z  
**Components tested:** 24  
**Content samples:** 156  
**Breakpoints:** 3 (360, 768, 1200)

### Summary
| Status | Count |
|--------|-------|
| PASS   | 142   |
| WARN   | 11    |
| FAIL   | 3     |

### Failures
- HeroHeadline @ 360px: overflow (height 224px > max 168px)
  Content: "Creative Liberation Engine: The Creative Studio on the Blockchain"
  Suggestion: reduce font-size to 40px or increase max-lines to 4

### Warnings
- CardTitle @ 280px: unbalanced (line ratio 2.3x)
  Suggestion: apply text-wrap: balance or use walkLineRanges() shrink-wrap
```

## Version

| Field | Value |
|---|---|
| Version | 1.0.0 |
| Created | 2026-03-29 |
| Author | COMET + Artist |
| Parent | pretext-integration.md |