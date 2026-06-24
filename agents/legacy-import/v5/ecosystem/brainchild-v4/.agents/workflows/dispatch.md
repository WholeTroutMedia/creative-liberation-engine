---
description: Boot protocol for Creative Liberation Engine — load dispatch board, see all active instances, claim your workstream
---

# /dispatch — Session Boot & Dispatch Board

// turbo-all

## Steps

1. Read the dispatch registry for both repos in parallel:

```powershell
Get-Content "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\.agents\dispatch\registry.md"
Get-Content "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\.agents\dispatch\registry.md"
```

1. Read live AVERI telemetry:

```powershell
Get-Content "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\CORE_FOUNDATION\system-status.json"
```

1. Display a compact dispatch board showing:
   - All active IDE instances (from registry)
   - Each instance's claimed workstream and branch
   - AVERI health summary (agents online, success rate, boot count)
   - Available unclaimed workstreams

2. Ask: "Which workstream are you claiming for this session?" Unless the user already stated intent — in that case skip directly to claiming it.
