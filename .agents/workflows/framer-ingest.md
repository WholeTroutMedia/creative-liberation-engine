---
description: Extract living, parameterized React code from Framer
---

# /framer-ingest <url>

Uses the unframer CLI to pull Framer components into the apps/console design system, extracting structural patterns and design tokens in the process.

## Steps

// turbo

1. Output status:
   > Ã°Å¸Å¡â‚¬ **Ingesting Framer Component** Ã¢â‚¬â€ Fetching from `<url>`

// turbo
2. Run the ingest script:

   ```powershell
   npx tsx "Y:\\creative-liberation-engine\packages\design-agent\src\ingestion\framer.ts" "<url>" "Y:\\creative-liberation-engine\apps\console\src\components\framer"
   ```

1. Verify the output directory has the `.tsx` components and report success to the user:
   > Ã¢Å“â€¦ **Success** Ã¢â‚¬â€ The Framer components have been downloaded to `apps/console/src/components/framer` and registered in the IE component registry.

