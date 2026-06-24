import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)
print("Navigating to app root...")
driver.get("https://dev.shopify.com/dashboard/219666621/apps/371742310401")
time.sleep(6)

print("Current URL:", driver.current_url)
print("Title:", driver.title)
driver.save_screenshot("/tmp/app_root.png")
print("Screenshot saved to /tmp/app_root.png")

with open("/tmp/app_root_dom.html", "w", encoding="utf-8") as f:
    f.write(driver.page_source)
print("DOM dumped.")
