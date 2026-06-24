---
description: Synchronize Context Across IDE Sessions (Boot and Shutdown Protocol)
---

# /cross_session_sync — VERA Cross-Session Sync Protocol

Finalize the current session log, commit all memory entries to `cle-memory`, push to remote(s), and mirror to NAS. Run at the end of every working session.

## Steps

// turbo-all

1. Finalize the VERA session log and push cle-memory to remotes:

```powershell
cd "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4"
python KEEPER/session_logger.py --finalize
```

1. Commit and push all outstanding changes in creative-liberation-engine-v4:

```powershell
cd "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4"
git add -A
git commit -m "[VERA][shutdown] cross-session sync — $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')" --allow-empty
git push --all
```

1. Commit and push all outstanding changes in creative-liberation-engine-v5:

```powershell
cd "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5"
git add -A
git commit -m "[VERA][shutdown] cross-session sync — $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')" --allow-empty
git push --all
```

1. NAS Robocopy mirror (sync all repos to W:\ physical backup):

```powershell
cd "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4"
.\scripts\sync-nas.ps1
```

## What Gets Synced

| Target | What | How |
|:---|:---|:---|
| `cle-memory` remote | Session, agent, pattern, event logs | `git push --all` (step 1) |
| Forgejo / GitHub | All creative-liberation-engine-v4 + v5 code | `git push --all` (steps 2-3) |
| NAS `W:\Creative Liberation Engine\` | Full local mirror | Robocopy `/MIR` (step 4) |

## Boot Protocol

On session start, AVERI auto-logs a boot event via `SessionLogger` (v4) or `MemoryBus.logBoot()` (v5) — **no manual action required**. This workflow is for session end / explicit sync only.
