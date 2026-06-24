import time
import sys
import os
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
    from email.header import decode_header
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
    print("CLE ENGINE SYSTEMS: AUTONOMOUS SHOPIFY PROVISIONING RUN")
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
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    except Exception as e:
        print(f"FAILED to connect to Selenium: {e}")
        sys.exit(1)

    try:
        # Route to settings apps page directly
        target_url = f"https://admin.shopify.com/store/{SHOP_HANDLE}/settings/apps/development"
        print(f"[PROVISION] Navigating to: {target_url}")
        driver.get(target_url)
        time.sleep(5)
        
        # Take initial screenshot
        driver.save_screenshot(f"{OUTPUT_DIR}/shopify_1_load.png")
        print(f"Initial Page URL: {driver.current_url}")
        print(f"Initial Page Title: {driver.title}")

        # Check if login is required
        if "login" in driver.current_url or "identity" in driver.current_url:
            print("[PROVISION] Login required. Automating Shopify credentials...")
            
            # Fill email
            email_input = WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'input[type="email"]'))
            )
            email_input.clear()
            email_input.send_keys(EMAIL)
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_2_email.png")
            email_input.send_keys(Keys.RETURN)
            time.sleep(4)
            
            # Fill password
            pw_input = WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'input[type="password"]'))
            )
            pw_input.clear()
            pw_input.send_keys(PASSWORD)
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_3_password.png")
            pw_input.send_keys(Keys.RETURN)
            print("[PROVISION] Credentials submitted. Waiting for page transition...")
            time.sleep(8)
            
            # Handle email code challenge if present
            current_url = driver.current_url
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_4_login_result.png")
            print(f"Current URL after submit: {current_url}")
            
            # Look for 2FA/verification code selector
            code_selectors = [
                'input[name="code"]', 
                'input[id="auth-code"]',
                'input[type="text"][autocomplete="one-time-code"]',
                'input[placeholder="000000"]'
            ]
            has_challenge = False
            for sel in code_selectors:
                elements = driver.find_elements(By.CSS_SELECTOR, sel)
                if elements and elements[0].is_displayed():
                    has_challenge = True
                    challenge_element = elements[0]
                    break
                    
            if has_challenge:
                print("[PROVISION CHALLENGE] Shopify email confirmation challenge triggered! Fetching code via IMAP...")
                verification_code = fetch_latest_shopify_code()
                if verification_code:
                    print(f"[PROVISION] Entering code: {verification_code}")
                    challenge_element.clear()
                    challenge_element.send_keys(verification_code)
                    driver.save_screenshot(f"{OUTPUT_DIR}/shopify_challenge_code_entered.png")
                    challenge_element.send_keys(Keys.RETURN)
                    time.sleep(10)
                else:
                    print("[PROVISION ERROR] Failed to fetch verification code from email.")
                    driver.quit()
                    sys.exit(1)

        # Confirm we are on the development settings page (re-navigate if needed)
        if "settings/apps/development" not in driver.current_url:
            print("[PROVISION] Re-routing to development settings page...")
            driver.get(target_url)
            time.sleep(6)
            
        driver.save_screenshot(f"{OUTPUT_DIR}/shopify_5_settings.png")
        print(f"Active Page URL: {driver.current_url}")
        
        # Check if custom app development needs to be enabled
        allow_buttons = driver.find_elements(By.XPATH, "//*[contains(text(), 'Allow custom app development')]")
        if allow_buttons:
            print("[PROVISION] Allowing custom app development...")
            allow_buttons[0].click()
            time.sleep(2)
            # Confirm modal
            confirm_buttons = driver.find_elements(By.XPATH, "//button[contains(text(), 'Allow custom app development')]")
            if confirm_buttons:
                confirm_buttons[0].click()
                time.sleep(4)
                driver.save_screenshot(f"{OUTPUT_DIR}/shopify_6_allowed.png")

        # Create Custom App "Creative Liberation Collective"
        create_app_buttons = driver.find_elements(By.XPATH, "//*[contains(text(), 'Create an app')]")
        if create_app_buttons:
            print("[PROVISION] Clicking Create an App...")
            create_app_buttons[0].click()
            time.sleep(3)
            
            # Fill app name
            name_inputs = driver.find_elements(By.CSS_SELECTOR, 'input[placeholder="App name"]')
            if name_inputs:
                name_inputs[0].clear()
                name_inputs[0].send_keys("Creative Liberation Collective")
                time.sleep(1)
                
                # Confirm create
                create_submit = driver.find_elements(By.XPATH, "//button[contains(text(), 'Create app')]")
                if create_submit:
                    create_submit[0].click()
                    time.sleep(6)
                    driver.save_screenshot(f"{OUTPUT_DIR}/shopify_7_app_created.png")

        # Open "Creative Liberation Collective" details
        # Refresh the page to reload registry
        driver.get(target_url)
        time.sleep(5)
        
        app_rows = driver.find_elements(By.XPATH, "//*[contains(text(), 'Creative Liberation Collective')]")
        if app_rows:
            print("[PROVISION] Opening Creative Liberation Collective App...")
            app_rows[0].click()
            time.sleep(5)
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_8_app_details.png")
        else:
            print("[PROVISION ERROR] App row not found after creation attempt.")
            driver.quit()
            sys.exit(1)

        # Configure API scopes
        configure_scopes = driver.find_elements(By.XPATH, "//*[contains(text(), 'Configure Admin API scopes')]")
        if configure_scopes:
            print("[PROVISION] Opening API Scopes configuration...")
            configure_scopes[0].click()
            time.sleep(5)
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_9_scopes.png")
            
            # Check the required scope checkboxes
            target_scopes = ["write_products", "read_products", "write_inventory", "read_inventory", "write_orders", "read_orders"]
            for scope in target_scopes:
                checkboxes = driver.find_elements(By.ID, scope)
                if checkboxes:
                    cb = checkboxes[0]
                    if not cb.is_selected():
                        driver.execute_script("arguments[0].click();", cb)
                        print(f"Checked scope: {scope}")
            
            time.sleep(1)
            save_buttons = driver.find_elements(By.XPATH, "//button[contains(text(), 'Save')]")
            if save_buttons:
                save_buttons[0].click()
                print("[PROVISION] API scopes saved.")
                time.sleep(5)
                driver.save_screenshot(f"{OUTPUT_DIR}/shopify_10_scopes_saved.png")

        # Install App
        install_buttons = driver.find_elements(By.XPATH, "//button[contains(text(), 'Install app')]")
        if install_buttons:
            print("[PROVISION] Clicking Install App...")
            install_buttons[0].click()
            time.sleep(2)
            confirm_install = driver.find_elements(By.XPATH, "//button[contains(text(), 'Install')]")
            if confirm_install:
                confirm_install[0].click()
                print("[PROVISION] Install confirmed.")
                time.sleep(6)
                driver.save_screenshot(f"{OUTPUT_DIR}/shopify_11_installed.png")

        # Extract and Reveal Access Token
        reveal_buttons = driver.find_elements(By.XPATH, "//button[contains(text(), 'Reveal token once')]")
        if reveal_buttons:
            print("[PROVISION] Revealing Access Token...")
            reveal_buttons[0].click()
            time.sleep(2)
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_12_token_revealed.png")

        # Search for token input value
        token_inputs = driver.find_elements(By.CSS_SELECTOR, 'input[value^="shpat_"]')
        if token_inputs:
            token = token_inputs[0].get_attribute("value")
            print(f"\n[PROVISION SUCCESS] Access Token successfully extracted: {token[:12]}...")
            
            # Save the token to local file
            with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                f.write(token)
            print(f"[PROVISION] Saved to persistent path: {TOKEN_FILE}")
        else:
            print("[PROVISION WARNING] Access token input not found. App might already be installed.")
            # Search if token is already visible
            token_inputs_alt = driver.find_elements(By.CSS_SELECTOR, 'input[type="password"]')
            # If revealed, value starts with shpat_
            for ti in token_inputs_alt:
                val = ti.get_attribute("value")
                if val and val.startswith("shpat_"):
                    print(f"\n[PROVISION SUCCESS] Access Token found: {val[:12]}...")
                    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                        f.write(val)
                    print(f"[PROVISION] Saved to persistent path: {TOKEN_FILE}")
                    break

        print("=============================================================")
        print("CLE ENGINE SYSTEMS: AUTONOMOUS SHOPIFY PROVISIONING COMPLETE")
        print("=============================================================")
    except Exception as e:
        print(f"[PROVISION ERROR] Automation crashed: {e}")
        driver.save_screenshot(f"{OUTPUT_DIR}/shopify_error.png")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
