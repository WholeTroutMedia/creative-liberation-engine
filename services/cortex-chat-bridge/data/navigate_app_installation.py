import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)

print("Navigating directly to app installation settings...")
driver.get("https://admin.shopify.com/store/latent-space-studios/settings/apps/app_installations/app/cle-engine-systems")
time.sleep(10)

print("Current URL:", driver.current_url)
print("Title:", driver.title)
driver.save_screenshot("/tmp/app_installation_settings.png")
print("Screenshot saved to /tmp/app_installation_settings.png")

with open("/tmp/app_installation_settings_dom.html", "w", encoding="utf-8") as f:
    f.write(driver.page_source)
print("DOM dumped.")
