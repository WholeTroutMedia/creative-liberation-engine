<#
.SYNOPSIS
    register-ollama-watchdog.ps1 â€” Registers ollama-priority-watchdog.ps1 as a Windows Scheduled Task
.DESCRIPTION
    Creates a Task Scheduler entry:
      AG-Ollama-Watchdog â€” runs at user logon indefinitely in a hidden window
.USAGE
    .\register-ollama-watchdog.ps1
#>

$ScriptPath = Join-Path $PSScriptRoot "ollama-priority-watchdog.ps1"
$TaskUser   = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`""

# â”€â”€ Task 1: Run at logon indefinitely â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
$triggerLogon  = New-ScheduledTaskTrigger -AtLogOn -User $TaskUser
# Setting ExecutionTimeLimit to 0 allows it to run indefinitely
$settingsLogon = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit 0

Register-ScheduledTask `
    -TaskName   "AG-Ollama-Watchdog" `
    -TaskPath   "\CLEEngine\" `
    -Action     $action `
    -Trigger    $triggerLogon `
    -Settings   $settingsLogon `
    -RunLevel   Limited `
    -Force | Out-Null

Write-Host "[REGISTER] Task 'AG-Ollama-Watchdog' registered (runs indefinitely at logon)" -ForegroundColor Green
Write-Host "[REGISTER] View in Task Scheduler > Task Scheduler Library > CLEEngine" -ForegroundColor Gray

# Start it right now so we don't have to wait for next logon
Write-Host "[START] Starting the watchdog task immediately..." -ForegroundColor Cyan
Start-ScheduledTask -TaskPath "\CLEEngine\" -TaskName "AG-Ollama-Watchdog"
Write-Host "[START] Watchdog is now active and protecting system priority." -ForegroundColor Green

