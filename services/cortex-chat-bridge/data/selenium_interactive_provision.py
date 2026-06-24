import os
import sys
import time
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys

SELENIUM_URL = "http://cortex-browser:4444"
EMAIL = "inquiries@creativeliberationengine.org"
PASSWORD = "WholeTroutMedia!2026"
SHOP_HANDLE = "latent-space-studios"
OUTPUT_DIR = "/app/data"
TOKEN_FILE = os.path.join(OUTPUT_DIR, "shopify_token.txt")

def main():
    print("=============================================================")
    print("CLE ENGINE SYSTEMS: INTERACTIVE SELENIUM PROVISIONER")
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
        print(f"[PROVISION] Navigating to target page: {target_url}")
        driver.get(target_url)
        time.sleep(8)
        
        driver.save_screenshot(f"{OUTPUT_DIR}/shopify_1_load.png")
        print(f"Initial Page URL: {driver.current_url}")
        print(f"Initial Page Title: {driver.title}")

        # Check if login is required
        if "login" in driver.current_url or "identity" in driver.current_url or "lookup" in driver.current_url:
            print("[PROVISION] Login required. Attempting automated credential fill...")
            
            try:
                # Wait for visible email input and fill it
                email_input = WebDriverWait(driver, 15).until(
                    lambda d: next((i for i in d.find_elements(By.CSS_SELECTOR, 'input[type="email"], #account_email') if i.is_displayed()), None)
                )
                email_input.clear()
                print("Typing email...")
                for char in EMAIL:
                    email_input.send_keys(char)
                    time.sleep(0.05)
                
                driver.save_screenshot(f"{OUTPUT_DIR}/shopify_2_email.png")
                
                # Click the continue button explicitly
                continue_btn = WebDriverWait(driver, 10).until(
                    lambda d: next((b for b in d.find_elements(By.CSS_SELECTOR, 'button[type="submit"], button[name="commit"], .login-button') if b.is_displayed()), None)
                )
                driver.execute_script("arguments[0].removeAttribute('disabled');", continue_btn)
                driver.execute_script("arguments[0].click();", continue_btn)
                time.sleep(5)
                
                driver.save_screenshot(f"{OUTPUT_DIR}/shopify_2.5_after_email.png")
                
                # Wait for visible password input
                pw_input = WebDriverWait(driver, 10).until(
                    lambda d: next((i for i in d.find_elements(By.CSS_SELECTOR, 'input[type="password"], #account_password') if i.is_displayed()), None)
                )
                pw_input.clear()
                print("Typing password...")
                for char in PASSWORD:
                    pw_input.send_keys(char)
                    time.sleep(0.05)
                
                driver.save_screenshot(f"{OUTPUT_DIR}/shopify_3_password.png")
                
                # Click login button
                login_btn = WebDriverWait(driver, 10).until(
                    lambda d: next((b for b in d.find_elements(By.CSS_SELECTOR, 'button[type="submit"], button[name="commit"], .login-button') if b.is_displayed()), None)
                )
                driver.execute_script("arguments[0].removeAttribute('disabled');", login_btn)
                driver.execute_script("arguments[0].click();", login_btn)
                
                print("[PROVISION] Credentials submitted. Waiting for redirection check...")
                time.sleep(8)
            except Exception as e:
                print(f"[PROVISION INFO] Automated login path skipped or failed: {e}")

        # Check if stuck on login / verification page
        print("Checking if we have bypassed the login/verification check...")
        driver.save_screenshot(f"{OUTPUT_DIR}/shopify_login_check.png")
        
        # Polling Loop for Visual Bypass
        start_time = time.time()
        timeout = 600 # 10 minutes
        logged_in = False
        
        while time.time() - start_time < timeout:
            current_url = driver.current_url
            print(f"[POLL] Current URL: {current_url}")
            
            # Save periodic screenshots
            driver.save_screenshot(f"{OUTPUT_DIR}/shopify_interactive_poll.png")
            
            if "settings/apps/development" in current_url:
                print("[POLL SUCCESS] Target page reached successfully!")
                logged_in = True
                break
                
            print("=============================================================")
            print("⚠️ ACTION REQUIRED: SHOPIFY BOT-CHALLENGE / SECURITY DETECTED ⚠️")
            print("Please perform the following steps:")
            print("1. Open your browser on the workstation to:")
            print("   http://127.0.0.1:7901/ (VNC Web Console)")
            print("2. Visually complete the Cloudflare, hCaptcha, or MFA check there.")
            print("3. Once you log in and the browser loads the App Development page, the script will automatically continue!")
            print("=============================================================")
            print("Polling again in 5 seconds...")
            time.sleep(5)
            
        if not logged_in:
            print("[PROVISION ERROR] Interactive login timed out after 10 minutes.")
            driver.quit()
            sys.exit(1)

        # Confirm settings page is loaded and we have elements
        time.sleep(5)
        driver.save_screenshot(f"{OUTPUT_DIR}/shopify_5_settings.png")
        print(f"Settings Page URL: {driver.current_url} | Title: {driver.title}")

        # Enable Custom App Development if needed
        allow_btns = driver.find_elements(By.XPATH, "//*[contains(text(), 'Allow custom app development')]")
        if allow_btns:
            print("[PROVISION] Enabling custom app development...")
            driver.execute_script("arguments[0].click();", allow_btns[0])
            time.sleep(3)
            confirm_allow = driver.find_elements(By.XPATH, "//button[contains(text(), 'Allow custom app development')]")
            if confirm_allow:
                driver.execute_script("arguments[0].click();", confirm_allow[0])
                time.sleep(5)
                driver.save_screenshot(f"{OUTPUT_DIR}/shopify_6_allowed.png")

        # Create Custom App "Creative Liberation Collective"
        create_app_btns = driver.find_elements(By.XPATH, "//*[contains(text(), 'Create an app')]")
        if create_app_btns:
            print("[PROVISION] Creating a new app 'Creative Liberation Collective'...")
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
        print("CLE ENGINE SYSTEMS: INTERACTIVE PROVISIONING RUN COMPLETE")
        print("=============================================================")
        driver.quit()

    except Exception as e:
        print(f"[PROVISION ERROR] Unexpected error: {e}")
        try:
            driver.quit()
        except:
            pass
        sys.exit(1)

if __name__ == '__main__':
    main()
