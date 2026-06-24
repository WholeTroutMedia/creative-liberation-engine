---
description: Full Creative Liberation Engine system status — AVERI health, dispatch board, git status, and active services in one shot
---

# /status — Full System Status

// turbo-all

Pull live status from every layer of the Creative Liberation Engine and display a unified dashboard.

## Steps

1. Read AVERI telemetry and agent roster:

```powershell
Get-Content "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\CORE_FOUNDATION\system-status.json"
Get-Content "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\CORE_FOUNDATION\agents\.agent-status.json"
```

1. Read both dispatch registries:

```powershell
Get-Content "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\.agents\dispatch\registry.md"
Get-Content "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\.agents\dispatch\registry.md"
```

1. Get git status for both repos:

```powershell
git -C "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4" status --short
git -C "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4" log --oneline -5
git -C "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" status --short
git -C "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" log --oneline -5
```

1. Display a single unified status panel:

```
╔══════════════════════════════════════════════════════╗
║  CLE ENGINE — SYSTEM STATUS                    ║
╠══════════════════════════════════════════════════════╣
║  AVERI: ATHENA ● VERA ● IRIS (all green)            ║
║  Health: [status] | Success: [%] | Boot #[n]        ║
╠══════════════════════════════════════════════════════╣
║  DISPATCH BOARD                                      ║
║  [table of active instances and workstreams]         ║
╠══════════════════════════════════════════════════════╣
║  GIT STATUS                                          ║
║  v4: [branch] — [n] files changed | last: [sha msg] ║
║  v5: [branch] — [n] files changed | last: [sha msg] ║
╚══════════════════════════════════════════════════════╝
```
