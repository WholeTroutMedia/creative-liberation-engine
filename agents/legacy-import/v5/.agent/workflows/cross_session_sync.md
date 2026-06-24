---
description: Synchronize Context Across IDE Sessions (Boot and Shutdown Protocol)
---

# /cross_session_sync — LOGD Cross-Session Sync Protocol

Finalize the session, release dispatch ownership, commit all changes, push all remotes, sync to NAS.

## Steps

// turbo-all

1. Release this instance's workstream claim in the dispatch registry:

```powershell
$registry = "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\.agent\dispatch\registry.md"
$ts = Get-Date -Format "yyyy-MM-ddTHH:mm"
Add-Content $registry "`n> [SHUTDOWN] Instance released at $ts — workstream returned to queue"
Write-Host "✅ Dispatch registry updated — workstream released" -ForegroundColor Green
```

1. Flush MemoryBus and push cle-memory:

```powershell
cd "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5"
npx tsx packages/memory/src/bus.ts --finalize 2>$null
git -C "ecosystem\cle-memory" add -A
git -C "ecosystem\cle-memory" commit -m "[LOGD][shutdown] cross-session sync — $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')" --allow-empty
git -C "ecosystem\cle-memory" push --all
Write-Host "✅ cle-memory synced" -ForegroundColor Green
```

1. Commit and push creative-liberation-engine-v5 (includes .agent/ dispatch state):

```powershell
cd "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5"
git add -A
git commit -m "[LOGD][shutdown] cross-session sync — $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')" --allow-empty
git push --all
Write-Host "✅ creative-liberation-engine-v5 pushed" -ForegroundColor Green
```

1. Optional: operator-specific NAS or backup scripts — run from **creative-liberation-engine-v5** if you maintain them there.
