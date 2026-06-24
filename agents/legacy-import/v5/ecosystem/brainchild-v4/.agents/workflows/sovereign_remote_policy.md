---
description: Sovereign Infrastructure Policy â€” Gitea-Only Remote Policy
---

# Sovereign Remote Policy

// turbo-all

The Creative Liberation Engine operates under a Sovereign-First infrastructure policy. All code is pushed to the self-hosted Forgejo instance first.

## Steps

1. Verify the current git remote configuration:

```powershell
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4" remote -v
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" remote -v
```

1. Ensure `origin` points to Forgejo (not GitHub):

```powershell
# If origin points to GitHub, update it:
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4" remote set-url origin http://127.0.0.1:3000/WholeTroutMedia/creative-liberation-engine-v4.git
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" remote set-url origin http://127.0.0.1:3000/WholeTroutMedia/creative-liberation-engine-v5.git
```

1. Verify Forgejo is reachable:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 5 | Select-Object StatusCode
```

1. If Forgejo is unreachable (NAS offline), fall back to GitHub:

```powershell
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4" remote set-url origin https://github.com/WholeTroutMedia/creative-liberation-engine-v4.git
```

1. Report which remote is active and confirm policy compliance.
