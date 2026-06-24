#!/usr/bin/env pwsh
# morning-briefing.ps1 Ã¢â‚¬â€ Generate daily logon briefing for CORTEX
# Runs once per day at logon. Writes briefing.md to .agents/ and dispatch.

$briefingFile = Join-Path $PSScriptRoot "briefing.md"
$log = Join-Path $PSScriptRoot "morning-briefing.log"
$v5 = Split-Path $PSScriptRoot -Parent
$markerFile = Join-Path $PSScriptRoot ".briefing-date"
$dispatchUrl = "http://127.0.0.1:5050/api/status"
$gitMonLog = Join-Path $PSScriptRoot "git-monitor.log"

function WL($m) {
    $ts = (Get-Date).ToString("HH:mm:ss")
    Add-Content -Path $log -Value "[$ts] $m" -ErrorAction SilentlyContinue
}

# Only run once per calendar day
$today = (Get-Date).ToString("yyyy-MM-dd")
if ((Test-Path $markerFile) -and (Get-Content $markerFile -ErrorAction SilentlyContinue) -eq $today) {
    WL "Briefing already generated today Ã¢â‚¬â€ skipping"
    exit 0
}

WL "=== morning-briefing generating ==="

# --- Data gathering ---
# Git log (last 24h)
$since = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd HH:mm")
$commits = git -C $v5 log --oneline --since=`"$since`" 2>&1
$commitCount = ($commits | Where-Object { $_ }).Count

# Git monitor pushes from log
$pushes = @()
if (Test-Path $gitMonLog) {
    $pushes = Get-Content $gitMonLog | Where-Object { $_ -match "PUSHED" } | Select-Object -Last 10
}

# Dispatch state
$queuedTasks = @(); $activeTasks = @(); $doneCount = 0; $agentCount = 0
try {
    $dispatch = Invoke-RestMethod -Uri $dispatchUrl -TimeoutSec 3
    $queuedTasks = $dispatch.queued_tasks | ForEach-Object { "- [$($_.priority.ToUpper())] $($_.title)" }
    $activeTasks = $dispatch.active_tasks | ForEach-Object { "- $($_.title)" }
    $doneCount = $dispatch.summary.done
    $agentCount = $dispatch.summary.total_agents
}
catch { }

# NAS status
$nasOnline = [bool](Test-Connection -ComputerName "127.0.0.1" -Count 1 -Quiet -ErrorAction SilentlyContinue)

# Git status (uncommitted)
$dirty = (git -C $v5 status --porcelain 2>&1) | Where-Object { $_ }

# --- Build briefing ---
$date = (Get-Date).ToString("dddd, MMMM d yyyy Ã¢â‚¬â€ h:mm tt")
$lines = @(
    "# Ã°Å¸Å’â€¦ CORTEX Morning Briefing",
    "_Generated: $date_",
    "",
    "---",
    "",
    "## Ã°Å¸â€œÂ¡ System Status",
    "| Service | State |",
    "|---------|-------|",
    "| NAS (127.0.0.1) | $(if($nasOnline){'Ã¢Å“â€¦ Online'}else{'Ã¢ÂÅ’ Offline'}) |",
    "| Dispatch | $(if($queuedTasks -or $activeTasks){'Ã¢Å“â€¦ Online'}else{'Ã¢Å¡Â Ã¯Â¸Â No data'}) |",
    "| Active Agents | $agentCount |",
    "| Tasks Done (total) | $doneCount |",
    "",
    "## Ã°Å¸â€œÂ¬ Task Queue",
    "**Queued:**"
)
if ($queuedTasks) { $lines += $queuedTasks } else { $lines += "_No queued tasks_" }
$lines += ""
$lines += "**Active:**"
if ($activeTasks) { $lines += $activeTasks } else { $lines += "_None_" }
$lines += ""
$lines += "## Ã°Å¸â€â‚¬ Git Activity (last 24h)"
$lines += "**Commits:** $commitCount"
$lines += ""
if ($pushes) {
    $lines += "**Recent pushes:**"
    $lines += $pushes
}
if ($dirty) {
    $lines += ""
    $lines += "Ã¢Å¡Â Ã¯Â¸Â **Uncommitted changes:** $($dirty.Count) files"
}
else {
    $lines += ""
    $lines += "Ã¢Å“â€¦ Working tree clean"
}
$lines += ""
$lines += "---"
$lines += "_CORTEX is online. Good morning, Artist._"

# Write briefing
$lines -join "`n" | Set-Content $briefingFile -Encoding UTF8
$today | Set-Content $markerFile -Encoding UTF8

WL "Briefing written: $commitCount commits, $($queuedTasks.Count) queued tasks"
WL "File: $briefingFile"


