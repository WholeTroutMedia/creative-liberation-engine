# watch-genkit.ps1 — Creative Liberation Engine V6 Autonomous Genkit Container Sync Daemon
#
# Watches the local workspace 'packages/' directory and automatically copies,
# compiles, and hot-reloads all updates directly inside the creative-liberation-engine-genkit-1 container.
#
# Usage:
#   .\scripts\watch-genkit.ps1

$ErrorActionPreference = "Stop"

# ANSI color codes for premium logging
$ESC = [char]27
$C_RESET = "$ESC[0m"
$C_BLUE  = "$ESC[34m"
$C_GREEN = "$ESC[32m"
$C_YELLOW= "$ESC[33m"
$C_CYAN  = "$ESC[36m"
$C_RED   = "$ESC[31m"

Write-Host "`n${C_BLUE}================================================================${C_RESET}"
Write-Host "${C_CYAN}📡 CLE ENGINE V6 — GENKIT DOCKER SYNC DAEMON ACTIVE${C_RESET}"
Write-Host "${C_BLUE}================================================================${C_RESET}`n"

$workspaceRoot = Resolve-Path "$PSScriptRoot\.."
$watchPath = Join-Path $workspaceRoot "packages"
$containerName = "creative-liberation-engine-genkit-1"
$nasIp = "127.0.0.1"

Write-Host "${C_GREEN}[SYSTEM] Workspace Root: $workspaceRoot${C_RESET}"
Write-Host "${C_GREEN}[SYSTEM] Watching Directory: $watchPath${C_RESET}"
Write-Host "${C_GREEN}[SYSTEM] Target Container: $containerName (on NAS $nasIp)${C_RESET}"

# Verify container is running
try {
    $containerStatus = ssh -p 2000 "jaharoni@$nasIp" "docker inspect -f '{{.State.Running}}' $containerName" 2>$null
    if ($containerStatus -ne "true") {
        Write-Host "${C_RED}[ERROR] Target container '$containerName' is not running on the NAS!${C_RESET}"
        exit 1
    }
    Write-Host "${C_GREEN}[SYSTEM] Successfully connected to NAS Docker engine. Container is running.${C_RESET}`n"
} catch {
    Write-Host "${C_RED}[ERROR] Failed to connect to Synology NAS via SSH (port 2000). Verify keys and connection.${C_RESET}"
    exit 1
}

# Setup FileSystemWatcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $watchPath
$watcher.Filter = "*.ts"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

# Debounce tracker
$lastWriteTime = @{}
$debounceMs = 1500

Write-Host "${C_YELLOW}[WATCHER] 👁️  Monitoring all packages for source code updates...${C_RESET}"

# Event action block
$action = {
    $changedFile = $Event.SourceEventArgs.FullPath
    $changeType = $Event.SourceEventArgs.ChangeType
    
    # Simple debouncer to prevent double-firing
    $now = Get-Date
    if ($lastWriteTime.ContainsKey($changedFile)) {
        $diff = ($now - $lastWriteTime[$changedFile]).TotalMilliseconds
        if ($diff -lt $debounceMs) {
            return
        }
    }
    $lastWriteTime[$changedFile] = $now

    # Get path relative to the creative-liberation-engine root
    $relativePath = Resolve-Path -Relative -Path $changedFile -LiteralPath $workspaceRoot
    # Convert relative path backslash to slash for linux container compatibility
    $containerDest = "/app/" + $relativePath.Replace("\", "/")
    
    Write-Host "`n${C_YELLOW}────────────────────────────────────────────────────────────────${C_RESET}"
    Write-Host "${C_YELLOW}[SYNC TRIGGERED] 📂 File $changeType: $relativePath${C_RESET}"
    
    try {
        # Step 1: Copy to NAS host directory first (so NAS backup stays true)
        $nasDestPath = "/app/creative-liberation-engine/" + $relativePath.Replace("\", "/")
        Write-Host "${C_BLUE}[SYNC] Mirroring file to NAS repository...${C_RESET}"
        
        # Determine NAS UNC path equivalent
        $uncPath = $changedFile.Replace($workspaceRoot, "\\127.0.0.1\docker\creative-liberation-engine")
        Copy-Item -Path $changedFile -Destination $uncPath -Force

        # Step 2: Copy directly into the active running container filesystem
        Write-Host "${C_BLUE}[SYNC] Copying file into container workspace ($containerDest)...${C_RESET}"
        ssh -p 2000 "jaharoni@$nasIp" "docker cp /app/creative-liberation-engine/$relativePath $containerName`:$containerDest"
        
        # Step 3: Run compiled build inside the container filesystem
        Write-Host "${C_BLUE}[BUILD] Rebuilding package inside the container...${C_RESET}"
        # Parse which package it belongs to (e.g. packages/genkit -> @cle/genkit)
        $filterName = "@cle/genkit"
        if ($relativePath.Contains("packages/")) {
            $parts = $relativePath.Split("/")
            $pkgDir = $parts[1]
            $filterName = "@cle/$pkgDir"
        }
        
        $buildCmd = "docker exec $containerName pnpm --filter `"$filterName`" run build"
        $buildResult = ssh -p 2000 "jaharoni@$nasIp" $buildCmd 2>&1
        
        if ($buildResult -match "error" -or $buildResult -match "failed") {
            Write-Host "${C_RED}[BUILD FAILED] Recompilation error:`n$buildResult${C_RESET}"
            return
        }
        Write-Host "${C_GREEN}[BUILD] Recompilation successful!${C_RESET}"
        
        # Step 4: Gracefully restart the service to apply changes
        Write-Host "${C_BLUE}[RESTART] Hot-reloading Express gateway container...${C_RESET}"
        ssh -p 2000 "jaharoni@$nasIp" "docker restart $containerName" > $null
        
        Write-Host "${C_GREEN}[SUCCESS] ✅ Hot-reload complete. Ecosystem updated and fully online!${C_RESET}"
        Write-Host "${C_YELLOW}────────────────────────────────────────────────────────────────${C_RESET}"
        
    } catch {
        Write-Host "${C_RED}[ERROR] Sync or build failed: $_${C_RESET}"
    }
}

# Register Object Events
$createdEvent = Register-ObjectEvent $watcher "Created" -Action $action
$changedEvent = Register-ObjectEvent $watcher "Changed" -Action $action

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    # Cleanup event handlers on exit
    Unregister-Event -SourceIdentifier $createdEvent.Name
    Unregister-Event -SourceIdentifier $changedEvent.Name
    $watcher.Dispose()
    Write-Host "`n${C_YELLOW}[WATCHER] Closed and resources disposed.${C_RESET}"
}
