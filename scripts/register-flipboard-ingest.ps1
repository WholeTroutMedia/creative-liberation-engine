<#
.SYNOPSIS
    register-flipboard-ingest.ps1 — Registers flipboard_ingest.py as a Windows Scheduled Task
.DESCRIPTION
    Creates a Task Scheduler entry:
      - AG-Flipboard-Ingest — runs daily at 06:00 AM (continuous sync)
    Run once as administrator (or approve UAC prompt).
.USAGE
    .\register-flipboard-ingest.ps1
#>

$PackagePath = "y:\creative-liberation-engine\services\packages\flipboard-sentinel"
$NodeExe = "npm.cmd"
$TaskUser   = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction `
    -Execute $NodeExe `
    -Argument "run poll" `
    -WorkingDirectory $PackagePath

# ── Task: Run daily at 6 AM ─────────────────────────────────────────────
$triggerTimer = New-ScheduledTaskTrigger -Daily -At 6:00AM
$settingsTimer = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -StartWhenAvailable

Register-ScheduledTask `
    -TaskName   "AG-Flipboard-Ingest" `
    -TaskPath   "\CLEEngine\" `
    -Action     $action `
    -Trigger    $triggerTimer `
    -Settings   $settingsTimer `
    -RunLevel   Limited `
    -Force | Out-Null

Write-Host "[REGISTER] Task 'AG-Flipboard-Ingest' registered (fires daily at 06:00)" -ForegroundColor Green
Write-Host "[REGISTER] Task registered under \CLEEngine\ path." -ForegroundColor Cyan
Write-Host "[REGISTER] View in Task Scheduler > Task Scheduler Library > CLEEngine" -ForegroundColor Gray
