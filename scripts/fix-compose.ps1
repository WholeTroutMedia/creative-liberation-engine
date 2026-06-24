$ErrorActionPreference = "Stop"
$composePath = "\\127.0.0.1\docker\creative-liberation-engine\docker-compose.nas.yml"
$content = Get-Content $composePath -Raw

# The appended helices are currently placed after the volumes block at the very end.
# I will cut them from the end, and paste them before the `volumes:` block.

# First, find where `volumes:` starts
$volumesIndex = $content.IndexOf("volumes:")

# Also find where the helices start. The first helix appended was helix-1-infrastructure
$helixIndex = $content.IndexOf("  helix-1-infrastructure:")

if ($helixIndex -gt $volumesIndex) {
    Write-Host "Helices are after volumes. Fixing..."
    
    # Split the content into three parts:
    # 1. Everything before `volumes:`
    # 2. The `volumes:` block (from "volumes:" up to the helices)
    # 3. The helices block (from "  helix-1-infrastructure:" to the end)
    
    $part1 = $content.Substring(0, $volumesIndex)
    $part2 = $content.Substring($volumesIndex, $helixIndex - $volumesIndex)
    $part3 = $content.Substring($helixIndex)
    
    # Reassemble: part1 + part3 + part2
    $fixedContent = $part1 + $part3 + $part2
    
    Set-Content -Path $composePath -Value $fixedContent
    Write-Host "Fixed docker-compose.nas.yml"
} else {
    Write-Host "Helices are already before volumes. No action needed."
}
