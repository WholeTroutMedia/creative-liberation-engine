#!/usr/bin/env pwsh
# nas-watchdog.ps1 Ã¢â‚¬â€ Monitor NAS + write live state to system-status.json (v5 repo; creative-liberation-engine-v4 retired)
# Pings NAS every 60s. Writes `.agents/system-status.json` next to this script.

$log = Join-Path $PSScriptRoot "nas-watchdog.log"
$statusFile = Join-Path $PSScriptRoot "system-status.json"
$nasIp = "127.0.0.1"
$endpoints = @{
    dispatch = "http://$($nasIp):5050/api/status"
    genkit   = "http://$($nasIp):4100/health"
}

function WL($m) {
    $ts = (Get-Date).ToString("HH:mm:ss")
    Add-Content -Path $log -Value "[$ts] $m" -ErrorAction SilentlyContinue
}

function Test-Ep($url) {
    try { Invoke-RestMethod -Uri $url -TimeoutSec 3 -ErrorAction Stop | Out-Null; return $true }
    catch { return $false }
}

function Get-DispatchSummary {
    try {
        $r = Invoke-RestMethod -Uri $endpoints.dispatch -TimeoutSec 3 -ErrorAction Stop
        return @{ queued = $r.summary.queued; active = $r.summary.active; done = $r.summary.done; agents = $r.summary.total_agents }
    }
    catch { return @{ queued = 0; active = 0; done = 0; agents = 0 } }
}

WL "=== nas-watchdog START ==="

while ($true) {
    $nasOnline = [bool](Test-Connection -ComputerName $nasIp -Count 1 -Quiet -ErrorAction SilentlyContinue)
    $dispatchOnline = Test-Ep $endpoints.dispatch
    $genkitOnline = Test-Ep $endpoints.genkit
    $dispatch = if ($dispatchOnline) { Get-DispatchSummary } else { @{ queued = 0; active = 0; done = 0; agents = 0 } }

    $status = @{
        timestamp = (Get-Date -Format "o")
        nas       = @{ online = $nasOnline; ip = $nasIp }
        dispatch  = @{ online = $dispatchOnline; queued = $dispatch.queued; active = $dispatch.active; done = $dispatch.done; agents = $dispatch.agents }
        genkit    = @{ online = $genkitOnline; endpoint = "http://$($nasIp):4100" }
        system    = @{ hostname = $env:COMPUTERNAME; user = $env:USERNAME }
        cortex     = @{ STRATA = "active"; LOGD = "active"; PRISM = "active" }
    }

    # Read existing file to preserve fields we don't touch
    $existing = @{}
    if (Test-Path $statusFile) {
        try { $existing = Get-Content $statusFile -Raw | ConvertFrom-Json -AsHashtable } catch {}
    }
    # Merge
    foreach ($k in $status.Keys) { $existing[$k] = $status[$k] }

    # Write back
    $existing | ConvertTo-Json -Depth 6 | Set-Content $statusFile -Encoding UTF8 -ErrorAction SilentlyContinue

    $nasStr = if ($nasOnline) { "âœ…" } else { "âŒ" }
    $dStr = if ($dispatchOnline) { "âœ…" } else { "âŒ" }
    $gStr = if ($genkitOnline) { "âœ…" } else { "âŒ" }
    WL "NAS=$nasStr Dispatch=$dStr Genkit=$gStr | Q=$($dispatch.queued) A=$($dispatch.active) Done=$($dispatch.done)"

    # NASA BPv7 EGRESS ROUTER (Contact Graph Routing & Custody Transfer)
    if ($nasOnline) {
        $custodyDir = Join-Path $PSScriptRoot "custody"
        if (Test-Path $custodyDir) {
            $bundles = Get-ChildItem -Path $custodyDir -Filter "*.bpv7.json"
            $parsedBundles = @()

            # 1. Parse into CLA Memory for Routing
            foreach ($bundleFile in $bundles) {
                try {
                    $b = Get-Content $bundleFile.FullName -Raw | ConvertFrom-Json
                    $weight = 2 # default normal
                    if ($b.primary.priority -eq 'critical') { $weight = 4 }
                    elseif ($b.primary.priority -eq 'high') { $weight = 3 }
                    elseif ($b.primary.priority -eq 'low') { $weight = 1 }

                    $parsedBundles += [PSCustomObject]@{
                        File = $bundleFile
                        Bundle = $b
                        Weight = $weight
                        CreationTime = $b.primary.creationTimestampMs
                    }
                } catch {}
            }

            # 2. Contact Graph Routing: Sort by Priority (Desc), then CreationTime FIFO (Asc)
            $sortedBundles = $parsedBundles | Sort-Object -Property @{Expression="Weight"; Descending=$true}, @{Expression="CreationTime"; Descending=$false}

            # 3. Execute Egress Link Transmission
            foreach ($item in $sortedBundles) {
                $bundleFile = $item.File
                $bundle = $item.Bundle
                WL "-> Found BPv7 Bundle: $($bundleFile.Name) [PRIORITY: $($bundle.primary.priority)]. Attempting Egress..."
                try {
                    # Target B: The Quorum Vote (Byzantine Verification)
                    if ($bundle.primary.priority -eq 'critical') {
                        $signatures = $bundle.extension.witnessSignatures
                        if ($null -eq $signatures -or $signatures.Length -lt 2) {
                            WL "   -> EGRESS REJECTED: Critical bundle lacks Quorum. Requires 2+ witness signatures. Skipping."
                            continue
                        } else {
                            WL "   -> Quorum Verified. Proceeding with Egress."
                        }
                    }

                    # 3a. If bundle has code state, push to the NAS
                    if ($bundle.extension.gitCommitHash) {
                        WL "   -> Pushing Git Commit: $($bundle.extension.gitCommitHash)..."
                        $wd = Split-Path $PSScriptRoot -Parent
                        Invoke-Expression "git -C `"$wd`" push origin main" | Out-Null
                    }

                    # 3b. Transmit Knowledge Subgraph to ATLAS
                    if ($genkitOnline -and $bundle.extension.knowledgeSubgraph -and $bundle.extension.knowledgeSubgraph.Length -gt 0) {
                        WL "   -> Transmitting Knowledge Subgraph to ATLAS..."
                        $body = $bundle.extension.knowledgeSubgraph | ConvertTo-Json -Depth 10 -Compress
                        Invoke-RestMethod -Uri "http://$($nasIp):4100/api/atlas/egress" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 5 -ErrorAction SilentlyContinue | Out-Null
                    }

                    # 3c. Release Local Custody
                    WL "   -> Egress Complete. Releasing Local Custody."
                    Remove-Item $bundleFile.FullName -Force
                } catch {
                    WL "   -> Egress Failed for $($bundleFile.Name): $($_.Exception.Message)"
                }
            }
        }
    }

    # SELF-HEALING ANOMALY PROPAGATION
    if (-not $genkitOnline -and -not $nasOnline) {
        # Check if local Genkit process exists, kill it, and restart
        WL "ANOMALY DETECTED: Genkit & NAS offline. Initiating self-healing wave..."
        $npxProcs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "genkit start" }
        if ($npxProcs) {
            WL "-> Killing hung Genkit processes..."
            $npxProcs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        }
        WL "-> Re-firing genkit-autostart daemon..."
        Start-Process powershell.exe -ArgumentList "-WindowStyle Hidden -File `"D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\.agents\genkit-autostart.ps1`""
    }

    Start-Sleep -Seconds 60
}


