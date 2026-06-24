# Workflow — Google Stitch (official) + Creative Liberation Engine

**Purpose:** Use Google’s Stitch as a first-class design surface alongside in-repo Genkit and design tokens.

## Official Stitch

- Product: [stitch.withgoogle.com](https://stitch.withgoogle.com)
- MCP (Cursor / IDE): [Stitch MCP setup](https://stitch.withgoogle.com/docs/mcp/setup)
- Typical pattern: `npx -y stitch-mcp` with Google Cloud / Stitch project auth per Google’s docs.

## Inside this repo

| Path | Role |
|------|------|
| `POST /stitch` on Genkit | `stitchDesign` flow — Stitch-compatible UI generation without leaving the engine |
| `packages/mcp-router` | **Stitch MCP (Google Stitch)** — routes design tasks to official MCP |
| `packages/genkit/src/flows/stitch-design.ts` | Flow implementation + links to official Stitch |
| `@cle/design-tokens` + Storybook | Production UI should consume tokens; installer wizard links `tokens.dark.css` after `pnpm --filter @cle/design-tokens build` |

## Operator notes

- `/design <prompt>` in AGENTS may use `--stitch` for Stitch MCP — prefer that when the user wants Google’s Stitch canvas + exports.
- For sovereign / offline UI experiments, use `POST /stitch` locally instead.
- After Stitch output, hand off to PLAN → SHIP → VALIDATE; do not treat a prototype as production without validation.
