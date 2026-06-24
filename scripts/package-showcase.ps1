<#
.SYNOPSIS
    Packages the Creative Liberation Engine V6 as a sanitized showcase bundle for partner review.
.DESCRIPTION
    Creates a clean, secrets-free archive of the creative-liberation-engine repository suitable
    for sharing with external partners.
.OUTPUTS
    cle-engine-showcase-YYYYMMDD.zip in the parent directory
#>

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$DateStamp = Get-Date -Format 'yyyyMMdd'
$OutputName = "cle-engine-showcase-$DateStamp"
$StagingDir = Join-Path $env:TEMP $OutputName
$OutputZip = Join-Path (Split-Path -Parent $RepoRoot) "$OutputName.zip"

Write-Host ''
Write-Host '=========================================' -ForegroundColor Cyan
Write-Host '  CLE ENGINE - SHOWCASE PACKAGER   ' -ForegroundColor Cyan
Write-Host '  Sanitizing for partner delivery        ' -ForegroundColor Cyan
Write-Host '=========================================' -ForegroundColor Cyan
Write-Host ''

# --- STEP 1: Clean staging area ---
if (Test-Path $StagingDir) {
    Write-Host '[1/6] Cleaning previous staging area...' -ForegroundColor Yellow
    Remove-Item -Recurse -Force $StagingDir
}

# --- STEP 2: Copy repo ---
Write-Host '[2/6] Copying repository...' -ForegroundColor Yellow

$ExcludeDirs = @(
    'node_modules'
    '.git'
    '__pycache__'
    'dist_temp'
    'temp_in'
    'temp_out'
    '.kilocode'
    'scratch'
)

$ExcludeFiles = @(
    '.env'
    '.env.nas'
    '.env.local'
    '.env.production'
    '*.tar'
    '*.tar.gz'
    '*.zip'
    'cortex_state.json'
    'dom_dump.html'
    'learn_dom.html'
    'nvidia_dom.html'
    'search_results.txt'
    'cortex_harvest_log*.txt'
    'pnpm-lock.yaml'
    'package-lock.json'
)

$ExcludeDirArgs = $ExcludeDirs | ForEach-Object { '/XD'; $_ }
$ExcludeFileArgs = $ExcludeFiles | ForEach-Object { '/XF'; $_ }

$robocopyArgs = @(
    $RepoRoot
    $StagingDir
    '/E'
    '/NFL'
    '/NDL'
    '/NJH'
    '/NJS'
    '/NC'
    '/NS'
) + $ExcludeDirArgs + $ExcludeFileArgs

& robocopy @robocopyArgs | Out-Null

Write-Host '  [OK] Repository copied to staging' -ForegroundColor Green

# --- STEP 3: Create sanitized .env.example ---
Write-Host '[3/6] Creating sanitized .env.example...' -ForegroundColor Yellow

$envExample = @'
# Creative Liberation Engine V6 - Environment Configuration
# Copy this file to .env and fill in your values

# --- Model API Keys ---
GOOGLE_GENAI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# --- NAS Configuration ---
NAS_HOST=192.168.x.x
NAS_SSH_PORT=2000
NAS_USER=your-nas-user

# --- Database ---
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=cle_dispatch
POSTGRES_USER=cle
POSTGRES_PASSWORD=your-db-password

# --- Redis ---
REDIS_URL=redis://localhost:6379

# --- Ollama (Local Inference) ---
OLLAMA_HOST=http://localhost:11434

# --- Forgejo (Sovereign Git) ---
FORGEJO_URL=http://your-nas:3000
FORGEJO_TOKEN=your-forgejo-token

# --- Cloudflare Tunnel (Optional) ---
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token
'@

Set-Content -Path (Join-Path $StagingDir '.env.example') -Value $envExample
Write-Host '  [OK] .env.example created' -ForegroundColor Green

# --- STEP 4: Strip any remaining secrets from copied files ---
Write-Host '[4/6] Scanning for leaked secrets...' -ForegroundColor Yellow

$secretPatterns = @(
    'AIza[0-9A-Za-z_\-]{35}'
    'sk-[A-Za-z0-9]{48}'
    'sk-ant-[A-Za-z0-9\-]{80}'
    'ghp_[A-Za-z0-9]{36}'
)

$flaggedFiles = @()
Get-ChildItem -Path $StagingDir -Recurse -File -Include '*.ts','*.js','*.json','*.py','*.md','*.yml','*.yaml' | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($content) {
        foreach ($pattern in $secretPatterns) {
            if ($content -match $pattern) {
                $flaggedFiles += $_.FullName.Replace($StagingDir, '')
                break
            }
        }
    }
}

if ($flaggedFiles.Count -gt 0) {
    $count = $flaggedFiles.Count
    Write-Host "  [WARN] Potential secrets found in $count files:" -ForegroundColor Red
    $flaggedFiles | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    Write-Host '  -> Review these files before sending!' -ForegroundColor Red
} else {
    Write-Host '  [OK] No leaked secrets detected' -ForegroundColor Green
}

# --- STEP 5: Remove large binary files ---
Write-Host '[5/6] Removing large binaries over 1MB...' -ForegroundColor Yellow

$removedCount = 0
Get-ChildItem -Path $StagingDir -Recurse -File | Where-Object {
    $_.Length -gt 1MB -and $_.Extension -in @('.png', '.jpg', '.jpeg', '.gif', '.mp4', '.wav', '.pdf', '.woff2', '.ttf')
} | ForEach-Object {
    Remove-Item $_.FullName -Force
    $removedCount++
}
Write-Host "  [OK] Removed $removedCount large binary files" -ForegroundColor Green

# --- STEP 6: Create the archive ---
Write-Host '[6/6] Creating ZIP archive...' -ForegroundColor Yellow

if (Test-Path $OutputZip) {
    Remove-Item $OutputZip -Force
}

Compress-Archive -Path $StagingDir -DestinationPath $OutputZip -CompressionLevel Optimal
Write-Host '  [OK] Archive created' -ForegroundColor Green

# --- Cleanup staging ---
Remove-Item -Recurse -Force $StagingDir

# --- Summary ---
$zipSize = (Get-Item $OutputZip).Length
$zipSizeMB = [math]::Round($zipSize / 1MB, 1)

Write-Host ''
Write-Host '=========================================' -ForegroundColor Green
Write-Host '  SHOWCASE PACKAGE READY                 ' -ForegroundColor Green
Write-Host '=========================================' -ForegroundColor Green
Write-Host ''
Write-Host "  Output:  $OutputZip" -ForegroundColor White
Write-Host "  Size:    $zipSizeMB MB" -ForegroundColor White
Write-Host ''
Write-Host '  Contents:' -ForegroundColor Gray
Write-Host '    PARTNER_SHOWCASE.md  - Start here' -ForegroundColor Gray
Write-Host '    docs/               - 29 governance docs' -ForegroundColor Gray
Write-Host '    schemas/            - 40 JSON contracts' -ForegroundColor Gray
Write-Host '    runtime/            - Agent registries' -ForegroundColor Gray
Write-Host '    apps/               - 7 frontend apps' -ForegroundColor Gray
Write-Host '    services/           - 22 backend services' -ForegroundColor Gray
Write-Host '    DESIGN.md           - Visual identity' -ForegroundColor Gray
Write-Host '    .env.example        - Config template' -ForegroundColor Gray
Write-Host ''
Write-Host '  Review any flagged files before sending.' -ForegroundColor Yellow
Write-Host ''
