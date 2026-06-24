"""
CORTEX Google OAuth Automation Agent
Drives Chromium through the Google OAuth consent flow for inquiries@creativeliberationengine.org.
Stores tokens in the Antigravity MCP bridge (localhost:8000).
"""
import asyncio
import sys
from playwright.async_api import async_playwright

async def complete_oauth(oauth_url: str, email: str, password: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=500)
        context = await browser.new_context()
        page = await context.new_page()

        print(f"[CORTEX-OAUTH] Navigating to OAuth URL...")
        await page.goto(oauth_url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # --- Account Chooser or Sign-In ---
        try:
            cortex_account = page.locator(f'text={email}').first
            if await cortex_account.is_visible(timeout=3000):
                print(f"[CORTEX-OAUTH] Found {email} in account chooser, clicking...")
                await cortex_account.click()
                await page.wait_for_timeout(2000)
            else:
                raise Exception("Account not in list")
        except:
            try:
                use_another = page.locator('text=Use another account').first
                if await use_another.is_visible(timeout=2000):
                    print("[CORTEX-OAUTH] Clicking 'Use another account'...")
                    await use_another.click()
                    await page.wait_for_timeout(2000)
            except:
                pass

            try:
                email_input = page.locator('input[type="email"]').first
                if await email_input.is_visible(timeout=3000):
                    print(f"[CORTEX-OAUTH] Entering email: {email}")
                    await email_input.fill(email)
                    await page.locator('button:has-text("Next")').first.click()
                    await page.wait_for_timeout(3000)
            except:
                pass

        # --- Password Entry ---
        try:
            password_input = page.locator('input[type="password"]').first
            if await password_input.is_visible(timeout=5000):
                print("[CORTEX-OAUTH] Entering password...")
                await password_input.fill(password)
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
                unsafe_link = page.locator('a:has-text("Go to")').first
                if await unsafe_link.is_visible(timeout=2000):
                    await unsafe_link.click()
                    await page.wait_for_timeout(2000)
        except:
            pass

        # --- Consent Screen: Grant Permissions ---
        try:
            select_all = page.locator('text=Select all').first
            if await select_all.is_visible(timeout=3000):
                print("[CORTEX-OAUTH] Checking 'Select all' permissions...")
                await select_all.click()
                await page.wait_for_timeout(1000)
        except:
            pass

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

        # --- Handle second consent screen (Google sometimes shows two) ---
        await page.wait_for_timeout(2000)
        for button_text in ["Continue", "Allow", "Accept"]:
            try:
                btn = page.locator(f'button:has-text("{button_text}")').first
                if await btn.is_visible(timeout=2000):
                    print(f"[CORTEX-OAUTH] Second consent - clicking '{button_text}'...")
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
                body_text = await page.inner_text("body")
                print(f"[CORTEX-OAUTH] Page text: {body_text[:500]}")
            else:
                body_text = await page.inner_text("body")
                print(f"[CORTEX-OAUTH] Result: {body_text[:500]}")
        except:
            current_url = page.url
            print(f"[CORTEX-OAUTH] ⚠️ Did not redirect to localhost:8000. Current URL: {current_url}")
            body_text = await page.inner_text("body")
            print(f"[CORTEX-OAUTH] Page text: {body_text[:300]}")

        await page.wait_for_timeout(2000)
        await browser.close()

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python cortex_oauth_flow.py <oauth_url> <email> <password>")
        sys.exit(1)
    asyncio.run(complete_oauth(sys.argv[1], sys.argv[2], sys.argv[3]))
