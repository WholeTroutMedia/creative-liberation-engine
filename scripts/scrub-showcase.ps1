<#
.SYNOPSIS
    Scrubs IP addresses and personal identifiers from the showcase ZIP.
#>

$zipPath$zipPath = Join-Path (Split-Path $PSScriptRoot -Parent) "cle-engine-showcase-20260430.zip"
$extractDir = Join-Path $env:TEMP 'cle-showcase-scrub'

# Clean and extract
if (Test-Path $extractDir) { Remove-Item -Recurse -Force $extractDir }
Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
Write-Host 'Extracted. Scanning for IP/NAS references...'

$textExts = @('.md','.json','.ts','.js','.py','.yml','.yaml','.txt','.html','.css','.sh','.ps1','.toml','.cfg')
$scrubbed = 0

Get-ChildItem -Path $extractDir -Recurse -File | Where-Object { $textExts -contains $_.Extension } | ForEach-Object {
    try {
        $content = [System.IO.File]::ReadAllText($_.FullName)
        $original = $content

        # Scrub IP addresses and personal identifiers
        $content = $content.Replace('127.0.0.1:5050', 'YOUR_NAS_IP:5050')
        $content = $content.Replace('127.0.0.1:3000', 'YOUR_NAS_IP:3000')
        $content = $content.Replace('\\127.0.0.1\docker\genesis-deploy', '\\YOUR_NAS\docker\genesis-deploy')
        $content = $content.Replace('\\127.0.0.1\The Vault', '\\YOUR_NAS\shared')
        $content = $content.Replace('ssh -p 2000 jaharoni@127.0.0.1', 'ssh -p 2000 YOUR_USER@YOUR_NAS_IP')
        $content = $content.Replace('http://127.0.0.1', 'http://YOUR_NAS_IP')
        $content = $content.Replace('127.0.0.1', 'YOUR_NAS_IP')
        $content = $content.Replace('jaharoni@', 'YOUR_USER@')

        if ($content -ne $original) {
            [System.IO.File]::WriteAllText($_.FullName, $content)
            $scrubbed++
            $relPath = $_.FullName.Replace($extractDir, '')
            Write-Host "  Scrubbed: $relPath"
        }
    } catch {
        # Skip binary or locked files
    }
}

Write-Host "Scrubbed $scrubbed files"

# Repackage
Remove-Item $zipPath -Force
Compress-Archive -Path (Join-Path $extractDir '*') -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -Recurse -Force $extractDir

$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "Repackaged: $zipPath ($size MB)"

