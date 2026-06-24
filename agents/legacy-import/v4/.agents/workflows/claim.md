---
description: Claim a workstream for this Antigravity instance — registers ownership in registry.md and optionally creates a feature branch
---

# /claim — Claim a Workstream

Claim a workstream for this IDE session. This registers ownership in the dispatch registry and prevents conflicts with other active Antigravity instances.

## Steps

1. Ask the user which workstream they want to claim (if not already provided).
   Available workstreams are listed in `.agents/dispatch/registry.md`.

// turbo
2. Check both registries to ensure the workstream is not already claimed by another instance:

```powershell
Get-Content "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\.agents\dispatch\registry.md"
Get-Content "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\.agents\dispatch\registry.md"
```

1. If the workstream is free, update the appropriate registry.md to add this instance as the owner. Use this row format:

```
| Window-[N] | Antigravity | [workstream-name] | [branch] | active | [current timestamp] |
```

1. If a feature branch is needed, create it:

```powershell
git -C "[repo-root]" checkout -b "feature/[workstream-name]"
```

1. Confirm the claim to the user: "Claimed **[workstream]**. You own this lane. Let's build."
