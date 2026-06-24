param (
    [string]$VaultPath = Join-Path (Split-Path $PSScriptRoot -Parent) "docs",
    [string]$InboxFolder = "00_Inbox"
)

$InboxPath = Join-Path -Path $VaultPath -ChildPath $InboxFolder

# Create the Inbox folder if it doesn't exist
if (-not (Test-Path -Path $InboxPath)) {
    Write-Host "[INIT] Creating Obsidian Inbox at: $InboxPath"
    New-Item -ItemType Directory -Path $InboxPath | Out-Null
}

Write-Host "=================================================="
Write-Host " Creative Liberation Engine: Obsidian Mobile Clipper Bridge "
Write-Host "=================================================="
Write-Host "Watching for new mobile clippings in: $InboxPath"
Write-Host "Press Ctrl+C to stop..."

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $InboxPath
$watcher.Filter = "*.md"
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true

$action = {
    $path = $Event.SourceEventArgs.FullPath
    $name = $Event.SourceEventArgs.Name
    $changeType = $Event.SourceEventArgs.ChangeType
    $timeStamp = $Event.TimeGenerated

    Write-Host "[INBOX TRIGGER] $timeStamp - New clipping detected: $name"
    
    # Wait a brief moment to ensure the file is fully written (especially via cloud sync)
    Start-Sleep -Seconds 2
    
    # Send payload to Creative Liberation Engine via Teach-Back Processor
    $PythonScript = "\\127.0.0.1\docker\genesis-deploy\services\harvesters\teach_back_processor.py"
    Write-Host "[CORTEX INGESTION] Triggering Teach-Back Processor for $name"
    python $PythonScript $path
    
    Write-Host "[CORTEX INGESTION] Dispatched to STRATA Memory."
}

Register-ObjectEvent $watcher "Created" -Action $action | Out-Null

# Keep the script running
while ($true) {
    Start-Sleep -Seconds 5
}

