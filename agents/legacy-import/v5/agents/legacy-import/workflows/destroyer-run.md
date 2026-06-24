---
description: Run SPECTRE-D — The Destroyer scan. Generates destruction.md at the repo root listing dead packages, stale flows, and deletion candidates.
---
// turbo-all

## SPECTRE-D Destroyer Run

> Reads the full package graph and Genkit flow registry.
> Outputs `destruction.md` — a human-review destruction plan. No files are modified.

### Step 1 — Install dependencies
```powershell
pnpm install
```

### Step 2 — Run the code lens scan via ts-node (no build step required)
```powershell
node --import tsx packages/destroyer/src/index.ts --repo .
```

### Step 3 — If tsx not available, use the built version
```powershell
pnpm -F @cle/ouroboros build
pnpm -F @cle/destroyer build
node packages/destroyer/dist/index.js --repo .
```

### Step 4 — Review the output
Open `destruction.md` in the repo root and review deletion candidates with the team.

### Step 5 — After review, execute approved deletions
For each approved dead package:
```powershell
$pkg = "package-name"
Remove-Item -Recurse -Force "packages/$pkg"
# Then remove from pnpm-workspace.yaml manually
```

> **Constitutional Note:** SPECTRE-D never auto-deletes. Human approval of `destruction.md` is the required gate before any actual deletion occurs.
