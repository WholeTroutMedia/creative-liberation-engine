#!/usr/bin/env python3
"""Verify CORTEX can access Google Chat and check current state."""
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

SELENIUM_URL = "http://cortex-browser:4444"

opts = Options()
opts.add_argument("--no-first-run")
opts.add_argument("--no-default-browser-check")
opts.add_argument("--disable-notifications")
opts.add_argument("--disable-blink-features=AutomationControlled")
opts.add_experimental_option("excludeSwitches", ["enable-automation"])
opts.add_experimental_option("useAutomationExtension", False)

print("Connecting to Selenium...")
driver = webdriver.Remote(command_executor=f"{SELENIUM_URL}/wd/hub", options=opts)
driver.set_window_size(1920, 1080)
driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

# Check Google identity
print("Checking Google account...")
driver.get("https://accounts.google.com")
time.sleep(3)
print(f"  URL: {driver.current_url}")

# Extract logged-in email
try:
    # Look for the account email on the page
    page_text = driver.find_element(By.TAG_NAME, "body").text
    if "inquiries@creativeliberationengine.org" in page_text:
        print("  ✓ Logged in as: inquiries@creativeliberationengine.org")
    elif "@" in page_text:
        # Find email in text
        import re
        emails = re.findall(r'[\w.+-]+@[\w-]+\.[\w.]+', page_text)
        print(f"  Logged in as: {emails[0] if emails else 'unknown'}")
    else:
        print(f"  Account page text (first 300): {page_text[:300]}")
except Exception as e:
    print(f"  Could not determine account: {e}")

# Navigate to Google Chat
print("\nNavigating to Google Chat...")
driver.get("https://chat.google.com")
time.sleep(8)
print(f"  URL: {driver.current_url}")
print(f"  Title: {driver.title}")

# Check if Chat loaded
if "chat.google.com" in driver.current_url:
    print("  ✓ Google Chat loaded successfully")
    
    # Look for conversation list
    try:
        body_text = driver.find_element(By.TAG_NAME, "body").text[:2000]
        print(f"\n  Chat content preview:\n  {body_text[:500]}")
    except Exception as e:
        print(f"  Could not read chat content: {e}")
else:
    print(f"  ✗ Unexpected URL: {driver.current_url}")
    body = driver.find_element(By.TAG_NAME, "body").text[:500]
    print(f"  Body: {body}")

driver.quit()
print("\nDone.")
