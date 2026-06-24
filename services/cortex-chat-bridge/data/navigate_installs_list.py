import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)

print("Navigating directly to installs list...")
driver.get("https://dev.shopify.com/dashboard/219666621/apps/371742310401/installs")
time.sleep(8)

print("Current URL:", driver.current_url)
print("Title:", driver.title)
driver.save_screenshot("/tmp/installs_list.png")
print("Screenshot saved to /tmp/installs_list.png")

with open("/tmp/installs_list_dom.html", "w", encoding="utf-8") as f:
    f.write(driver.page_source)
print("DOM dumped.")
