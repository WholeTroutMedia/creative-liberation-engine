param(
    [string]$ConversationId = "",
    [string]$WorkspaceRoot  = ""
)

$ErrorActionPreference = "SilentlyContinue"

$AgAppData     = "C:\Users\jahar\AppData\Roaming\Antigravity"
$StateDb       = "$AgAppData\User\globalStorage\state.vscdb"
$WorkspacesDir = "$AgAppData\Workspaces"
$BrainDir      = "C:\Users\jahar\.gemini\antigravity\brain"
$NasSession    = "\\127.0.0.1\docker\creative-liberation-engine\runtime\session"
$NasRegistry   = "\\127.0.0.1\docker\creative-liberation-engine\runtime\registry"
$TempDb        = "$env:TEMP\ag_state_snap.vscdb"

Write-Host "[SYNC-SESSION] Starting Antigravity -> NAS bridge..." -ForegroundColor Cyan

# Step 1: Extract workspace roots from state.vscdb
$workspaceRoots = @()
try {
    Copy-Item -Path $StateDb -Destination $TempDb -Force
    $bytes = [System.IO.File]::ReadAllBytes($TempDb)
    $text  = [System.Text.Encoding]::UTF8.GetString($bytes)
    $hits  = [regex]::Matches($text, 'file:///[A-Za-z%:/._\-0-9]+')
    $workspaceRoots = $hits | ForEach-Object {
        [uri]::UnescapeDataString($_.Value.Replace('file:///', '')) -replace '/', '\'
    } | Where-Object {
        $_ -notlike "*AppData*" -and
        $_ -notlike "*Programs*" -and
        $_ -notlike "*extensions*" -and
        $_.Length -gt 10
    } | Sort-Object -Unique
    Remove-Item $TempDb -Force
    Write-Host "[SYNC-SESSION] Extracted $($workspaceRoots.Count) workspace roots" -ForegroundColor Green
} catch {
    Write-Host "[SYNC-SESSION] Warning: Could not read state.vscdb: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 2: Backup Workspaces/ directory configs
$workspaceBackups = @{}
$wsDirs = Get-ChildItem -Path $WorkspacesDir -Directory -ErrorAction SilentlyContinue
foreach ($dir in $wsDirs) {
    $jsonPath = Join-Path $dir.FullName "workspace.json"
    if (Test-Path $jsonPath) {
        try {
            $workspaceBackups[$dir.Name] = (Get-Content $jsonPath -Raw | ConvertFrom-Json)
        } catch {}
    }
}
Write-Host "[SYNC-SESSION] Backed up $($workspaceBackups.Count) workspace configs" -ForegroundColor Green

# Step 2.5: Mirror conversation logs between local workstation and NAS
Write-Host "[SYNC-SESSION] Mirroring conversation logs between local and NAS..." -ForegroundColor Cyan
$NasBrainDir = "\\127.0.0.1\docker\creative-liberation-engine\runtime\brain"
$uuidRegex = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

if (-not (Test-Path $NasBrainDir)) {
    try { New-Item -ItemType Directory -Path $NasBrainDir -Force | Out-Null }
    catch { Write-Host "[SYNC-SESSION] Warning: Could not create NAS brain folder: $($_.Exception.Message)" -ForegroundColor Yellow }
}

if (Test-Path $BrainDir) {
    $localConvs = Get-ChildItem -Path $BrainDir -Directory | Where-Object { $_.Name -match $uuidRegex } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 15
    foreach ($conv in $localConvs) {
        $src = $conv.FullName
        $dest = Join-Path $NasBrainDir $conv.Name
        robocopy $src $dest /E /XO /R:1 /W:1 /NDL /NFL /NJH /NJS /XD tempmediaStorage | Out-Null
    }
}

if (Test-Path $NasBrainDir) {
    $nasConvs = Get-ChildItem -Path $NasBrainDir -Directory | Where-Object { $_.Name -match $uuidRegex } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 15
    foreach ($conv in $nasConvs) {
        $src = $conv.FullName
        $dest = Join-Path $BrainDir $conv.Name
        robocopy $src $dest /E /XO /R:1 /W:1 /NDL /NFL /NJH /NJS /XD tempmediaStorage | Out-Null
    }
}

# Step 3: Read recent conversations from brain dir
$conversations = @()
if (Test-Path $BrainDir) {
    $convDirs = Get-ChildItem -Path $BrainDir -Directory |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 20
    foreach ($dir in $convDirs) {
        $overviewPath = Join-Path $dir.FullName ".system_generated\logs\overview.txt"
        $conversations += [PSCustomObject]@{
            id            = $dir.Name
            last_modified = $dir.LastWriteTime.ToString("o")
            has_logs      = (Test-Path $overviewPath)
        }
    }
}
Write-Host "[SYNC-SESSION] Found $($conversations.Count) recent conversations" -ForegroundColor Green

# Step 4: Build snapshot
$agExe = "C:\Users\jahar\AppData\Local\Programs\Antigravity\Antigravity.exe"
$agVersion = if (Test-Path $agExe) { (Get-Item $agExe).VersionInfo.FileVersion } else { "unknown" }

$snapshot = [ordered]@{
    snapshot_time          = (Get-Date).ToUniversalTime().ToString("o")
    machine                = $env:COMPUTERNAME
    antigravity_version    = $agVersion
    active_conversation_id = $ConversationId
    active_workspace_root  = $WorkspaceRoot
    workspace_roots        = $workspaceRoots
    workspace_backups      = $workspaceBackups
    recent_conversations   = $conversations
}

# Step 5: Write snapshot to NAS
if (-not (Test-Path $NasSession)) { New-Item -ItemType Directory -Path $NasSession -Force | Out-Null }
$snapshotPath = "$NasSession\antigravity-state.json"
$snapshot | ConvertTo-Json -Depth 10 | Set-Content -Path $snapshotPath -Encoding UTF8
Write-Host "[SYNC-SESSION] Snapshot -> $snapshotPath" -ForegroundColor Green

# Step 6: Update workspaces.canonical.json registry
if (-not (Test-Path $NasRegistry)) { New-Item -ItemType Directory -Path $NasRegistry -Force | Out-Null }
$registryPath = "$NasRegistry\workspaces.canonical.json"

$registry = if (Test-Path $registryPath) {
    try { Get-Content $registryPath -Raw | ConvertFrom-Json }
    catch { [PSCustomObject]@{ version = "1.0.0"; workspaces = @() } }
} else {
    [PSCustomObject]@{ version = "1.0.0"; workspaces = @() }
}

$registry | Add-Member -NotePropertyName last_sync -NotePropertyValue (Get-Date).ToUniversalTime().ToString("o") -Force

if ($ConversationId -ne "") {
    $existing = $registry.workspaces | Where-Object { $_.conversation_id -eq $ConversationId }
    if ($null -eq $existing) {
        $registry.workspaces += [PSCustomObject]@{
            conversation_id = $ConversationId
            workspace_root  = $WorkspaceRoot
            last_active     = (Get-Date).ToUniversalTime().ToString("o")
            handoff_phase   = "UNKNOWN"
            tags            = @()
        }
    } else {
        $existing.last_active    = (Get-Date).ToUniversalTime().ToString("o")
        $existing.workspace_root = $WorkspaceRoot
    }
}

$registry | ConvertTo-Json -Depth 10 | Set-Content -Path $registryPath -Encoding UTF8
Write-Host "[SYNC-SESSION] Registry -> $registryPath" -ForegroundColor Green
Write-Host "[SYNC-SESSION] Done." -ForegroundColor Cyan
