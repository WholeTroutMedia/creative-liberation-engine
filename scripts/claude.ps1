param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

# Pass all arguments to Claude CLI on the NAS via SSH
$remoteArgs = [string]::Join(" ", $Args)
$cwd = (Get-Location).Path

# Convert local Y:\ or D:\ paths to NAS paths
if ($cwd -match "^[Yy]:\\creative-liberation-engine(.*)") {
    $remoteCwd = "/app/creative-liberation-engine$($matches[1].Replace('\', '/'))"
} elseif ($cwd -match "^[Dd]:\\.*\\creative-liberation-engine(.*)") {
    $remoteCwd = "/app/creative-liberation-engine$($matches[1].Replace('\', '/'))"
} else {
    $remoteCwd = "/app/creative-liberation-engine"
}

Write-Host "Running Claude Code CLI on NAS..." -ForegroundColor Cyan
Write-Host "Directory: $remoteCwd" -ForegroundColor DarkGray

ssh -t -p 2000 jaharoni@127.0.0.1 "source ~/.bashrc && cd '$remoteCwd' && claude $remoteArgs"
