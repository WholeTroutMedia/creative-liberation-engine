import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)

print("Waiting 15 seconds for app installations settings to load...")
time.sleep(15)

print("Current URL:", driver.current_url)
print("Title:", driver.title)
driver.save_screenshot("/tmp/app_installation_settings_loaded.png")
print("Screenshot saved to /tmp/app_installation_settings_loaded.png")

with open("/tmp/app_installation_settings_loaded_dom.html", "w", encoding="utf-8") as f:
    f.write(driver.page_source)
print("DOM dumped.")
