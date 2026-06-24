<#
.SYNOPSIS
    restore-workspaces.ps1 — Recovers Antigravity Workspaces/ from NAS backup
.DESCRIPTION
    When Antigravity crashes or updates and wipes the Workspaces/ directory,
    this script restores the workspace.json configs from the last NAS snapshot.
    Run this before relaunching Antigravity after a crash.
.USAGE
    .\restore-workspaces.ps1
#>

$WorkspacesDir = "C:\Users\jahar\AppData\Roaming\Antigravity\Workspaces"
$NasSession    = "\\127.0.0.1\docker\genesis-deploy\runtime\session"
$snapshotPath  = "$NasSession\antigravity-state.json"

Write-Host "[RESTORE] Checking Antigravity Workspaces..." -ForegroundColor Cyan

$existing = Get-ChildItem -Path $WorkspacesDir -Directory -ErrorAction SilentlyContinue
if ($existing.Count -gt 0) {
    Write-Host "[RESTORE] $($existing.Count) workspace(s) already present. No restore needed." -ForegroundColor Green
    exit 0
}

Write-Host "[RESTORE] Workspaces directory empty — loading NAS backup..." -ForegroundColor Yellow

if (-not (Test-Path $snapshotPath)) {
    Write-Host "[RESTORE] ERROR: No NAS backup found at $snapshotPath" -ForegroundColor Red
    Write-Host "[RESTORE] Run sync-session.ps1 first to create a backup." -ForegroundColor Red
    exit 1
}

try {
    $snapshot = Get-Content $snapshotPath -Raw | ConvertFrom-Json
} catch {
    Write-Host "[RESTORE] ERROR: Could not parse snapshot — $_" -ForegroundColor Red
    exit 1
}

$backups = $snapshot.workspace_backups
if (-not $backups -or ($backups.PSObject.Properties | Measure-Object).Count -eq 0) {
    Write-Host "[RESTORE] No workspace backups in snapshot. Nothing to restore." -ForegroundColor Yellow
    exit 0
}

$restored = 0
foreach ($prop in $backups.PSObject.Properties) {
    $wsId   = $prop.Name
    $wsData = $prop.Value
    $dir    = Join-Path $WorkspacesDir $wsId
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $wsData | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $dir "workspace.json") -Encoding UTF8
    Write-Host "[RESTORE]   -> Restored workspace $wsId" -ForegroundColor Green
    $restored++
}

Write-Host "[RESTORE] Restored $restored workspace config(s) from NAS backup." -ForegroundColor Green
Write-Host "[RESTORE] Snapshot taken at: $($snapshot.snapshot_time)" -ForegroundColor Cyan
Write-Host "[RESTORE] Restart Antigravity to pick up restored workspaces." -ForegroundColor Yellow
