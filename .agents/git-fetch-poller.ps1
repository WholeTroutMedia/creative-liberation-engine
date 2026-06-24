#!/usr/bin/env pwsh
# git-fetch-poller.ps1 Ã¢â‚¬â€ Keep all ecosystem repos fresh via git fetch
# Runs every 5 minutes. Fetches creative-liberation-engine-v5 and all ecosystem submodules.

$log = Join-Path $PSScriptRoot "git-fetch-poller.log"
$v5 = Split-Path $PSScriptRoot -Parent

function WL($m) {
    $ts = (Get-Date).ToString("HH:mm:ss")
    Add-Content -Path $log -Value "[$ts] $m" -ErrorAction SilentlyContinue
}

WL "=== git-fetch-poller START ==="

while ($true) {
    # Fetch main repo
    $result = git -C $v5 fetch origin 2>&1
    $behind = git -C $v5 rev-list "HEAD..origin/main" --count 2>&1
    if ($behind -gt 0) {
        WL "BEHIND $behind commits Ã¢â‚¬â€ pulling"
        git -C $v5 pull --rebase origin main 2>&1 | Out-Null
        WL "Pulled Ã¢â‚¬â€ now at $(git -C $v5 rev-parse --short HEAD)"
    }
    else {
        WL "v5 up to date"
    }

    # Fetch ecosystem submodules
    $ecosystemPath = "$v5\ecosystem"
    if (Test-Path $ecosystemPath) {
        Get-ChildItem $ecosystemPath -Directory | ForEach-Object {
            $sub = $_.FullName
            if (Test-Path "$sub\.git") {
                git -C $sub fetch origin 2>&1 | Out-Null
                WL "  fetched $($_.Name)"
            }
        }
    }

    Start-Sleep -Seconds 300  # 5 minutes
}


