---
name: design-ingest
description: Treats external design sources as structured data feeds rather than static inspiration screenshots. Integrates with Mobbin, Framer, and Vision-based extraction.
---

# Design Ingest Skill

This skill allows the Creative Liberation Engine to extract structural UI patterns and design tokens from external sources. Instead of relying on static AI generation, it implements a "design RAG" approach—grounding generation in real, high-quality reference patterns.

## Available Ingestion Vectors

### 1. Framer → Live Component Extraction (Phase 1)

Extracts living, parameterized React code from Framer using the `unframer` CLI and React Export plugin.

- **Trigger**: `/framer-ingest <url>`
- **Output**: TypeScript Next.js/Vite components stored in the design system.

### 2. Mobbin → Pattern Library Extraction

Pulls structured data from the Mobbin API.

- **Trigger**: `/mobbin-ingest <category>`
- **Output**: YAML "Helix Descriptors for UI" patterns with spacing, hierarchy, and component types.

### 3. Vision-Based Reverse Engineering (Escape Hatch)

Uses MCP Router to automate the browser, screenshot target apps, and use Gemini multimodal to generate skeletal component code.

- **Trigger**: `/vision-ingest <url>`
- **Output**: Reconstructed component trees and skeletal React code.

## How to use

When required to ingest design components or patterns:

1. Read `docs/design-system/design-toolchain.md` and `pattern-index.md` so new material lands in the same ATELIER mental model as IDEATE/DESIGN.
2. Determine the source (Framer, Mobbin, Vision URL, or screenshot drop under `tools/design-library/_screenshots/`).
3. Use the corresponding ingestion vector; for bulk screenshot naming → `node scripts/design-ingest.mjs`.
4. Apply `@cle/design-tokens` to the extracted structure.
5. Compose or register the final UI in the target app (often `apps/console/` or the feature package).

Grounding rule: **every ingest should eventually be retrievable** — either a new/updated row in `pattern-index.md` or an explicit anchor named in the next `DESIGN_CONTRACT.md`.

**Ease of use:** Ingest is an **operator/agent** action. Do not ask end users to choose between Framer, Mobbin, or vision ingest — run the vector that fits and keep the human focused on shipped UI.
