<#
.SYNOPSIS
    register-toyota-telemetry.ps1 — Registers toyota_telemetry_harvest.py as a Windows Scheduled Task
.DESCRIPTION
    Creates a Task Scheduler entry:
      AG-ToyotaTelemetry-Timer — runs every 15 minutes to fetch factual vehicle telemetry from Toyota Cloud,
      record it to the SQLite database, update venza-state.json, and populate the Google Sheet autonomously.
.USAGE
    .\register-toyota-telemetry.ps1
#>

$ScriptPath = "y:\creative-liberation-engine\scripts\toyota_telemetry_harvest.py"

$action = New-ScheduledTaskAction `
    -Execute "python.exe" `
    -Argument "`"$ScriptPath`""

# Trigger: runs every 15 minutes (continuous telemetry logging)
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 15) -Once -At (Get-Date)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -StartWhenAvailable

Register-ScheduledTask `
    -TaskName   "AG-ToyotaTelemetry-Timer" `
    -TaskPath   "\CLEEngine\" `
    -Action     $action `
    -Trigger    $trigger `
    -Settings   $settings `
    -RunLevel   Limited `
    -Force | Out-Null

Write-Host "[REGISTER] Task 'AG-ToyotaTelemetry-Timer' registered successfully." -ForegroundColor Green
Write-Host "[REGISTER] Will execute every 15 minutes to pull vehicle telematics and sync the Google Sheet." -ForegroundColor Cyan
Write-Host "[REGISTER] View in Task Scheduler > Task Scheduler Library > CLEEngine" -ForegroundColor Gray
