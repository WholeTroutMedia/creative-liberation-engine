import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)

print("Current URL:", driver.current_url)

# Find and click Develop apps button
develop_btns = driver.find_elements(By.XPATH, "//button[contains(., 'Develop apps') or contains(text(), 'Develop apps')]")
if not develop_btns:
    develop_btns = driver.find_elements(By.XPATH, "//*[contains(text(), 'Develop apps')]")

if develop_btns:
    print("Found 'Develop apps' button! Clicking...")
    driver.execute_script("arguments[0].click();", develop_btns[0])
    time.sleep(8)
    
    print("New URL after click:", driver.current_url)
    print("New Page Title:", driver.title)
    driver.save_screenshot("/tmp/develop_apps_clicked.png")
    print("Screenshot saved to /tmp/develop_apps_clicked.png")
    
    with open("/tmp/develop_apps_clicked_dom.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("DOM dumped.")
else:
    print("ERROR: 'Develop apps' button not found!")
