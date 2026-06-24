import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)
print("Waiting 15 seconds for SPA to load...")
time.sleep(15)
print("Current URL:", driver.current_url)
print("Title:", driver.title)
driver.save_screenshot("/tmp/store_admin_loaded.png")
print("Screenshot saved to /tmp/store_admin_loaded.png")
