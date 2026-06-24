import time
import sys
import os
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

SELENIUM_URL = "http://cortex-browser:4444"
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
    print("[EMAIL] Connecting to inquiries@creativeliberationengine.org via IMAP...")
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
    print("CLE ENGINE SYSTEMS: AUTONOMOUS SELENIUM PROVISIONING RUN")
    print("=============================================================")
    print(f"Connecting to Selenium at {SELENIUM_URL}...")
    
    opts = Options()
    opts.add_argument("--no-first-run")
    opts.add_argument("--no-default-browser-check")
    opts.add_argument("--disable-notifications")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)

    try:
        driver = webdriver.Remote(command_executor=f"{SELENIUM_URL}/wd/hub", options=opts)
        driver.set_window_size(1920, 1080)
        
        # Inject advanced stealth via CDP before any page loads
        print("[PROVISION] Injecting advanced stealth via CDP...")
        driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": """
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                window.chrome = { runtime: {} };
                Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
                Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
            """
        })
        print("Connected to Selenium successfully!")
    except Exception as e:
        print(f"FAILED to connect to Selenium: {e}")
        sys.exit(1)

    try:
        target_url = f"https://admin.shopify.com/store/{SHOP_HANDLE}/settings/apps/development"
        print(f"[PROVISION] Navigating to: {target_url}")
        driver.get(target_url)
        time.sleep(8)
        
        driver.save_screenshot(f"{OUTPUT_DIR}/shopify_1_load.png")
        print(f"Initial Page URL: {driver.current_url}")
        print(f"Initial Page Title: {driver.title}")

        # Check if login is required
        if "login" in driver.current_url or "identity" in driver.current_url or "lookup" in driver.current_url:
            print("[PROVISION] Login required. Automating Shopify credentials...")
            
            # Wait for visible email input and fill it
            print("[PROVISION] Waiting for visible email input field...")
            email_input = WebDriverWait(driver, 20).until(
                lambda d: next((i for i in d.find_elements(By.CSS_SELECTOR, 'input[type="email"], #account_email') if i.is_displayed()), None)
            )
            email_input.clear()
            
            # Type email key by key to trigger framework event listener
            print("Typing email key-by-key...")
            for char in EMAIL:
                email_input.send_keys(char)
                time.sleep(0.05)
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_2_email.png")
            
            # Click the continue button explicitly to bypass enter key limitations if any
            print("[PROVISION] Clicking Continue with email button...")
            continue_btn = WebDriverWait(driver, 20).until(
                lambda d: next((b for b in d.find_elements(By.CSS_SELECTOR, 'button[type="submit"], button[name="commit"], .login-button') if b.is_displayed()), None)
            )
            driver.execute_script("arguments[0].removeAttribute('disabled');", continue_btn)
            driver.execute_script("arguments[0].click();", continue_btn)
            
            time.sleep(5)
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_2.5_after_email.png")
            
            # Wait for visible password input and fill it
            print("[PROVISION] Waiting for visible password input field...")
            pw_input = WebDriverWait(driver, 25).until(
                lambda d: next((i for i in d.find_elements(By.CSS_SELECTOR, 'input[type="password"], #account_password') if i.is_displayed()), None)
            )
            pw_input.clear()
            
            # Type password key by key
            print("Typing password key-by-key...")
            for char in PASSWORD:
                pw_input.send_keys(char)
                time.sleep(0.05)
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_3_password.png")
            
            # Click the submit button explicitly
            print("[PROVISION] Clicking submit password button...")
            login_btn = WebDriverWait(driver, 20).until(
                lambda d: next((b for b in d.find_elements(By.CSS_SELECTOR, 'button[type="submit"], button[name="commit"], .login-button') if b.is_displayed()), None)
            )
            driver.execute_script("arguments[0].removeAttribute('disabled');", login_btn)
            driver.execute_script("arguments[0].click();", login_btn)
            
            print("[PROVISION] Credentials submitted. Waiting for page transition...")
            time.sleep(10)
            
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_4_login_result.png")
            print(f"URL after submit: {driver.current_url}")
            
            # Handle Passkey prompt
            time.sleep(4)
            not_now_btns = driver.find_elements(By.XPATH, "//*[contains(text(), 'Not now')]")
            if not_now_btns:
                print("Found 'Not now' button. Clicking...")
                driver.execute_script("arguments[0].click();", not_now_btns[0])
                time.sleep(6)
                driver.save_screenshot(f"{OUTPUT_DIR}/shopify_4_login_passkey_dismissed.png")

            # Check for 2FA / Verification code
            code_inputs = driver.find_elements(By.CSS_SELECTOR, 'input[autocomplete="one-time-code"], input[name="code"], input[id="auth-code"]')
            if code_inputs and code_inputs[0].is_displayed():
                print("[PROVISION CHALLENGE] 2FA required! Fetching code via IMAP...")
                code = fetch_latest_shopify_code()
                if code:
                    print(f"[PROVISION] Entering code: {code}")
                    code_inputs[0].clear()
                    code_inputs[0].send_keys(code)
                    driver.save_screenshot(f"{OUTPUT_DIR}/shopify_challenge_code_entered.png")
                    code_inputs[0].send_keys(Keys.RETURN)
                    time.sleep(10)
                else:
                    print("[PROVISION ERROR] Verification code not retrieved.")
                    driver.quit()
                    sys.exit(1)

        # Confirm settings page is loaded
        if "settings/apps/development" not in driver.current_url:
            print("[PROVISION] Re-routing to settings page...")
            driver.get(target_url)
            time.sleep(8)
            
        driver.save_screenshot(f"{OUTPUT_DIR}/shopify_5_settings.png")
        print(f"Settings Page URL: {driver.current_url} | Title: {driver.title}")

        # Enable Custom App Development if needed
        allow_btns = driver.find_elements(By.XPATH, "//*[contains(text(), 'Allow custom app development')]")
        if allow_btns:
            print("[PROVISION] Enabling custom app development...")
            driver.execute_script("arguments[0].click();", allow_btns[0])
            time.sleep(2)
            confirm_btns = driver.find_elements(By.XPATH, "//button[contains(text(), 'Allow custom app development')]")
            if confirm_btns:
                driver.execute_script("arguments[0].click();", confirm_btns[0])
                time.sleep(5)
                driver.save_screenshot(f"{OUTPUT_DIR}/shopify_6_allowed.png")

        # Create App "Creative Liberation Collective"
        create_app_btns = driver.find_elements(By.XPATH, "//*[contains(text(), 'Create an app')]")
        if create_app_btns:
            print("[PROVISION] Clicking Create an App...")
            driver.execute_script("arguments[0].click();", create_app_btns[0])
            time.sleep(3)
            
            name_inputs = driver.find_elements(By.CSS_SELECTOR, 'input[placeholder="App name"]')
            if name_inputs:
                name_inputs[0].clear()
                name_inputs[0].send_keys("Creative Liberation Collective")
                time.sleep(1)
                create_submit = driver.find_elements(By.XPATH, "//button[contains(text(), 'Create app')]")
                if create_submit:
                    driver.execute_script("arguments[0].click();", create_submit[0])
                    time.sleep(8)
                    driver.save_screenshot(f"{OUTPUT_DIR}/shopify_7_app_created.png")

        # Open App details
        driver.get(target_url)
        time.sleep(6)
        app_rows = driver.find_elements(By.XPATH, "//*[contains(text(), 'Creative Liberation Collective')]")
        if app_rows:
            print("[PROVISION] Opening Creative Liberation Collective details...")
            driver.execute_script("arguments[0].click();", app_rows[0])
            time.sleep(6)
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_8_app_details.png")
        else:
            print("[PROVISION ERROR] App row not found after creation.")
            driver.quit()
            sys.exit(1)

        # Configure API scopes
        config_scopes_btns = driver.find_elements(By.XPATH, "//*[contains(text(), 'Configure Admin API scopes')]")
        if config_scopes_btns:
            print("[PROVISION] Configuring API scopes...")
            driver.execute_script("arguments[0].click();", config_scopes_btns[0])
            time.sleep(6)
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_9_scopes.png")
            
            target_scopes = ["write_products", "read_products", "write_inventory", "read_inventory", "write_orders", "read_orders"]
            for scope in target_scopes:
                checkboxes = driver.find_elements(By.ID, scope)
                if checkboxes:
                    cb = checkboxes[0]
                    if not cb.is_selected():
                        driver.execute_script("arguments[0].click();", cb)
                        print(f"Checked scope: {scope}")
            
            time.sleep(2)
            save_btns = driver.find_elements(By.XPATH, "//button[contains(text(), 'Save')]")
            if save_btns:
                driver.execute_script("arguments[0].click();", save_btns[0])
                print("[PROVISION] API scopes saved.")
                time.sleep(6)
                driver.save_screenshot(f"{OUTPUT_DIR}/shopify_10_scopes_saved.png")

        # Install App
        install_btns = driver.find_elements(By.XPATH, "//button[contains(text(), 'Install app')]")
        if install_btns:
            print("[PROVISION] Installing app...")
            driver.execute_script("arguments[0].click();", install_btns[0])
            time.sleep(2)
            confirm_install = driver.find_elements(By.XPATH, "//button[contains(text(), 'Install')]")
            if confirm_install:
                driver.execute_script("arguments[0].click();", confirm_install[0])
                print("[PROVISION] Installation confirmed.")
                time.sleep(8)
                driver.save_screenshot(f"{OUTPUT_DIR}/shopify_11_installed.png")

        # Reveal Access Token
        reveal_btns = driver.find_elements(By.XPATH, "//button[contains(text(), 'Reveal token once')]")
        if reveal_btns:
            print("[PROVISION] Revealing Access Token...")
            driver.execute_script("arguments[0].click();", reveal_btns[0])
            time.sleep(2)
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_12_token_revealed.png")

        # Extract and save token
        token_inputs = driver.find_elements(By.CSS_SELECTOR, 'input[value^="shpat_"]')
        if token_inputs:
            token = token_inputs[0].get_attribute("value")
            print(f"\n[PROVISION SUCCESS] Access Token successfully extracted: {token[:12]}...")
            with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                f.write(token)
            print(f"[PROVISION] Saved to persistent path: {TOKEN_FILE}")
        else:
            token_inputs_alt = driver.find_elements(By.CSS_SELECTOR, 'input[type="password"]')
            for ti in token_inputs_alt:
                val = ti.get_attribute("value")
                if val and val.startswith("shpat_"):
                    print(f"\n[PROVISION SUCCESS] Access Token found: {val[:12]}...")
                    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                        f.write(val)
                    print(f"[PROVISION] Saved to persistent path: {TOKEN_FILE}")
                    break

        print("=============================================================")
        print("CLE ENGINE SYSTEMS: AUTONOMOUS SELENIUM PROVISIONING COMPLETE")
        print("=============================================================")
    except Exception as e:
        print(f"[PROVISION ERROR] crashed: {e}")
        driver.save_screenshot(f"{OUTPUT_DIR}/shopify_error.png")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
