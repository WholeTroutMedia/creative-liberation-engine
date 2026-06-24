#!/usr/bin/env python3
"""One-shot login script for CORTEX — runs inside the cortex-chat-bridge container."""
import time
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

SELENIUM_URL = "http://cortex-browser:4444"
EMAIL = "inquiries@creativeliberationengine.org"
PASSWORD = "WholeTroutMedia!2026"

opts = Options()
opts.add_argument("--no-first-run")
opts.add_argument("--no-default-browser-check")
opts.add_argument("--disable-notifications")
opts.add_argument("--disable-blink-features=AutomationControlled")
opts.add_experimental_option("excludeSwitches", ["enable-automation"])
opts.add_experimental_option("useAutomationExtension", False)

print(f"Connecting to Selenium at {SELENIUM_URL}...")
driver = webdriver.Remote(command_executor=f"{SELENIUM_URL}/wd/hub", options=opts)
driver.set_window_size(1920, 1080)

# Remove webdriver flag
driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

print("Navigating to Google signin...")
driver.get("https://accounts.google.com/signin/v2/identifier")
time.sleep(3)

print(f"Current URL: {driver.current_url}")
print(f"Page title: {driver.title}")

# Check if already logged in
if "myaccount" in driver.current_url or "SignOutOptions" in driver.page_source:
    print("ALREADY LOGGED IN")
    driver.quit()
    sys.exit(0)

# Enter email
try:
    email_input = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, 'input[type="email"]'))
    )
    email_input.clear()
    email_input.send_keys(EMAIL)
    print(f"Entered email: {EMAIL}")
    time.sleep(1)
    email_input.send_keys(Keys.RETURN)
    time.sleep(4)
except Exception as e:
    print(f"Email input failed: {e}")
    print(f"Page source snippet: {driver.page_source[:500]}")
    driver.quit()
    sys.exit(1)

print(f"After email - URL: {driver.current_url}")
print(f"After email - Title: {driver.title}")

# Check for CAPTCHA or challenge
page = driver.page_source.lower()
if "captcha" in page or "verify" in page or "challenge" in page:
    print("CAPTCHA/CHALLENGE DETECTED — checking details...")
    # Try to find what kind of challenge
    challenges = driver.find_elements(By.CSS_SELECTOR, '[data-challengetype], [data-challenge-id]')
    for c in challenges:
        print(f"  Challenge: {c.get_attribute('data-challengetype') or c.text[:100]}")

# Enter password
try:
    pw_input = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, 'input[type="password"]'))
    )
    pw_input.clear()
    pw_input.send_keys(PASSWORD)
    print("Entered password")
    time.sleep(1)
    pw_input.send_keys(Keys.RETURN)
    time.sleep(5)
except Exception as e:
    print(f"Password input failed: {e}")
    # Maybe there's a "Try another way" or verification
    body_text = driver.find_element(By.TAG_NAME, "body").text[:1000]
    print(f"Page text: {body_text}")
    driver.quit()
    sys.exit(1)

print(f"After password - URL: {driver.current_url}")
print(f"After password - Title: {driver.title}")

# Check final state
final_url = driver.current_url
if "myaccount" in final_url or "accounts.google.com" in final_url:
    if "signin" not in final_url and "challenge" not in final_url:
        print("LOGIN SUCCESSFUL")
        # Now navigate to Google Chat to set that up
        print("Navigating to Google Chat...")
        driver.get("https://chat.google.com")
        time.sleep(5)
        print(f"Chat URL: {driver.current_url}")
        print(f"Chat Title: {driver.title}")
        print("CORTEX is ready for Chat Bridge")
    else:
        body_text = driver.find_element(By.TAG_NAME, "body").text[:1000]
        print(f"Still on signin/challenge. Body: {body_text}")
else:
    body_text = driver.find_element(By.TAG_NAME, "body").text[:1000]
    print(f"Unexpected state. URL: {final_url}")
    print(f"Body: {body_text}")

# DON'T quit - leave the session alive for the bridge to use
# driver.quit()
print("Session left open for bridge pickup")
print(f"Session ID: {driver.session_id}")
