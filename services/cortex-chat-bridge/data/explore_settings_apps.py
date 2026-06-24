import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)

print("Navigating to settings -> Apps and sales channels...")
driver.get("https://admin.shopify.com/store/latent-space-studios/settings/apps")
time.sleep(8)

print("Current URL:", driver.current_url)
print("Title:", driver.title)
driver.save_screenshot("/tmp/settings_apps_list.png")
print("Screenshot saved to /tmp/settings_apps_list.png")

with open("/tmp/settings_apps_list_dom.html", "w", encoding="utf-8") as f:
    f.write(driver.page_source)
print("DOM dumped.")
