import time
import sys
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

EMAIL = "inquiries@creativeliberationengine.org"
PASSWORD = "WholeTroutMedia!2026"
SHOP_HANDLE = "latent-space-studios"
OUTPUT_DIR = "/app/data"
TOKEN_FILE = os.path.join(OUTPUT_DIR, "shopify_token.txt")

def fetch_latest_shopify_code():
    import imaplib
    import email
    import re
    username = "inquiries@creativeliberationengine.org"
    password = "WholeTroutMedia!2026"
    print("[EMAIL] Connecting to inquiries@creativeliberationengine.org via IMAP...")
    for attempt in range(15):  # 75s max wait
        try:
            print(f"[EMAIL] Checking inbox, attempt {attempt + 1}/15...")
            mail = imaplib.IMAP4_SSL("imap.gmail.com")
            mail.login(username, password)
            mail.select("inbox")
            status, messages = mail.search(None, '(FROM "no-reply@shopify.com" OR SUBJECT "Shopify")')
            if status == "OK" and messages[0]:
                msg_ids = messages[0].split()
                latest_id = msg_ids[-1]
                res, msg_data = mail.fetch(latest_id, '(RFC822)')
                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        body = ""
                        if msg.is_multipart():
                            for part in msg.walk():
                                if part.get_content_type() in ["text/plain", "text/html"]:
                                    body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                                    break
                        else:
                            body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
                        
                        codes = re.findall(r'\b\d{6}\b', body)
                        if codes:
                            print(f"[EMAIL SUCCESS] Found verification code in email: {codes[0]}")
                            mail.close()
                            mail.logout()
                            return codes[0]
            mail.close()
            mail.logout()
        except Exception as e:
            print(f"[EMAIL] IMAP attempt failed: {e}")
        time.sleep(5)
    return ""

