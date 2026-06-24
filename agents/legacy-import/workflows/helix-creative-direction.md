# Helix: Creative Direction

> Parent: [IPSV-SPINE.md](./IPSV-SPINE.md)
> Helix ID: `helix-creative-direction`

This helix governs high-level creative vision work — the kind that sets direction for other helices rather than producing a single artifact. Think brand evolution, visual language definition, experience design strategy, and cross-project creative coherence.

---

## IDEATE

### Outputs
- Vision statement or creative thesis
- Mood boards, reference collections, cultural touchpoints
- Landscape analysis: what exists, what's tired, what's emerging
- Audience empathy map: how do they feel, what do they need to feel
- Provocations: 2–3 bold directions that stretch beyond safe

### Questions to Resolve
- What is the emotional outcome we're designing for?
- What cultural moment or tension are we responding to?
- What does the brand/project need to feel like in 6 months?
- What are the non-negotiable brand principles?
- Where is the creative ceiling right now, and how do we raise it?

---

## PLAN

### Outputs
- Creative brief: vision, principles, visual language, tone
- Direction deck: key visuals, typography, color story, spatial feel
- System impact map: which DESIGN.md files need updating
- Helix spawn list: what downstream helices does this direction affect?
- Approval gate: who signs off before cascading to production helices

### Constraints
- Creative direction is upstream of everything — don't rush it
- Must produce artifacts other agents can reference (not just vibes)
- DESIGN.md and CONSTITUTION.md are the enforcement layer
- Always document the WHY, not just the WHAT

---

## SHIP

### Phases
1. **Direction synthesis** — Distill IDEATE outputs into a coherent creative direction
2. **Artifact creation** — Direction deck, updated DESIGN.md, brand guidelines
3. **Cascade** — Brief downstream helices (stitch, photo, content, marketing)
4. **Alignment check** — Review first outputs from downstream helices against direction

### Outputs
- Creative direction document (the source of truth)
- Updated DESIGN.md tokens and guidelines
- Direction deck for stakeholder alignment
- Downstream briefs issued to relevant helices

---

## VALIDATE

### Checks
- **Coherence:** Do all downstream outputs feel like they come from the same vision?
- **Distinctiveness:** Does this direction differentiate from competitors/peers?
- **Durability:** Will this direction age well or is it trend-dependent?
- **Executability:** Can agents and tools actually produce work at this quality bar?
- **User resonance:** Does the target audience respond to this direction?

### Learning Log
- Which provocations from IDEATE proved most generative?
- Where did downstream helices struggle to execute the direction?
- What should be codified as permanent brand principles?
- What creative debts remain for the next direction cycle?

---

## Cross-Helix Authority

This helix has **upstream authority** over:
- `helix-stitch` (visual system, UI direction)
- `helix-photo` (visual language, mood)
- `helix-content` (voice, tone)
- `helix-marketing` (brand messaging)

It does NOT override `helix-engineering` on technical decisions, but provides UX direction.

---

## Typography Engine: Pretext Integration

This helix now leverages `@chenglou/pretext` for editorial-grade text layout capabilities. See [pretext-integration.md](./pretext-integration.md) for the full architecture spec.

### SHIP Additions: Editorial Canvas
- **Direction Deck renderer:** Use `layoutNextLine()` for obstacle-aware text flow around mood board imagery, brand swatches, and spatial elements
- **Multi-column editorial layouts** for creative briefs rendered in-browser
- **Canvas/WebGL rendering path** for immersive direction presentations and spatial computing
- **Balanced typography:** `walkLineRanges()` binary search for shrink-wrapped, typographically balanced headings and pull quotes

### VALIDATE Additions: Typography QA
- **Executability check:** Pretext validates that agents can produce work at the specified quality bar by running `layout()` against component specs
- **Typography validation agent** runs at CI time — see [typography-validation-agent.md](./typography-validation-agent.md)
- **Learning log feed:** Track which font/size/width token combinations produce overflow or orphan lines across direction cycles

### Research Context
- Builds on Knuth-Plass line-breaking lineage (TeX, 1981) for paragraph-level optimization
- Extends CSS `text-wrap: pretty/balance` (WebKit 2025) into fully programmable, agent-accessible territory
- Follows NYT text balancer pattern generalized through `walkLineRanges()` speculative width testing


## Version

| Field | Value |
|---|---|
| Version | 1.0.0 |
| Created | 2026-03-27 |
| Author | COMET + Artist |
| Parent | IPSV-SPINE.md |