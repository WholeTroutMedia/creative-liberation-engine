import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)
print("Current URL before navigating to store admin:", driver.current_url)

target_url = "https://admin.shopify.com/store/latent-space-studios/settings/apps/development"
print("Navigating to:", target_url)
driver.get(target_url)
time.sleep(8)

print("Current URL after navigating to store admin:", driver.current_url)
print("Page Title:", driver.title)
driver.save_screenshot("/tmp/store_admin_load.png")
print("Screenshot saved to /tmp/store_admin_load.png")
