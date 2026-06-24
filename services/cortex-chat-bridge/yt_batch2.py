#!/usr/bin/env python3
"""Subscribe CORTEX to additional channels — batch 2."""
import os, time, sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import StaleElementReferenceException

SELENIUM_URL = "http://cortex-browser:4444"

CHANNELS = [
    # User-requested — Creative / 3D / Real-time
    {"name": "Unreal Engine", "url": "https://www.youtube.com/@UnrealEngine"},
    {"name": "Blender", "url": "https://www.youtube.com/@BlenderOfficial"},
    {"name": "TouchDesigner", "url": "https://www.youtube.com/@TouchDesignerOfficial"},
    {"name": "DotSimulate", "url": "https://www.youtube.com/@dotsimulate"},
    # Fixes from batch 1 (corrected URLs)
    {"name": "AI Explained", "url": "https://www.youtube.com/@AiExplained"},
    {"name": "Matt Wolfe", "url": "https://www.youtube.com/@MattWolfe"},
    {"name": "Techno Tim", "url": "https://www.youtube.com/@TechnoTimVideo"},
    {"name": "Jeff Geerling", "url": "https://www.youtube.com/@JeffGeerling"},
    {"name": "All-In Podcast", "url": "https://www.youtube.com/@alaboratory"},
]

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
    driver.implicitly_wait(10)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver

def login(driver):
    email = os.getenv("CORTEX_EMAIL", "inquiries@creativeliberationengine.org")
    password = os.getenv("CORTEX_PASSWORD", "WholeTroutMedia!2026")
    driver.get("https://accounts.google.com/signin")
    time.sleep(3)
    if "myaccount" in driver.current_url:
        print("✓ Already logged in")
        return True
    try:
        ei = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, 'input[type="email"]')))
        ei.send_keys(email); ei.send_keys(Keys.RETURN); time.sleep(4)
        pw = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CSS_SELECTOR, 'input[type="password"]')))
        pw.send_keys(password); pw.send_keys(Keys.RETURN); time.sleep(6)
        if "challenge" not in driver.current_url and "signin" not in driver.current_url:
            print("✓ Login successful"); return True
    except Exception as e:
        print(f"✗ Login failed: {e}")
    return False

def subscribe(driver, ch):
    name, url = ch["name"], ch["url"]
    print(f"\n  {name} → {url}")
    try:
        driver.get(url)
        time.sleep(4)
        if "404" in driver.title.lower() or "not found" in driver.title.lower():
            print(f"    ✗ Not found"); return "not_found"

        # Re-fetch buttons each time to avoid stale refs
        buttons = driver.find_elements(By.XPATH,
            "//button[.//text()[contains(., 'Subscribe')]] | "
            "//yt-button-shape//button[contains(@aria-label, 'Subscribe')]"
        )
        for btn in buttons:
            try:
                aria = (btn.get_attribute("aria-label") or "").lower()
                text = btn.text.lower().strip()
                if "unsubscribe" in aria or "subscribed" in text:
                    print(f"    ✓ Already subscribed"); return "already"
            except StaleElementReferenceException:
                continue

        # Re-fetch to click
        buttons = driver.find_elements(By.XPATH,
            "//button[.//text()[contains(., 'Subscribe')]] | "
            "//yt-button-shape//button[contains(@aria-label, 'Subscribe')]"
        )
        for btn in buttons:
            try:
                text = btn.text.strip().lower()
                if "subscribe" in text and "unsubscribe" not in text and "subscribed" not in text:
                    driver.execute_script("arguments[0].click();", btn)
                    time.sleep(2)
                    print(f"    ✓ Subscribed!"); return "subscribed"
            except StaleElementReferenceException:
                continue
        print(f"    ? No button found"); return "no_button"
    except Exception as e:
        print(f"    ✗ Error: {e}"); return "error"

print("=" * 50)
print("CORTEX YouTube — Batch 2 Subscriptions")
print("=" * 50)

driver = get_driver()
print("✓ Connected to Selenium")

if not login(driver):
    print("Cannot login"); driver.quit(); sys.exit(1)

driver.get("https://www.youtube.com"); time.sleep(3)

results = {"subscribed": [], "already": [], "failed": []}
for ch in CHANNELS:
    r = subscribe(driver, ch)
    if r in ("subscribed",):
        results["subscribed"].append(ch["name"])
    elif r == "already":
        results["already"].append(ch["name"])
    else:
        results["failed"].append(ch["name"])

driver.quit()
print(f"\n{'='*50}")
print(f"DONE")
print(f"  New subs:      {', '.join(results['subscribed']) or 'none'}")
print(f"  Already had:   {', '.join(results['already']) or 'none'}")
print(f"  Failed:        {', '.join(results['failed']) or 'none'}")
