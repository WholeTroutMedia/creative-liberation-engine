---
description: Boot protocol for Creative Liberation Engine — load dispatch board, see all active instances, claim your workstream
---

# /dispatch — Creative Liberation Engine Boot Protocol

Run this at the start of every session to orient yourself within the multi-instance system.

// turbo-all

1. Read the [ANTIGRAVITY identity manifest](../ANTIGRAVITY.md):

```powershell
Get-Content "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\.agent\ANTIGRAVITY.md"
```

1. Read the live [dispatch board](../project_dispatch.md) (what’s in flight across all workstreams):

```powershell
Get-Content "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\.agent\project_dispatch.md"
```

1. Read the [instance registry](../dispatch/registry.md) (who else is active right now):

```powershell
Get-Content "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\.agent\dispatch\registry.md"
```

1. Check git status (creative-liberation-engine-v5 only):

```powershell
Write-Host "=== creative-liberation-engine-v5 ===" -ForegroundColor Cyan
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" status --short
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" log --oneline -3
```

1. After reading the above, identify:
    - Which workstream you’ll own this session (from [`project_dispatch.md`](../project_dispatch.md))
    - Your instance ID (next available ANTIGRAVITY-N from [registry](../dispatch/registry.md))
    - Whether you need a feature branch (`feat/[slug]`) or are on `main`

    Then run [`/claim [slug]`](./claim.md) to register your ownership.

---

## Quick Navigation

| Doc | Link |
|-----|------|
| Claim workflow | [`claim.md`](./claim.md) |
| Handoff workflow | [`handoff.md`](./handoff.md) |
| Instance Registry | [`registry.md`](../dispatch/registry.md) |
| Project Board | [`project_dispatch.md`](../project_dispatch.md) |
| ANTIGRAVITY Protocol | [`ANTIGRAVITY.md`](../ANTIGRAVITY.md) |