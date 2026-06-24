import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)

print("Navigating directly to develop apps settings api credentials...")
driver.get("https://admin.shopify.com/store/latent-space-studios/settings/apps/development/371742310401/api_credentials")
time.sleep(10)

print("Current URL:", driver.current_url)
print("Title:", driver.title)
driver.save_screenshot("/tmp/admin_credentials.png")
print("Screenshot saved to /tmp/admin_credentials.png")

with open("/tmp/admin_credentials_dom.html", "w", encoding="utf-8") as f:
    f.write(driver.page_source)
print("DOM dumped.")
