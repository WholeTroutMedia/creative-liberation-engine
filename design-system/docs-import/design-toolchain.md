# Design toolchain — how everything connects (v5)

**Audience:** agents and operators maintaining the repo. **Not** a menu for end users.

### User-facing contract (read this first)

- The **human never has to name** Mobbin, Framer, Stitch, ingest scripts, or MCP servers. They say what they want in plain language; **you** pick the right levers silently.
- **Do not** open with “here are all the design tools” or ask which pipeline to use. That violates Creative Liberation Engine’s ease-of-use premise.
- Always translate intent into **workable sections for the human**: short titled blocks (e.g. *What we’re building*, *First shippable slice*, *What happens next*, *Open decisions — only if blocking ship*). Use everyday words.
- **ZERO DAY bias:** default every path toward **immediate, real shipping** — working surface, public-safe URLs, live data where the product needs it — not endless design-process rounds. Design exists to **unblock ship**, not to substitute for it.

## Pipeline placement (agents)

| Phase | Agent uses… | Human sees… |
|--------|----------------|-------------|
| **IDEATE** | This doc + `pattern-index.md` + targeted `tools/design-library/*/README.md` | Possibility frame, directions, **plain-language work sections** — not tool names |
| **DESIGN** | Anchors + Prompt Compiler + Stitch / image gen as needed | Renders + contract summary; reactions to **look/feel**, not toolchain |
| **SHIP** | `@cle/design-tokens`, `@cle/ui`, Storybook | The actual product moving toward Zero Day |

## Tool reference

| Tool / asset | Role | When **you** (agent) touch it | Location / command |
|--------------|------|------------------------------|---------------------|
| **Pattern index** | Canonical table of pattern families + how agents retrieve | Every UI IDEATE/DESIGN session | `docs/design-system/pattern-index.md` |
| **Design library** | Real-world layout references (Framify, Mobbin, Framer, motion, etc.) | Silently pick 2–3 anchors that match the surface — **never** ask the user to choose a folder | `tools/design-library/<source>/` |
| **Screenshot ingest** | Turn drops into pattern-index rows | After you save refs under `_screenshots` or named files in a source folder | `node scripts/design-ingest.mjs` (see script header for `--source`) |
| **Design tokens** | Color, type, space — single source for CSS | Before shipping UI; when harmonizing installer + console | `packages/design-tokens` → `dist/css/tokens.*.css` |
| **UI primitives** | Buttons, shells, Radix-backed pieces | Composition in apps | `packages/ui` |
| **Storybook** | Documented, interactive components | Validate primitives against a direction | `pnpm storybook` / `apps/storybook` |
| **Stitch (Google)** | MCP-driven UI generation from prompts | After IDEATE, alongside or inside DESIGN | `.agents/workflows/stitch-google-platform.md`, repo `POST /stitch` if configured |
| **Framer ingest** | Live code extraction | `/framer-ingest` / design-ingest skill | Per `.agents/skills/design-ingest/SKILL.md` |
| **Mobbin ingest** | Structured pattern YAML | `/mobbin-ingest` | Per design-ingest skill |
| **Vision ingest** | Screenshot → skeletal structure | Last resort, no catalog match | `/vision-ingest` |

## Minimum viable ATELIER pass (agents)

1. Open `pattern-index.md` — infer surface type from the user’s plain-language request.
2. Read **only** the READMEs/catalogs that fit; do not enumerate options to the user.
3. Keep **three** anchors in internal memory and in `DESIGN_CONTRACT.md` — cite them in **user-facing** copy only as plain “we’re aligning to [type of layout / pattern]” if helpful, not as file paths or vendor trivia.
4. Tie the Prompt Compiler to tokens and ship path; then **move toward PLAN/SHIP** — no extra design round trips unless the user pushes back on visuals.

## Extending the library

- Add images under `tools/design-library/_screenshots/<source>/` using the naming convention in `tools/design-library/_screenshots/README.md`.
- Run `node scripts/design-ingest.mjs` to append rows to `pattern-index.md`.
- For a new **source** folder: add `README.md` + optional `catalog.json`, then add one row to `pattern-index.md` so IDEATE can retrieve it by name.

---

*Keep this file accurate when you add a new design tool or MCP — one row in the table preserves ATELIER coherence.*
