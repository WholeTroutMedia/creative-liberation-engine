<#
.SYNOPSIS
    Automates Google OAuth2 consent flow for inquiries@creativeliberationengine.org
    against the Antigravity Google Workspace MCP bridge (localhost:8000).

.DESCRIPTION
    Uses Playwright (Python) to drive a real Chromium browser through the
    Google OAuth consent screen. This stores tokens in the MCP bridge so
    Antigravity can operate Google Workspace as CORTEX without manual
    browser interaction.

.NOTES
    Run this ONCE after adding CORTEX to the Google family / workspace.
    The MCP bridge (localhost:8000) must be running when this executes.
#>

param(
    [string]$OAuthUrl = "",
    [string]$Email = "inquiries@creativeliberationengine.org",
    [string]$Password = "WholeTroutMedia!2026"
)

$ErrorActionPreference = "Stop"

# --- Ensure Python + Playwright available locally ---
$pythonScript = @"
import asyncio
import sys
from playwright.async_api import async_playwright

OAUTH_URL = sys.argv[1]
EMAIL = sys.argv[2]
PASSWORD = sys.argv[3]

async def complete_oauth():
    async with async_playwright() as p:
        # Launch visible browser so we can debug if needed
        browser = await p.chromium.launch(headless=False, slow_mo=500)
        context = await browser.new_context()
        page = await context.new_page()

        print(f"[CORTEX-OAUTH] Navigating to OAuth URL...")
        await page.goto(OAUTH_URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # --- Account Chooser or Sign-In ---
        # Check if we see an account chooser
        try:
            # Look for "Use another account" or the email in the list
            cortex_account = page.locator(f'text={EMAIL}').first
            if await cortex_account.is_visible(timeout=3000):
                print(f"[CORTEX-OAUTH] Found {EMAIL} in account chooser, clicking...")
                await cortex_account.click()
                await page.wait_for_timeout(2000)
            else:
                raise Exception("Account not in list")
        except:
            # Try "Use another account"
            try:
                use_another = page.locator('text=Use another account').first
                if await use_another.is_visible(timeout=2000):
                    print("[CORTEX-OAUTH] Clicking 'Use another account'...")
                    await use_another.click()
                    await page.wait_for_timeout(2000)
            except:
                pass

            # Enter email if field is visible
            try:
                email_input = page.locator('input[type="email"]').first
                if await email_input.is_visible(timeout=3000):
                    print(f"[CORTEX-OAUTH] Entering email: {EMAIL}")
                    await email_input.fill(EMAIL)
                    await page.locator('button:has-text("Next")').first.click()
                    await page.wait_for_timeout(3000)
            except:
                pass

        # --- Password Entry ---
        try:
            password_input = page.locator('input[type="password"]').first
            if await password_input.is_visible(timeout=5000):
                print("[CORTEX-OAUTH] Entering password...")
                await password_input.fill(PASSWORD)
                await page.locator('button:has-text("Next")').first.click()
                await page.wait_for_timeout(3000)
        except:
            print("[CORTEX-OAUTH] No password field found, may already be signed in")

        # --- Handle "This app isn't verified" warning ---
        try:
            advanced_link = page.locator('text=Advanced').first
            if await advanced_link.is_visible(timeout=3000):
                print("[CORTEX-OAUTH] App not verified warning - clicking Advanced...")
                await advanced_link.click()
                await page.wait_for_timeout(1000)
                # Click "Go to Creative Liberation Engine (unsafe)"
                unsafe_link = page.locator('a:has-text("Go to")').first
                if await unsafe_link.is_visible(timeout=2000):
                    await unsafe_link.click()
                    await page.wait_for_timeout(2000)
        except:
            pass

        # --- Consent Screen: Grant Permissions ---
        try:
            # Check for "Select all" checkbox
            select_all = page.locator('text=Select all').first
            if await select_all.is_visible(timeout=3000):
                print("[CORTEX-OAUTH] Checking 'Select all' permissions...")
                await select_all.click()
                await page.wait_for_timeout(1000)
        except:
            pass

        # Click Continue/Allow
        for button_text in ["Continue", "Allow", "Accept"]:
            try:
                btn = page.locator(f'button:has-text("{button_text}")').first
                if await btn.is_visible(timeout=2000):
                    print(f"[CORTEX-OAUTH] Clicking '{button_text}'...")
                    await btn.click()
                    await page.wait_for_timeout(3000)
                    break
            except:
                continue

        # --- Wait for redirect to localhost:8000 ---
        print("[CORTEX-OAUTH] Waiting for OAuth callback redirect...")
        try:
            await page.wait_for_url("http://localhost:8000/**", timeout=15000)
            final_url = page.url
            final_content = await page.content()
            print(f"[CORTEX-OAUTH] Redirected to: {final_url}")

            if "success" in final_content.lower() or "authenticated" in final_content.lower():
                print("[CORTEX-OAUTH] ✅ OAuth authorization SUCCESSFUL!")
            elif "error" in final_content.lower():
                print(f"[CORTEX-OAUTH] ❌ OAuth callback returned an error.")
                print(f"[CORTEX-OAUTH] Page content snippet: {final_content[:500]}")
            else:
                print(f"[CORTEX-OAUTH] ⚠️ Unclear result. Page content: {final_content[:500]}")
        except:
            current_url = page.url
            print(f"[CORTEX-OAUTH] ⚠️ Did not redirect to localhost:8000. Current URL: {current_url}")
            await page.screenshot(path="oauth_debug_screenshot.png")
            print("[CORTEX-OAUTH] Debug screenshot saved to oauth_debug_screenshot.png")

        await page.wait_for_timeout(2000)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(complete_oauth())
"@

# Write the Python script to a temp location in the workspace
$scriptPath = Join-Path $PSScriptRoot "cortex_oauth_flow.py"
$pythonScript | Set-Content -Path $scriptPath -Encoding UTF8

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CORTEX Google OAuth Automation Agent" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if (-not $OAuthUrl) {
    Write-Host "[ERROR] No OAuth URL provided." -ForegroundColor Red
    Write-Host "Usage: .\cortex-google-oauth.ps1 -OAuthUrl 'https://accounts.google.com/o/oauth2/auth?...'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The OAuth URL is generated by Antigravity when it tries to access" -ForegroundColor Gray
    Write-Host "Google services for inquiries@creativeliberationengine.org." -ForegroundColor Gray
    exit 1
}

Write-Host "[1/3] Checking Playwright installation..." -ForegroundColor Yellow
python -m playwright install chromium 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] Playwright not installed. Installing..." -ForegroundColor Yellow
    pip install playwright
    python -m playwright install chromium
}

Write-Host "[2/3] Verifying MCP bridge at localhost:8000..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "[OK] MCP bridge is responding." -ForegroundColor Green
} catch {
    Write-Host "[WARN] localhost:8000 may not be responding. Proceeding anyway..." -ForegroundColor Yellow
}

Write-Host "[3/3] Launching OAuth flow..." -ForegroundColor Yellow
python $scriptPath $OAuthUrl $Email $Password

Write-Host ""
Write-Host "Done. If successful, Antigravity can now use Google Workspace as CORTEX." -ForegroundColor Green
