import time
import sys
import os
import re
from playwright.sync_api import sync_playwright

EMAIL = "inquiries@creativeliberationengine.org"
PASSWORD = "WholeTroutMedia!2026"
SHOP_HANDLE = "latent-space-studios"
OUTPUT_DIR = "/app/data"
TOKEN_FILE = os.path.join(OUTPUT_DIR, "shopify_token.txt")

def fetch_latest_shopify_code():
    import imaplib
    import email
    username = "inquiries@creativeliberationengine.org"
    password = "WholeTroutMedia!2026"
    print("[EMAIL] Connecting to IMAP...")
    for attempt in range(25):
        try:
            print(f"[EMAIL] Checking inbox, attempt {attempt + 1}/25...")
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
                            print(f"[EMAIL SUCCESS] Found verification code: {codes[0]}")
                            mail.close()
                            mail.logout()
                            return codes[0]
            mail.close()
            mail.logout()
        except Exception as e:
            print(f"[EMAIL] IMAP failed: {e}")
        time.sleep(5)
    return ""

def main():
    print("=============================================================")
    print("CLE ENGINE SYSTEMS: PLAYWRIGHT HEADLESS PROVISIONING")
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
        
        # Inject navigator.webdriver bypass script before any page loads
        print("[PROVISION] Injecting navigator.webdriver bypass...")
        context.add_init_script("delete navigator.__proto__.webdriver;")
        
        # Apply Stealth
        try:
            from playwright_stealth import Stealth
            Stealth().apply_stealth_sync(context)
            print("[PROVISION] Stealth applied successfully.")
        except Exception as e:
            print(f"[PROVISION WARNING] Failed to apply stealth: {e}. Proceeding without it.")

        page = context.new_page()
        
        target_url = f"https://admin.shopify.com/store/{SHOP_HANDLE}/settings/apps/development"
        print(f"[PROVISION] Deep-linking directly to target URL: {target_url}")
        page.goto(target_url, wait_until="commit")
        print("[PROVISION] Page loaded, waiting for email entry elements...")
        page.wait_for_timeout(8000)
        
        try:
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_1_load.png", timeout=5000)
        except Exception:
            pass
        print(f"Loaded URL: {page.url} | Title: {page.title()}")

        # Unique elements for email
        email_selector = '#account_email'
        email_selector_alt = 'input[type="email"]'
        
        # Determine unique locator
        email_locator = None
        if page.locator(email_selector).count() > 0:
            email_locator = page.locator(email_selector).first
        elif page.locator(email_selector_alt).count() > 0:
            email_locator = page.locator(email_selector_alt).first
            
        if "login" in page.url or "identity" in page.url or email_locator is not None:
            print("[PROVISION] Entering email credentials...")
            if email_locator is None:
                page.wait_for_selector(email_selector_alt, timeout=20000)
                email_locator = page.locator(email_selector_alt).first
            
            # Bypassing React and typing email slowly to trigger listeners naturally
            print("[PROVISION] Locating email input field and typing...")
            email_input = page.locator('#account_email, input[type="email"]').first
            email_input.wait_for(state="visible", timeout=20000)
            email_input.clear()
            email_input.type(EMAIL, delay=50)
            try:
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_2_email.png", timeout=5000)
            except Exception:
                pass
            
            # Click the visible Continue button by explicit text targeting to avoid refresh buttons
            print("[PROVISION] Clicking Continue with email button...")
            continue_btn = page.locator('button:has-text("Continue with email")').first
            continue_btn.click()
            page.wait_for_timeout(5000)
            
            try:
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_2.5_after_email.png", timeout=5000)
            except Exception:
                pass
            
            # Wait for VISIBLE password input
            print("[PROVISION] Waiting for visible password input field...")
            pwd_selector_visible = 'input[type="password"]:visible'
            page.wait_for_selector(pwd_selector_visible, timeout=25000)
            
            # Wait for VISIBLE password input and type slowly
            print("[PROVISION] Locating password input field and typing...")
            pwd_input = page.locator('#account_password, input[type="password"]').first
            pwd_input.wait_for(state="visible", timeout=25000)
            pwd_input.clear()
            pwd_input.type(PASSWORD, delay=50)
            try:
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_3_password.png", timeout=5000)
            except Exception:
                pass
            
            # Click the visible login button by text
            print("[PROVISION] Clicking submit password button...")
            login_btn = page.locator('button:has-text("Log in"), button:has-text("Log in — Shopify"), button[name="commit"]').first
            login_btn.click()
            page.wait_for_timeout(10000)
            
            try:
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_4_login_result.png", timeout=5000)
            except Exception:
                pass
                
            print("[PROVISION] Credentials submitted. Waiting for transition...")
            page.wait_for_timeout(10000)
            
            try:
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_4_login_result.png", timeout=5000)
            except Exception:
                pass
            print(f"Current URL: {page.url}")
            
            # Dismiss passkey prompt if it is showing
            page.wait_for_timeout(4000)
            not_now_selectors = [
                'button:has-text("Not now")',
                'text=Not now',
                'button:text("Not now")',
                '.ui-button:has-text("Not now")'
            ]
            for sel in not_now_selectors:
                try:
                    btns = page.locator(sel)
                    if btns.count() > 0:
                        print(f"[PROVISION] Found Passkey Not Now button: {sel}. Clicking...")
                        btns.first.click()
                        page.wait_for_timeout(6000)
                        try:
                            page.screenshot(path=f"{OUTPUT_DIR}/shopify_4_login_passkey_dismissed.png", timeout=5000)
                        except Exception:
                            pass
                        break
                except Exception:
                    pass
            
            # Look for 2FA/verification code selector
            code_selector = 'input[autocomplete="one-time-code"], input[name="code"], input[id="auth-code"]'
            if page.locator(code_selector).count() > 0:
                print("[PROVISION CHALLENGE] Shopify email confirmation challenge triggered! Fetching code via IMAP...")
                verification_code = fetch_latest_shopify_code()
                if verification_code:
                    print(f"[PROVISION] Entering code: {verification_code}")
                    page.fill(code_selector, verification_code)
                    try:
                        page.screenshot(path=f"{OUTPUT_DIR}/shopify_challenge_code_entered.png", timeout=5000)
                    except Exception:
                        pass
                    page.keyboard.press("Enter")
                    page.wait_for_timeout(10000)
                else:
                    print("[PROVISION ERROR] Failed to fetch verification code from email.")
                    browser.close()
                    sys.exit(1)

        # Confirm we are logged in - Wait for redirect to finish naturally!
        print("[PROVISION] Waiting for settings URL redirect...")
        try:
            page.wait_for_url("**/settings/apps/development*", timeout=45000)
            print("[PROVISION] Successfully reached settings URL!")
        except Exception:
            print("[PROVISION WARNING] Auto-redirect timed out. Forcing page navigation...")
            page.goto(target_url, wait_until="commit")
            
        page.wait_for_timeout(5000)
        
        # Robustly wait for the actual SPA content to mount (using CSS has-text with comma)
        print("[PROVISION] Waiting for Settings page content elements to mount...")
        try:
            page.wait_for_selector('button:has-text("Allow custom app development"), button:has-text("Create an app"), h1:has-text("App development")', timeout=50000)
            print("[PROVISION] SPA content loaded successfully!")
        except Exception as e:
            print(f"[PROVISION WARNING] Waiting for main elements timed out: {e}. Attempting single recovery refresh...")
            page.reload()
            page.wait_for_timeout(15000)
            
        try:
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_5_settings.png", timeout=5000)
        except Exception:
            pass
        print(f"Active Page URL: {page.url} | Title: {page.title()}")
        
        # Check if Dev Dashboard button is present
        dashboard_btn = page.locator('button:has-text("Build apps in Dev Dashboard")')
        if dashboard_btn.count() > 0:
            print("[PROVISION] Found 'Build apps in Dev Dashboard' button. Clicking...")
            try:
                with context.expect_page(timeout=5000) as event_info:
                    dashboard_btn.first.click()
                page = event_info.value
                print("[PROVISION] Opened in new page/tab.")
            except Exception:
                print("[PROVISION] Clicking navigated current page or timed out tab check.")
            
            page.wait_for_timeout(10000)
            try:
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_5.5_dev_dashboard.png", timeout=5000)
            except Exception:
                pass
            print(f"Current page URL: {page.url} | Title: {page.title()}")
        
        # Check if custom app development needs to be enabled
        allow_btn = page.locator('button:has-text("Allow custom app development")')
        if allow_btn.count() > 0:
            print("[PROVISION] Allowing custom app development...")
            allow_btn.first.click()
            page.wait_for_timeout(2000)
            page.locator('button:has-text("Allow custom app development")').first.click()
            page.wait_for_timeout(5000)
            try:
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_6_allowed.png", timeout=5000)
            except Exception:
                pass

        # Create Custom App "Creative Liberation Collective"
        create_app_btn = page.locator('button:has-text("Create an app")')
        if create_app_btn.count() > 0:
            print("[PROVISION] Clicking Create an App...")
            create_app_btn.first.click()
            page.wait_for_timeout(3000)
            
            page.fill('input[placeholder="App name"]', "Creative Liberation Collective")
            page.wait_for_timeout(1000)
            
            page.locator('button:has-text("Create app")').first.click()
            page.wait_for_timeout(8000)
            try:
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_7_app_created.png", timeout=5000)
            except Exception:
                pass

        # Open "Creative Liberation Collective" details
        page.goto(target_url, wait_until="commit")
        page.wait_for_timeout(6000)
        
        app_row = page.locator('text=Creative Liberation Collective')
        if app_row.count() > 0:
            print("[PROVISION] Opening Creative Liberation Collective App...")
            app_row.first.click()
            page.wait_for_timeout(6000)
            try:
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_8_app_details.png", timeout=5000)
            except Exception:
                pass
        else:
            print("[PROVISION ERROR] App row not found after creation attempt.")
            browser.close()
            sys.exit(1)

        # Configure API scopes
        config_scopes_btn = page.locator('button:has-text("Configure Admin API scopes")')
        if config_scopes_btn.count() > 0:
            print("[PROVISION] Opening API Scopes configuration...")
            config_scopes_btn.first.click()
            page.wait_for_timeout(6000)
            try:
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_9_scopes.png", timeout=5000)
            except Exception:
                pass
            
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
                try:
                    page.screenshot(path=f"{OUTPUT_DIR}/shopify_10_scopes_saved.png", timeout=5000)
                except Exception:
                    pass

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
                try:
                    page.screenshot(path=f"{OUTPUT_DIR}/shopify_11_installed.png", timeout=5000)
                except Exception:
                    pass

        # Extract and Reveal Access Token
        reveal_btn = page.locator('button:has-text("Reveal token once")')
        if reveal_btn.count() > 0:
            print("[PROVISION] Revealing Access Token...")
            reveal_btn.click()
            page.wait_for_timeout(2000)
            try:
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_12_token_revealed.png", timeout=5000)
            except Exception:
                pass

        # Search for token input value
        token_input = page.locator('input[value^="shpat_"]')
        if token_input.count() > 0:
            token = token_input.get_attribute("value")
            print(f"\n[PROVISION SUCCESS] Access Token successfully extracted: {token[:12]}...")
            with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                f.write(token)
            print(f"[PROVISION] Saved to persistent path: {TOKEN_FILE}")
        else:
            token_input_alt = page.locator('input[type="password"]')
            for idx in range(token_input_alt.count()):
                val = token_input_alt.nth(idx).get_attribute("value")
                if val and val.startswith("shpat_"):
                    print(f"\n[PROVISION SUCCESS] Access Token found: {val[:12]}...")
                    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                        f.write(val)
                    print(f"[PROVISION] Saved to persistent path: {TOKEN_FILE}")
                    break

        print("=============================================================")
        print("CLE ENGINE SYSTEMS: PLAYWRIGHT PROVISIONING COMPLETE")
        print("=============================================================")
        browser.close()

if __name__ == "__main__":
    main()
