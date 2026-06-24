import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)
print("Current URL before click:", driver.current_url)

# Find Settings link in sidebar
settings_btns = driver.find_elements(By.XPATH, "//a[contains(@href, '/settings') or contains(text(), 'Settings')]")
if settings_btns:
    print("Found settings button! Clicking...")
    driver.execute_script("arguments[0].click();", settings_btns[0])
    time.sleep(5)
    print("Current URL after click:", driver.current_url)
    driver.save_screenshot("/tmp/settings_page.png")
    print("Screenshot saved!")
else:
    print("ERROR: Settings button not found!")
