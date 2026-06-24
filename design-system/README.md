# V6 Design System Lane

This lane carries imported design-system canon and design-library sources from historical versions, then normalizes them for V6 usage.

## Contents

- `docs-import/` — imported design-system docs from legacy versions
- `library-import/` — imported design-library source artifacts
- `design-library.manifest.json` — indexed source manifest used for validation and discovery

## Commands

- `npm run v6:import:design` — refresh imported design system and library manifest
- `npm test` — validate manifest schema conformance
