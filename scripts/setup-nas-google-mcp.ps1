<#
.SYNOPSIS
    Deploys the native Google Workspace MCP server to the NAS Docker stack.
.DESCRIPTION
    1. Verifies that Google OAuth credentials exist in the .env file.
    2. Runs test-google-oauth.js to ensure the tokens are valid and working.
    3. Git commits the code changes and pushes them to the NAS Forgejo repo,
       triggering the CI/CD pipeline to rebuild and redeploy the service.
#>

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  GOOGLE WORKSPACE NATIVE NAS MCP DEPLOYMENT SETUP" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Credential Check ---
Write-Host "[1/3] Checking environment credentials..." -ForegroundColor Yellow

$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ Error: .env file not found at $envFile" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $envFile -Raw
$hasClientId = $envContent -match "GMAIL_CLIENT_ID|GOOGLE_OAUTH_CLIENT_ID"
$hasSecret = $envContent -match "GMAIL_CLIENT_SECRET|GOOGLE_OAUTH_CLIENT_SECRET"
$hasToken = $envContent -match "GMAIL_REFRESH_TOKEN"

if (-not ($hasClientId -and $hasSecret -and $hasToken)) {
    Write-Host "❌ Error: Missing Google OAuth credentials in your .env file!" -ForegroundColor Red
    Write-Host "Please populate GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN." -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Credentials found in .env." -ForegroundColor Green

# --- 2. Live API Test ---
Write-Host ""
Write-Host "[2/3] Verifying API authorization against Google..." -ForegroundColor Yellow
Write-Host "Running diagnostic script..." -ForegroundColor Gray

# Run test-google-oauth.js
node (Join-Path $PSScriptRoot "test-google-oauth.js")
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Error: Google API authorization test failed. Aborting deployment." -ForegroundColor Red
    Write-Host "Please fix your credentials in .env first." -ForegroundColor Yellow
    exit 1
}

# --- 3. Trigger NAS Deployment ---
Write-Host ""
Write-Host "[3/3] Credentials verified. Deploying to NAS..." -ForegroundColor Yellow

# Stage the modified files
Write-Host "Staging files..." -ForegroundColor Gray
git add (Join-Path $PSScriptRoot "..\services\google-workspace-mesh-bridge\package.json")
git add (Join-Path $PSScriptRoot "..\services\google-workspace-mesh-bridge\server.js")
git add (Join-Path $PSScriptRoot "..\services\google-workspace-mesh-bridge\Dockerfile")
git add (Join-Path $PSScriptRoot "..\docker-compose.nas.yml")
git add (Join-Path $PSScriptRoot "test-google-oauth.js")
git add $MyInvocation.MyCommand.Path

# Commit changes
Write-Host "Committing changes..." -ForegroundColor Gray
$commitMessage = "feat(google-mcp): native Google Workspace MCP deployment on NAS"
git commit -m $commitMessage

# Push to Forgejo to trigger CI/CD pipeline
Write-Host "Pushing to Forgejo remote to trigger CI/CD build..." -ForegroundColor Gray
git push
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Git push failed. Please verify your connection to the Forgejo server." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 SUCCESS! The changes have been pushed." -ForegroundColor Green
Write-Host "The NAS Forgejo runner is now rebuilding the 'google-workspace-mesh-bridge' container" -ForegroundColor Green
Write-Host "to run your Google Workspace MCP server natively on the NAS. Check Gitea actions for status." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
