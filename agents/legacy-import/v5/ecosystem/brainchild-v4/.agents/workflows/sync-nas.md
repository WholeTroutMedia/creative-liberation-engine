---
description: Sync local Creative Liberation Engine data to NAS (\\wholetroutmedia)
---

# NAS Sync Workflow

Mirror creative-liberation-engine repos from Google Drive to the NAS with ChromaDB health check.

## Steps

// turbo

1. Run the NAS sync script (dry run first to preview):

```powershell
powershell -ExecutionPolicy Bypass -File "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\scripts\sync-nas.ps1" -DryRun
```

1. If dry run looks good, run the actual sync:

```powershell
powershell -ExecutionPolicy Bypass -File "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\scripts\sync-nas.ps1"
```

1. To sync both v4 and v5:

```powershell
powershell -ExecutionPolicy Bypass -File "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\scripts\sync-nas.ps1" -All
```

## NAS Info

- **Host**: `\\wholetroutmedia` / `127.0.0.1`
- **Shares**: B: (Barnstorm), W: (The Vault), Z: (Docker)
- **ChromaDB**: `Z:\chromadb\data\` (Docker container, port 8000)
- **Mirror target**: `W:\Creative Liberation Engine\`
