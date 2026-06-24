#!/usr/bin/env python3
"""Diagnostic: verify which Google account Selenium is logged into."""
import os, time, json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

SELENIUM_URL = "http://cortex-browser:4444"
EMAIL = os.getenv("CORTEX_EMAIL", "inquiries@creativeliberationengine.org")
PASSWORD = os.getenv("CORTEX_PASSWORD", "WholeTroutMedia!2026")

def get_driver():
    opts = Options()
    opts.add_argument("--no-first-run")
    opts.add_argument("--no-default-browser-check")
    opts.add_argument("--disable-notifications")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)
    driver = webdriver.Remote(command_executor=f"{SELENIUM_URL}/wd/hub", options=opts)
    driver.set_window_size(1920, 1080)
    driver.implicitly_wait(5)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver

print("=" * 60)
print("CORTEX Account Diagnostic")
print("=" * 60)

driver = get_driver()
print("✓ Connected to Selenium")

# Step 1: Login
print(f"\nLogging in as: {EMAIL}")
driver.get("https://accounts.google.com/signin")
time.sleep(3)

current = driver.current_url
print(f"  After navigate: {current}")

if "myaccount" in current:
    print("  → Already signed in, checking identity...")
else:
    # Fresh login
    try:
        ei = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'input[type="email"]'))
        )
        ei.clear()
        ei.send_keys(EMAIL)
        ei.send_keys(Keys.RETURN)
        time.sleep(4)
        
        pw = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'input[type="password"]'))
        )
        pw.send_keys(PASSWORD)
        pw.send_keys(Keys.RETURN)
        time.sleep(6)
        print(f"  After login URL: {driver.current_url}")
    except Exception as e:
        print(f"  ✗ Login error: {e}")
        print(f"  Current URL: {driver.current_url}")
        print(f"  Page title: {driver.title}")

# Step 2: Check identity via myaccount
print("\n--- Identity Check ---")
driver.get("https://myaccount.google.com/personal-info")
time.sleep(5)
print(f"  URL: {driver.current_url}")
print(f"  Title: {driver.title}")

# Try to find the email on the page
page_text = driver.find_element(By.TAG_NAME, "body").text
for line in page_text.split("\n"):
    line = line.strip()
    if "@" in line and ("gmail" in line.lower() or "cle" in line.lower() or "cortex" in line.lower()):
        print(f"  FOUND EMAIL: {line}")

# Step 3: Go to YouTube and check subscriptions page
print("\n--- YouTube Subscription Check ---")
driver.get("https://www.youtube.com/feed/channels")
time.sleep(5)
print(f"  URL: {driver.current_url}")
print(f"  Title: {driver.title}")

# Check if we're signed in on YouTube
try:
    # Look for avatar/account button
    avatars = driver.find_elements(By.CSS_SELECTOR, "button#avatar-btn, img.yt-spec-avatar-shape__avatar")
    if avatars:
        print(f"  ✓ Signed into YouTube (found avatar)")
    else:
        print(f"  ? No avatar found — may not be signed in on YouTube")
        # Check for sign-in button
        signin = driver.find_elements(By.XPATH, "//*[contains(text(), 'Sign in')]")
        if signin:
            print(f"  ✗ YouTube NOT signed in — see 'Sign in' button")
except Exception as e:
    print(f"  Error checking: {e}")

# List visible channel names on subscriptions page
print("\n--- Subscribed Channels ---")
try:
    channels = driver.find_elements(By.CSS_SELECTOR, 
        "#channel-name #text, "
        "ytd-channel-renderer #channel-title, "
        "#info-section #text, "
        "yt-formatted-string.ytd-channel-renderer"
    )
    if channels:
        for ch in channels[:30]:
            t = ch.text.strip()
            if t:
                print(f"  • {t}")
    else:
        # Try broader selector
        body = driver.find_element(By.TAG_NAME, "body").text
        lines = [l.strip() for l in body.split("\n") if l.strip() and len(l.strip()) > 3]
        print(f"  Page has {len(lines)} text lines. First 20:")
        for l in lines[:20]:
            print(f"    {l}")
except Exception as e:
    print(f"  Error: {e}")

driver.quit()
print("\n✓ Diagnostic complete")
