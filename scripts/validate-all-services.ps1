# Creative Liberation Engine V6 — OS Microservice Validation Suite
# =====================================================
# Installs and compiles all TypeScript Express services.

$services = @(
    "helix-1-infrastructure",
    "helix-2-agent-control-plane",
    "helix-3-creative-intelligence",
    "helix-4-video-pipeline",
    "helix-5-security-edge",
    "averi-gateway",
    "averi-memory-service",
    "scribe-daemon",
    "token-optimizer",
    "agent-observability",
    "sovereign-coder"
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " CLE V6 OS SERVICES VALIDATION RUNNER " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$report = @()

foreach ($srv in $services) {
    $path = Join-Path "services" $srv
    if (-not (Test-Path $path)) {
        $path = Join-Path "." $srv # fallback to sibling if run inside services folder
    }

    if (-not (Test-Path $path)) {
        Write-Host "[-] Service path not found: $srv" -ForegroundColor Red
        continue
    }

    Write-Host "`n[+] Validating Service: $srv" -ForegroundColor Yellow
    Write-Host "    Path: $path" -ForegroundColor DarkGray

    # 1. Run npm install
    Write-Host "    Installing dependencies..." -NoNewline
    $prevDir = Get-Location
    Set-Location $path
    cmd.exe /c "npm install"
    if ($LASTEXITCODE -ne 0) {
        Write-Host " FAILED" -ForegroundColor Red
        $report += [PSCustomObject]@{ Service = $srv; Install = "Failed"; Build = "Skipped" }
        Set-Location $prevDir
        continue
    }
    Write-Host " DONE" -ForegroundColor Green

    # 2. Run TypeScript build
    Write-Host "    Compiling TypeScript..." -NoNewline
    cmd.exe /c "npx tsc"
    if ($LASTEXITCODE -ne 0) {
        Write-Host " FAILED" -ForegroundColor Red
        $report += [PSCustomObject]@{ Service = $srv; Install = "Passed"; Build = "Failed" }
    } else {
        Write-Host " PASSED" -ForegroundColor Green
        $report += [PSCustomObject]@{ Service = $srv; Install = "Passed"; Build = "Passed" }
    }
    Set-Location $prevDir
}

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "             VALIDATION REPORT              " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$allPassed = $true
foreach ($r in $report) {
    $color = "Green"
    if ($r.Build -ne "Passed" -or $r.Install -ne "Passed") {
        $color = "Red"
        $allPassed = $false
    }
    Write-Host ("{0,-30} | Install: {1,-6} | Build: {2,-6}" -f $r.Service, $r.Install, $r.Build) -ForegroundColor $color
}

Write-Host "=============================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host " VERDICT: ALL OS MICROSERVICES ARE COMPILED & LIVE! " -ForegroundColor Green
} else {
    Write-Host " VERDICT: SOME SERVICES FAILED COMPILED CHECKS. " -ForegroundColor Red
}
Write-Host "=============================================" -ForegroundColor Cyan
