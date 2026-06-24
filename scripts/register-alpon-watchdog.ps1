<#
.SYNOPSIS
    register-alpon-watchdog.ps1 — Registers alpon-router-watchdog.ps1 as a Windows Scheduled Task
.DESCRIPTION
    Creates a Task Scheduler entry:
      AG-AlponRouter-Watchdog — runs at user logon indefinitely in a hidden window
.USAGE
    .\register-alpon-watchdog.ps1
#>

$ScriptPath = Join-Path $PSScriptRoot "alpon-router-watchdog.ps1"
$TaskUser   = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`""

# Run at logon indefinitely
$triggerLogon  = New-ScheduledTaskTrigger -AtLogOn -User $TaskUser
$settingsLogon = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit 0

Register-ScheduledTask `
    -TaskName   "AG-AlponRouter-Watchdog" `
    -TaskPath   "\CLEEngine\" `
    -Action     $action `
    -Trigger    $triggerLogon `
    -Settings   $settingsLogon `
    -RunLevel   Limited `
    -Force | Out-Null

Write-Host "[REGISTER] Task 'AG-AlponRouter-Watchdog' registered (runs indefinitely at logon)" -ForegroundColor Green
Write-Host "[REGISTER] View in Task Scheduler > Task Scheduler Library > CLEEngine" -ForegroundColor Gray

# Start it right now so we don't have to wait for next logon
Write-Host "[START] Starting the watchdog task immediately..." -ForegroundColor Cyan
Start-ScheduledTask -TaskPath "\CLEEngine\" -TaskName "AG-AlponRouter-Watchdog"
Write-Host "[START] Alpon Router Tunnel Watchdog is now active in the background." -ForegroundColor Green