def main():
    print("=============================================================")
    print("CLE ENGINE SYSTEMS: PLAYWRIGHT SHOPIFY PROVISIONING RUN")
    print("=============================================================")
    
    with sync_playwright() as p:
        print("[PROVISION] Launching native headless Chromium...")
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale="en-US"
        )
        
        # Apply Stealth
        try:
            from playwright_stealth import Stealth
            Stealth().apply_stealth_sync(context)
            print("[PROVISION] Stealth applied successfully.")
        except Exception as e:
            print(f"[PROVISION WARNING] Failed to apply stealth: {e}. Proceeding without it.")

        page = context.new_page()
        
        # Deep-link directly with wait_until="commit" to avoid Cloudflare gating timeout
        target_url = f"https://admin.shopify.com/store/{SHOP_HANDLE}/settings/apps/development"
        print(f"[PROVISION] Deep-linking to settings: {target_url}")
        page.goto(target_url, wait_until="commit")
        print("[PROVISION] Initial response received, waiting for elements to load...")
        page.wait_for_timeout(8000)
        
        page.screenshot(path=f"{OUTPUT_DIR}/shopify_1_load.png")
        print(f"Loaded URL: {page.url} | Title: {page.title()}")

        # Check if Turnstile is present
        if "Just a moment..." in page.title() or page.locator("iframe[src*='turnstile']").count() > 0:
            print("[PROVISION WARNING] Cloudflare turnstile page detected! Waiting to see if stealth bypasses...")
            page.wait_for_timeout(8000)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_cloudflare_wait.png")
            print(f"URL after Cloudflare wait: {page.url} | Title: {page.title()}")

        # Check if login is required
        email_selector = '#account_email, input[type="email"]'
        if "login" in page.url or "identity" in page.url or "Just a moment..." in page.title() or page.locator(email_selector).count() > 0:
            print("[PROVISION] Entering email credentials...")
            
            page.wait_for_selector(email_selector, timeout=20000)
            page.fill(email_selector, EMAIL)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_2_email.png")
            page.keyboard.press("Enter")
            page.wait_for_timeout(5000)
            
            # Fill password
            pwd_selector = '#account_password, input[type="password"]'
            page.wait_for_selector(pwd_selector, timeout=20000)
            page.fill(pwd_selector, PASSWORD)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_3_password.png")
            page.keyboard.press("Enter")
            print("[PROVISION] Credentials submitted. Waiting for transition...")
            page.wait_for_timeout(10000)
            
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_4_login_result.png")
            print(f"Current URL: {page.url}")
            
            # Dismiss passkey prompt if it is showing (robust looping)
            page.wait_for_timeout(4000)
            not_now_selectors = [
                'button:has-text("Not now")',
                'text=Not now',
                'button:text("Not now")',
                '.ui-button:has-text("Not now")',
                'button'
            ]
            passkey_dismissed = False
            for sel in not_now_selectors:
                if passkey_dismissed:
                    break
                try:
                    btns = page.locator(sel)
                    for idx in range(btns.count()):
                        txt = btns.nth(idx).text_content()
                        if txt and "Not now" in txt:
                            print(f"[PROVISION] Found 'Not now' button. Clicking...")
                            btns.nth(idx).hover()
                            btns.nth(idx).click()
                            page.wait_for_timeout(6000)
                            page.screenshot(path=f"{OUTPUT_DIR}/shopify_4_login_passkey_dismissed.png")
                            passkey_dismissed = True
                            break
                except Exception as e:
                    print(f"Not now check failed for {sel}: {e}")
            
            # Look for 2FA/verification code selector
            code_selector = 'input[autocomplete="one-time-code"], input[name="code"], input[id="auth-code"]'
            if page.locator(code_selector).count() > 0:
                print("[PROVISION CHALLENGE] Shopify email confirmation challenge triggered! Fetching code via IMAP...")
                verification_code = fetch_latest_shopify_code()
                if verification_code:
                    print(f"[PROVISION] Entering code: {verification_code}")
                    page.fill(code_selector, verification_code)
                    page.screenshot(path=f"{OUTPUT_DIR}/shopify_challenge_code_entered.png")
                    page.keyboard.press("Enter")
                    page.wait_for_timeout(10000)
                else:
                    print("[PROVISION ERROR] Failed to fetch verification code from email.")
                    browser.close()
                    sys.exit(1)

        # Confirm we are logged in
        if "settings/apps/development" not in page.url:
            print("[PROVISION] Re-routing to target settings page...")
            page.goto(target_url, wait_until="commit")
            page.wait_for_timeout(8000)
            
        page.screenshot(path=f"{OUTPUT_DIR}/shopify_5_settings.png")
        print(f"Active Page URL: {page.url} | Title: {page.title()}")
        
        # Check if custom app development needs to be enabled
        allow_btn = page.locator('text="Allow custom app development"')
        if allow_btn.count() > 0:
            print("[PROVISION] Allowing custom app development...")
            allow_btn.first.click()
            page.wait_for_timeout(2000)
            # Confirm modal
            page.locator('button:has-text("Allow custom app development")').first.click()
            page.wait_for_timeout(5000)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_6_allowed.png")

        # Create Custom App "Creative Liberation Collective"
        create_app_btn = page.locator('text="Create an app"')
        if create_app_btn.count() > 0:
            print("[PROVISION] Clicking Create an App...")
            create_app_btn.first.click()
            page.wait_for_timeout(3000)
            
            # Fill app name
            page.fill('input[placeholder="App name"]', "Creative Liberation Collective")
            page.wait_for_timeout(1000)
            
            # Confirm create
            page.locator('button:has-text("Create app")').first.click()
            page.wait_for_timeout(8000)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_7_app_created.png")

        # Open "Creative Liberation Collective" details
        # Refresh the page to reload registry
        page.goto(target_url, wait_until="commit")
        page.wait_for_timeout(6000)
        
        app_row = page.locator('text="Creative Liberation Collective"')
        if app_row.count() > 0:
            print("[PROVISION] Opening Creative Liberation Collective App...")
            app_row.first.click()
            page.wait_for_timeout(6000)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_8_app_details.png")
        else:
            print("[PROVISION ERROR] App row not found after creation attempt.")
            browser.close()
            sys.exit(1)

        # Configure API scopes
        config_scopes_btn = page.locator('text="Configure Admin API scopes"')
        if config_scopes_btn.count() > 0:
            print("[PROVISION] Opening API Scopes configuration...")
            config_scopes_btn.first.click()
            page.wait_for_timeout(6000)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_9_scopes.png")
            
            # Check the required scope checkboxes
            target_scopes = ["write_products", "read_products", "write_inventory", "read_inventory", "write_orders", "read_orders"]
            for scope in target_scopes:
                checkbox = page.locator(f'input[id="{scope}"]')
                if checkbox.count() > 0 and not checkbox.is_checked():
                    checkbox.check()
                    print(f"Checked scope: {scope}")
            
            page.wait_for_timeout(2000)
            save_btn = page.locator('button:has-text("Save")')
            if save_btn.count() > 0:
                save_btn.click()
                print("[PROVISION] API scopes saved.")
                page.wait_for_timeout(6000)
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_10_scopes_saved.png")

        # Install App
        install_btn = page.locator('button:has-text("Install app")')
        if install_btn.count() > 0:
            print("[PROVISION] Clicking Install App...")
            install_btn.click()
            page.wait_for_timeout(2000)
            confirm_install = page.locator('button:has-text("Install")')
            if confirm_install.count() > 0:
                confirm_install.click()
                print("[PROVISION] Install confirmed.")
                page.wait_for_timeout(8000)
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_11_installed.png")

        # Extract and Reveal Access Token
        reveal_btn = page.locator('button:has-text("Reveal token once")')
        if reveal_btn.count() > 0:
            print("[PROVISION] Revealing Access Token...")
            reveal_btn.click()
            page.wait_for_timeout(2000)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_12_token_revealed.png")

        # Search for token input value
        token_input = page.locator('input[value^="shpat_"]')
        if token_input.count() > 0:
            token = token_input.get_attribute("value")
            print(f"\n[PROVISION SUCCESS] Access Token successfully extracted: {token[:12]}...")
            
            # Save the token to local file
            with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                f.write(token)
            print(f"[PROVISION] Saved to persistent path: {TOKEN_FILE}")
        else:
            print("[PROVISION WARNING] Access token input not found. App might already be installed.")
            # Search if token is already visible
            token_input_alt = page.locator('input[type="password"]')
            # If revealed, value starts with shpat_
            for idx in range(token_input_alt.count()):
                val = token_input_alt.nth(idx).get_attribute("value")
                if val and val.startswith("shpat_"):
                    print(f"\n[PROVISION SUCCESS] Access Token found: {val[:12]}...")
                    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                        f.write(val)
                    print(f"[PROVISION] Saved to persistent path: {TOKEN_FILE}")
                    break

        print("=============================================================")
        print("CLE ENGINE SYSTEMS: PLAYWRIGHT SHOPIFY PROVISIONING COMPLETE")
        print("=============================================================")
        browser.close()

if __name__ == "__main__":
    main()
