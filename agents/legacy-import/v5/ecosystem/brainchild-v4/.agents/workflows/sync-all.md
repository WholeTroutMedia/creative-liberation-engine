---
description: Push all uncommitted changes across every active repo — the nuclear sync button
---

# /sync-all — Nuclear Sync

// turbo-all

Push all uncommitted changes across both repos in one shot.

## Steps

1. Stage, commit, and push creative-liberation-engine-v4:

```powershell
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4" add .
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4" commit -m "chore(sync): AVERI sync-all $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4" push
```

1. Stage, commit, and push creative-liberation-engine-v5:

```powershell
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" add .
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" commit -m "chore(sync): AVERI sync-all $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" push
```

1. Report the result: show the commit SHAs and confirm both repos are pushed.
