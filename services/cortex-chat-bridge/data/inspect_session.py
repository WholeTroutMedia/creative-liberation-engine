import os
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

SELENIUM_URL = "http://cortex-browser:4444"
SESSION_ID = "6eb0c4870a726c8e128e64e43d20e8f8"

def main():
    print(f"Attaching to existing Selenium session: {SESSION_ID}...")
    opts = Options()
    opts.add_argument("--no-first-run")
    opts.add_argument("--no-default-browser-check")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    try:
        # Create a new driver instance
        driver = webdriver.Remote(command_executor=f"{SELENIUM_URL}/wd/hub", options=opts)
        
        # Swap session ID without closing the driver window, which causes a hang
        driver.session_id = SESSION_ID
        
        print(f"Successfully swapped driver session. Current URL: {driver.current_url}")
        print(f"Page Title: {driver.title}")
        
        # Dump console logs
        print("\n=== BROWSER CONSOLE LOGS ===")
        logs = driver.get_log("browser")
        for entry in logs:
            print(f"[{entry['level']}] {entry['message']}")
            
        # Inspect form and button
        print("\n=== INSPECTING DOM ELEMENTS ===")
        email_inputs = driver.find_elements(By.CSS_SELECTOR, 'input[type="email"], #account_email')
        print(f"Found {len(email_inputs)} email input elements.")
        for idx, el in enumerate(email_inputs):
            print(f"Email Input {idx}: ID={el.get_attribute('id')}, Name={el.get_attribute('name')}, Value='{el.get_attribute('value')}', Displayed={el.is_displayed()}")
            
        buttons = driver.find_elements(By.CSS_SELECTOR, 'button')
        print(f"Found {len(buttons)} button elements.")
        for idx, btn in enumerate(buttons):
            print(f"Button {idx}: Text='{btn.text}', ID='{btn.get_attribute('id')}', Type='{btn.get_attribute('type')}', Displayed={btn.is_displayed()}")

        # Try to find if there is an error banner or text
        errors = driver.find_elements(By.CSS_SELECTOR, '.ui-error, .error, [role="alert"], .input-error-message')
        print(f"Found {len(errors)} error elements.")
        for idx, err in enumerate(errors):
            print(f"Error {idx}: Text='{err.text}', Displayed={err.is_displayed()}")

    except Exception as e:
        print(f"Error inspecting session: {e}")

if __name__ == '__main__':
    main()
