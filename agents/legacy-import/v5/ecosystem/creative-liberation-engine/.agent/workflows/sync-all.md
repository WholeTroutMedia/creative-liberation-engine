---
description: Push all uncommitted changes across every active repo — the nuclear sync button
---

# /sync-all — Full Ecosystem Push

Use when you want to push everything, across all repos, in one shot. Safe to run at any time.

// turbo-all

1. Sync the cle-memory submodule first:

```powershell
$ts = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\ecosystem\cle-memory" add -A
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\ecosystem\cle-memory" `
  commit -m "[sync] auto-push — $ts" --allow-empty
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\ecosystem\cle-memory" push --all
Write-Host "✅ cle-memory synced" -ForegroundColor Green
```

1. Commit and push creative-liberation-engine-v5 (including submodule pointer update):

```powershell
$ts = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" add -A
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" `
  commit -m "[sync] auto-push — $ts" --allow-empty
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" push --all
Write-Host "✅ creative-liberation-engine-v5 synced" -ForegroundColor Green
```

1. Commit and push creative-liberation-engine-v4:

```powershell
$ts = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4" add -A
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4" `
  commit -m "[sync] auto-push — $ts" --allow-empty
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4" push --all
Write-Host "✅ creative-liberation-engine-v4 synced" -ForegroundColor Green
```

1. Verify all remotes are clean:

```powershell
Write-Host "`n=== SYNC STATUS ===" -ForegroundColor Cyan
Write-Host "creative-liberation-engine-v5:" -ForegroundColor Yellow
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" log --oneline -2

Write-Host "`ncreative-liberation-engine-v4:" -ForegroundColor Yellow
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4" log --oneline -2

Write-Host "`n✅ Sync complete" -ForegroundColor Green
```
