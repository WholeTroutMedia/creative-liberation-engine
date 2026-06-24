param (
    [string]$InboxPath = "\\127.0.0.1\docker\genesis-deploy\media\splat_inbox",
    [string]$OutputDir = "\\127.0.0.1\docker\genesis-deploy\media\splats"
)

# Create Output directory if it doesn't exist
if (-not (Test-Path -Path $OutputDir)) {
    Write-Host "[INIT] Creating Splat output directory at: $OutputDir"
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

Write-Host "=================================================="
Write-Host " Creative Liberation Engine: 3D Gaussian Splat Queue        "
Write-Host "=================================================="
Write-Host "Watching for new video files in: $InboxPath"
Write-Host "Local Hardware: RTX 4090 Target"
Write-Host "Press Ctrl+C to stop..."

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $InboxPath
$watcher.Filter = "*.*" # e.g., *.mp4, *.mov
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true

$action = {
    $path = $Event.SourceEventArgs.FullPath
    $name = $Event.SourceEventArgs.Name
    $timeStamp = $Event.TimeGenerated

    # Filter out non-video/image files
    if ($name -match "\.(mp4|mov|avi)$") {
        Write-Host "[SPLAT TRIGGER] $timeStamp - New raw capture detected: $name"
        
        Write-Host "  -> Queueing for COLMAP + Splat generation on local RTX 4090..."
        
        $SplatName = [System.IO.Path]::GetFileNameWithoutExtension($name)
        $OutPath = Join-Path -Path $OutputDir -ChildPath $SplatName
        
        # Trigger the python script
        $PythonScript = "\\127.0.0.1\docker\genesis-deploy\scripts\ml\run_gaussian_splat.py"
        python $PythonScript $path $OutPath
        
        Write-Host "  -> [COMPLETE] Processing complete. Splat generated and ready for Engine Room canvas."
    }
}

Register-ObjectEvent $watcher "Created" -Action $action | Out-Null

while ($true) {
    Start-Sleep -Seconds 5
}
