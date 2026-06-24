---
description: Claim a workstream for this Creative Liberation Engine instance — registers ownership in registry.md and optionally creates a feature branch
---

# /claim — Claim a Workstream

Run after [`/dispatch`](./dispatch.md) to register this instance as the owner of a specific workstream.

Usage: `/claim [slug]` — e.g. `/claim v5-console`, `/claim comet`, `/claim ci`

## Steps

// turbo-all

1. Check the slug is not already claimed by another instance:

```powershell
$slug = "[SLUG]"  # Replace with actual slug
$registry = Get-Content "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\.agent\dispatch\registry.md" -Raw
if ($registry -match $slug) {
    Write-Host "⚠️  $slug appears to already be claimed. Check registry.md for the owning instance." -ForegroundColor Yellow
} else {
    Write-Host "✅ $slug is available. Proceeding to claim." -ForegroundColor Green
}
```

1. Add your instance entry to the [registry](../dispatch/registry.md). Edit the file to add a row:

```powershell
$slug = "[SLUG]"
$instance = "ANTIGRAVITY-[N]"     # Replace N with your instance number
$context = "[BRIEF CONTEXT]"       # e.g. "v5-console pages, index.css open"
$ts = Get-Date -Format "yyyy-MM-ddTHH:mm"

# Append instance record to dispatch log
Add-Content "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\.agent\dispatch\registry.md" `
    "`n### $instance | $slug | ACTIVE | $ts`n- Context: $context"

Write-Host "✅  Registered $instance for $slug at $ts" -ForegroundColor Green
```

1. (Optional — for multi-day features) Create and switch to a feature branch:

```powershell
$slug = "[SLUG]"
$branch = "feat/$slug"
git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" checkout -b $branch 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Created branch $branch" -ForegroundColor Green
} else {
    git -C "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5" checkout $branch
    Write-Host "✅ Switched to existing branch $branch" -ForegroundColor Green
}
```

1. Update [`project_dispatch.md`](../project_dispatch.md) to mark the workstream as claimed:

Open [`.agent/project_dispatch.md`](../project_dispatch.md) and update the Owner column for your slug row to your instance ID (e.g. `ANTIGRAVITY-1`).

---

## Quick Navigation

| Doc | Link |
|-----|------|
| Dispatch workflow | [`dispatch.md`](./dispatch.md) |
| Handoff workflow | [`handoff.md`](./handoff.md) |
| Instance Registry | [`registry.md`](../dispatch/registry.md) |
| Project Board | [`project_dispatch.md`](../project_dispatch.md) |
| ANTIGRAVITY Protocol | [`ANTIGRAVITY.md`](../ANTIGRAVITY.md) |