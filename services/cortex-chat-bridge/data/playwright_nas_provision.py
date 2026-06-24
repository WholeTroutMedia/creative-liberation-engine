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
    for attempt in range(20):
        try:
            print(f"[EMAIL] Checking inbox, attempt {attempt + 1}/20...")
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
    print("CLE ENGINE SYSTEMS: PLAYWRIGHT NAS CDP PROVISIONING")
    print("=============================================================")
    
    with sync_playwright() as p:
        print("[PROVISION] Connecting to NAS browser over CDP...")
        try:
            browser = p.chromium.connect_over_cdp("http://cortex-browser:9224")
            print("[PROVISION] Connected to browser over CDP successfully.")
        except Exception as e:
            print(f"[PROVISION ERROR] Failed to connect to CDP: {e}")
            sys.exit(1)
            
        context = browser.contexts[0] if browser.contexts else browser.new_context()
        page = context.pages[0] if context.pages else context.new_page()
        page.set_viewport_size({"width": 1440, "height": 900})
        
        target_url = f"https://admin.shopify.com/store/{SHOP_HANDLE}/settings/apps/development"
        print(f"[PROVISION] Navigating to target: {target_url}")
        page.goto(target_url, wait_until="commit")
        page.wait_for_timeout(8000)
        
        page.screenshot(path=f"{OUTPUT_DIR}/shopify_1_load.png")
        print(f"Current URL: {page.url} | Title: {page.title()}")
        
        email_sel = 'input[type="email"], #account_email'
        if page.locator(email_sel).count() > 0:
            print("[PROVISION] Email input found. Filling email...")
            page.fill(email_sel, EMAIL)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_2_email.png")
            
            submit_btn = page.locator('button[type="submit"], button:has-text("Continue with email"), button[name="commit"]')
            if submit_btn.count() > 0:
                print("[PROVISION] Clicking continue button...")
                submit_btn.first.click()
            else:
                print("[PROVISION] Button not found. Pressing Enter...")
                page.keyboard.press("Enter")
                
            page.wait_for_timeout(5000)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_2.5_after_email.png")
            
            pwd_sel = 'input[type="password"], #account_password'
            try:
                page.wait_for_selector(pwd_sel, timeout=15000)
                print("[PROVISION] Password input found. Filling password...")
                page.fill(pwd_sel, PASSWORD)
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_3_password.png")
                
                login_btn = page.locator('button[type="submit"], button:has-text("Log in"), button[name="commit"]')
                if login_btn.count() > 0:
                    print("[PROVISION] Clicking login button...")
                    login_btn.first.click()
                else:
                    print("[PROVISION] Login button not found. Pressing Enter...")
                    page.keyboard.press("Enter")
            except Exception as e:
                print(f"[PROVISION WARNING] Password transition issue: {e}")
                
            page.wait_for_timeout(10000)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_4_login_result.png")
            print(f"URL after credentials: {page.url}")
            
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
                        page.screenshot(path=f"{OUTPUT_DIR}/shopify_4_login_passkey_dismissed.png")
                        break
                except Exception:
                    pass

            code_sel = 'input[autocomplete="one-time-code"], input[name="code"], input[id="auth-code"]'
            if page.locator(code_sel).count() > 0:
                print("[PROVISION CHALLENGE] 2FA required! Fetching code via IMAP...")
                code = fetch_latest_shopify_code()
                if code:
                    print(f"[PROVISION] Entering verification code: {code}")
                    page.fill(code_sel, code)
                    page.screenshot(path=f"{OUTPUT_DIR}/shopify_challenge_code_entered.png")
                    page.keyboard.press("Enter")
                    page.wait_for_timeout(10000)
                else:
                    print("[PROVISION ERROR] Verification code not retrieved.")
                    browser.close()
                    sys.exit(1)

        if "settings/apps/development" not in page.url:
            print("[PROVISION] Re-routing to settings page...")
            page.goto(target_url, wait_until="commit")
            page.wait_for_timeout(8000)
            
        page.screenshot(path=f"{OUTPUT_DIR}/shopify_5_settings.png")
        print(f"Settings Page URL: {page.url} | Title: {page.title()}")

        allow_btn = page.locator('text="Allow custom app development"')
        if allow_btn.count() > 0:
            print("[PROVISION] Enabling custom app development...")
            allow_btn.first.click()
            page.wait_for_timeout(2000)
            page.locator('button:has-text("Allow custom app development")').first.click()
            page.wait_for_timeout(5000)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_6_allowed.png")

        create_app_btn = page.locator('text="Create an app"')
        if create_app_btn.count() > 0:
            print("[PROVISION] Clicking Create an App...")
            create_app_btn.first.click()
            page.wait_for_timeout(3000)
            page.fill('input[placeholder="App name"]', "Creative Liberation Collective")
            page.wait_for_timeout(1000)
            page.locator('button:has-text("Create app")').first.click()
            page.wait_for_timeout(8000)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_7_app_created.png")

        page.goto(target_url, wait_until="commit")
        page.wait_for_timeout(6000)
        app_row = page.locator('text="Creative Liberation Collective"')
        if app_row.count() > 0:
            print("[PROVISION] Opening Creative Liberation Collective details...")
            app_row.first.click()
            page.wait_for_timeout(6000)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_8_app_details.png")
        else:
            print("[PROVISION ERROR] App row not found after creation.")
            browser.close()
            sys.exit(1)

        config_scopes_btn = page.locator('text="Configure Admin API scopes"')
        if config_scopes_btn.count() > 0:
            print("[PROVISION] Configuring API scopes...")
            config_scopes_btn.first.click()
            page.wait_for_timeout(6000)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_9_scopes.png")
            
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

        install_btn = page.locator('button:has-text("Install app")')
        if install_btn.count() > 0:
            print("[PROVISION] Installing app...")
            install_btn.click()
            page.wait_for_timeout(2000)
            confirm_install = page.locator('button:has-text("Install")')
            if confirm_install.count() > 0:
                confirm_install.click()
                print("[PROVISION] Installation confirmed.")
                page.wait_for_timeout(8000)
                page.screenshot(path=f"{OUTPUT_DIR}/shopify_11_installed.png")

        reveal_btn = page.locator('button:has-text("Reveal token once")')
        if reveal_btn.count() > 0:
            print("[PROVISION] Revealing Access Token...")
            reveal_btn.click()
            page.wait_for_timeout(2000)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_12_token_revealed.png")

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
        print("CLE ENGINE SYSTEMS: PLAYWRIGHT NAS CDP PROVISIONING COMPLETE")
        print("=============================================================")
        browser.close()

if __name__ == "__main__":
    main()
