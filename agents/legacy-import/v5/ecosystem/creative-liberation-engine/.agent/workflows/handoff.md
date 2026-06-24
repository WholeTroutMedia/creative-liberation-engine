---
description: Handoff a workstream from this Creative Liberation Engine instance to another IDE window — commits current progress, releases ownership, and leaves a pickup note
---

# /handoff — Pass a Workstream to Another Instance

Use when you need to transfer active work from one IDE window to another without dropping context.

Usage: `/handoff [slug] [target-instance]` — e.g. `/handoff comet ANTIGRAVITY-2`

## Steps

// turbo-all

1. Commit your current progress with a WIP note:

```powershell
$slug = "[SLUG]"
$target = "[TARGET-INSTANCE]"
$ts = Get-Date -Format "yyyy-MM-ddTHH:mm"

git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" add -A
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" commit `
    -m "[HANDOFF][$slug] WIP commit for transfer to $target — $ts" --allow-empty
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" push --all
Write-Host "✅ WIP committed and pushed" -ForegroundColor Green
```

1. Write a pickup note for the receiving instance:

```powershell
$slug = "[SLUG]"
$target = "[TARGET-INSTANCE]"
$pickupNote = @"
## HANDOFF NOTE — $slug → $target
**From:** ANTIGRAVITY-[N]
**To:** $target
**Time:** $(Get-Date -Format 'yyyy-MM-ddTHH:mm')
**Branch:** $(git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" branch --show-current)

### What was in progress:
[DESCRIBE WHAT YOU WERE DOING]

### What's left:
[DESCRIBE WHAT NEEDS TO BE DONE NEXT]

### Key files touched:
[LIST KEY FILES]

### Watch out for:
[ANY GOTCHAS OR CONTEXT THE RECEIVING INSTANCE NEEDS]
"@

Set-Content "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\.agent\dispatch\handoff-$slug.md" $pickupNote
Write-Host "✅  Pickup note written to .agent/dispatch/handoff-$slug.md" -ForegroundColor Green
```

1. Update [registry.md](/WholeTroutMedia/creative-liberation-engine-v5/src/branch/main/.agent/dispatch/registry.md) — change your instance status to CLOSED, note the handoff:

```powershell
Write-Host "📝 Update .agent\dispatch\registry.md: set your row status to HANDED-OFF → $target" -ForegroundColor Yellow
```

1. Notify the receiving IDE window by updating [`project_dispatch.md`](/WholeTroutMedia/creative-liberation-engine-v5/src/branch/main/.agent/project_dispatch.md):

Open [`.agent/project_dispatch.md`](/WholeTroutMedia/creative-liberation-engine-v5/src/branch/main/.agent/project_dispatch.md) and update the Owner column for this slug to `[TARGET-INSTANCE] (pickup pending)`.

---

## Receiving a Handoff

When you’re the target instance, after running [`/dispatch`](/WholeTroutMedia/creative-liberation-engine-v5/src/branch/main/.agent/workflows/dispatch.md):

1. Look for `handoff-[slug].md` in [`.agent/dispatch/`](/WholeTroutMedia/creative-liberation-engine-v5/src/branch/main/.agent/dispatch)
2. Read the pickup note carefully
3. Run [`/claim [slug]`](/WholeTroutMedia/creative-liberation-engine-v5/src/branch/main/.agent/workflows/claim.md) to register yourself as the new owner
4. Continue from where the previous instance left off

---

## Quick Navigation

| Doc | Link |
|-----|------|
| Dispatch workflow | [`dispatch.md`](/WholeTroutMedia/creative-liberation-engine-v5/src/branch/main/.agent/workflows/dispatch.md) |
| Claim workflow | [`claim.md`](/WholeTroutMedia/creative-liberation-engine-v5/src/branch/main/.agent/workflows/claim.md) |
| Instance Registry | [`registry.md`](/WholeTroutMedia/creative-liberation-engine-v5/src/branch/main/.agent/dispatch/registry.md) |
| Project Board | [`project_dispatch.md`](/WholeTroutMedia/creative-liberation-engine-v5/src/branch/main/.agent/project_dispatch.md) |
| ANTIGRAVITY Protocol | [`ANTIGRAVITY.md`](/WholeTroutMedia/creative-liberation-engine-v5/src/branch/main/.agent/ANTIGRAVITY.md) |