import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)

print("Navigating directly to app settings details...")
driver.get("https://admin.shopify.com/store/latent-space-studios/settings/apps/development/371742310401")

# Wait up to 30 seconds
for i in range(30):
    time.sleep(1)
    print(f"Sec {i+1} - Title: '{driver.title}' | URL: '{driver.current_url}'")
    if "Creative Liberation Collective" in driver.title or "Settings" in driver.title:
        print("Page fully loaded!")
        break

time.sleep(5)
print("Final URL:", driver.current_url)
print("Final Title:", driver.title)
driver.save_screenshot("/tmp/custom_app_loaded.png")
print("Screenshot saved to /tmp/custom_app_loaded.png")

with open("/tmp/custom_app_loaded_dom.html", "w", encoding="utf-8") as f:
    f.write(driver.page_source)
print("DOM dumped.")
