import os
import json
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)

print("Navigating to admin settings apps...")
driver.get("https://admin.shopify.com/store/latent-space-studios/settings/apps")
time.sleep(6)

print("Browser Current URL:", driver.current_url)

# 1. Print all cookies
print("=============================================================")
print("COOKIES")
print("=============================================================")
cookies = driver.get_cookies()
for cookie in cookies:
    print(f"Name: {cookie['name']} | Domain: {cookie['domain']} | Value: {cookie['value'][:25]}...")

# 2. Print local storage
print("=============================================================")
print("LOCAL STORAGE")
print("=============================================================")
try:
    local_storage = driver.execute_script("return JSON.stringify(window.localStorage);")
    ls_dict = json.loads(local_storage)
    for k, v in ls_dict.items():
        val_str = str(v)
        print(f"Key: {k} | Value: {val_str[:40]}...")
        if "shpat" in val_str or "atkn" in val_str:
            print(f"*** FOUND KEY: {k} = {val_str} ***")
except Exception as e:
    print("Failed to read local storage:", e)

# 3. Print session storage
print("=============================================================")
print("SESSION STORAGE")
print("=============================================================")
try:
    session_storage = driver.execute_script("return JSON.stringify(window.sessionStorage);")
    ss_dict = json.loads(session_storage)
    for k, v in ss_dict.items():
        val_str = str(v)
        print(f"Key: {k} | Value: {val_str[:40]}...")
except Exception as e:
    print("Failed to read session storage:", e)
