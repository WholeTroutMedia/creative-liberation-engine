<#
.SYNOPSIS
    register-daily-brief.ps1 — Registers generate_daily_brief.py as a Windows Scheduled Task
.DESCRIPTION
    Creates a Task Scheduler entry:
      AG-DailyBrief — runs daily at 8:00 AM local time to compile and update the live brief.
.USAGE
    .\register-daily-brief.ps1
#>

$ScriptPath = "y:\creative-liberation-engine\scripts\generate_daily_brief.py"
$action = New-ScheduledTaskAction `
    -Execute "python.exe" `
    -Argument "`"$ScriptPath`""

# Run daily at 08:00 AM
$trigger = New-ScheduledTaskTrigger -Daily -At "8:00 AM"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1) -StartWhenAvailable

Register-ScheduledTask `
    -TaskName   "AG-DailyBrief" `
    -TaskPath   "\CLEEngine\" `
    -Action     $action `
    -Trigger    $trigger `
    -Settings   $settings `
    -RunLevel   Limited `
    -Force | Out-Null

Write-Host "[REGISTER] Task 'AG-DailyBrief' registered successfully." -ForegroundColor Green
Write-Host "[REGISTER] Will execute daily at 8:00 AM to compile live system telemetry." -ForegroundColor Cyan
Write-Host "[REGISTER] View in Task Scheduler > Task Scheduler Library > CLEEngine" -ForegroundColor Gray
