<#
.SYNOPSIS
    register-session-sync.ps1 â€” Registers sync-session.ps1 as a Windows Scheduled Task
.DESCRIPTION
    Creates two Task Scheduler entries:
      1. AG-SessionSync-Logon   â€” runs at user logon (immediate startup snapshot)
      2. AG-SessionSync-Timer   â€” runs every 30 minutes (continuous sync)
    Run once as administrator (or approve UAC prompt).
.USAGE
    .\register-session-sync.ps1
#>

$ScriptPath = Join-Path $PSScriptRoot "sync-session.ps1"
$TaskUser   = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`""

# â”€â”€ Task 1: Run at logon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
$triggerLogon  = New-ScheduledTaskTrigger -AtLogOn -User $TaskUser
$settingsLogon = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -StartWhenAvailable

Register-ScheduledTask `
    -TaskName   "AG-SessionSync-Logon" `
    -TaskPath   "\CLEEngine\" `
    -Action     $action `
    -Trigger    $triggerLogon `
    -Settings   $settingsLogon `
    -RunLevel   Limited `
    -Force | Out-Null

Write-Host "[REGISTER] Task 'AG-SessionSync-Logon' registered (fires at logon)" -ForegroundColor Green

# â”€â”€ Task 2: Run every 30 minutes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
$triggerTimer = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 30) -Once -At (Get-Date)
$settingsTimer = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -StartWhenAvailable

Register-ScheduledTask `
    -TaskName   "AG-SessionSync-Timer" `
    -TaskPath   "\CLEEngine\" `
    -Action     $action `
    -Trigger    $triggerTimer `
    -Settings   $settingsTimer `
    -RunLevel   Limited `
    -Force | Out-Null

Write-Host "[REGISTER] Task 'AG-SessionSync-Timer' registered (fires every 30 min)" -ForegroundColor Green
Write-Host "[REGISTER] Both tasks registered under \CLEEngine\ path." -ForegroundColor Cyan
Write-Host "[REGISTER] View in Task Scheduler > Task Scheduler Library > CLEEngine" -ForegroundColor Gray

