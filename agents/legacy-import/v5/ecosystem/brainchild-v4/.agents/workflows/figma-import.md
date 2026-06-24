---
description: Pull a live Figma spec and implement it directly — zero handoff
---

# /figma-import — Figma Direct Implementation

Pull a Figma design spec, extract all tokens and components, implement directly. No screenshot copying, no manual interpretation.

## Steps

1. Ask the user for the Figma file URL or file key.
   Extract the `fileKey` from the URL: `figma.com/design/[fileKey]/...`

// turbo
2. **Pull Figma file data**:

Use `figma-dev-mode-mcp-server` `get_figma_data` with:

- `fileKey`: [extracted from URL]
- (optional) `nodeId`: specific frame or component if user specifies one

1. **Extract design system tokens** from the Figma data:
   - Color styles → CSS custom properties
   - Text styles → typography tokens
   - Effect styles → shadow/blur tokens
   - Grid/layout → spacing system

2. **Map components to implementation targets**:
   - Identify each major component in the file
   - Match to existing components in the codebase where possible
   - Flag net-new components that need to be built

3. **Download assets** — For any icons, images, or SVGs needed:

Use `figma-dev-mode-mcp-server` `download_figma_images` with the relevant `nodeId`s.
Save to `packages/[package]/src/assets/`.

1. **Implement** — Execute in SHIP mode order:
   - CSS token file first (design system)
   - Component by component, matching Figma spec exactly
   - Pixel-perfect is the standard — not "close enough"

2. Confirm implementation against Figma spec visually once built.
