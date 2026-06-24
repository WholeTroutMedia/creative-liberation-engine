param(
  [string]$NasUser = "jaharoni",
  [string]$NasHost = "127.0.0.1",
  [int]$NasPort = 2000,
  [string]$OutFile = "docs/nas-path-telemetry.json"
)

$ErrorActionPreference = "Stop"

function Invoke-Nas([string]$RemoteCommand) {
  $out = ssh -p $NasPort "$NasUser@$NasHost" "$RemoteCommand"
  if ($LASTEXITCODE -ne 0) {
    throw "NAS command failed: $RemoteCommand"
  }
  return @($out)
}

$generatedAt = (Get-Date).ToString("o")
$volume1Df = (Invoke-Nas "df -h /volume1 | tail -1" | Select-Object -First 1)
$volume2Df = (Invoke-Nas "df -h /volume2 | tail -1" | Select-Object -First 1)
$volume1Dirs = Invoke-Nas "ls -1 /volume1"
$vaultDirs = Invoke-Nas "ls -1 '/app/vault'"
$volume2DockerDirs = Invoke-Nas "ls -1 /app"
$v6RuntimeDirs = Invoke-Nas "ls -1 /volume2/cle-engine/v6"

$payload = [ordered]@{
  generated_at = $generatedAt
  volume1_df = $volume1Df
  volume2_df = $volume2Df
  volume1_dirs = $volume1Dirs
  vault_dirs = $vaultDirs
  volume2_docker_dirs = $volume2DockerDirs
  v6_runtime_dirs = $v6RuntimeDirs
}

$json = $payload | ConvertTo-Json -Depth 6
$outPath = Join-Path (Get-Location) $OutFile
$outDir = Split-Path -Parent $outPath
if (!(Test-Path $outDir)) {
  New-Item -Path $outDir -ItemType Directory -Force | Out-Null
}

$json | Out-File -FilePath $outPath -Encoding utf8
Write-Output "Wrote NAS path telemetry to $outPath"
