# ATELIER / UI pattern index (v5)

**Canonical source for DESIGN and IDEATE retrieval.**  
Previous references to `ecosystem/creative-liberation-engine-v4/ATELIER/` are retired — **creative-liberation-engine-v5 only.**

**Full toolchain map (agents only — users never pick tools by name):** [`design-toolchain.md`](./design-toolchain.md)

## How to use

1. **Structured catalogs:** `tools/design-library/<source>/` (Framify, Mobbin, Framer, motion, etc.) — `catalog.json` + README per source.
2. **Screenshots for ingest:** add PNG/JPEG under `tools/design-library/_screenshots/<source>/` using the naming convention in `scripts/design-ingest.mjs`. Ingest appends rows below.
3. **Shipped UI primitives:** `packages/ui` + Storybook (`pnpm storybook` / `apps/storybook`).
4. **Tokens:** `packages/design-tokens` (Style Dictionary outputs in `dist/css/`).
5. **Stitch / MCP:** see `.agents/workflows/stitch-google-platform.md` and `AGENTS.md` for the `/design` row when generating from prompts.

## Pattern table (seed)

| Pattern family | Source | Platform | Notes |
|----------------|--------|----------|-------|
| Design tokens (dark/light) | CLE | Web | `packages/design-tokens` → `dist/css/` |
| Installer path-picker | CLE | Web | `tools/cle-installer/ideate/direction-3-choose-path.html` (mock) |
| Component library | Radix + tokens | Web | `@cle/ui` |
| Section / landing references | Framify | Web | `tools/design-library/framify/README.md` |
| Mobile flows | Mobbin | iOS/Android | `tools/design-library/mobbin/README.md` |
| Site / marketing components | Framer | Web | `tools/design-library/framer/README.md` |
| Motion / Lottie | Community libs | Web | `tools/design-library/lottiefiles/README.md`, `motion/README.md` |

*(Agents: pick the 3 closest rows + open the matching `tools/design-library/<source>/README.md` for concrete anchors.)*
