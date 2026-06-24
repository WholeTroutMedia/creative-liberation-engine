import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)
print("Navigating to overview...")
driver.get("https://dev.shopify.com/dashboard/219666621/apps/371742310401")
time.sleep(6)

install_btns = driver.find_elements(By.XPATH, "//button[descendant::*[contains(text(), 'Install app')] or contains(text(), 'Install app')]")
if install_btns:
    print("Found 'Install app' button! Clicking...")
    driver.execute_script("arguments[0].click();", install_btns[0])
    time.sleep(8)
    
    print("Current URL after click:", driver.current_url)
    driver.save_screenshot("/tmp/install_app_click.png")
    print("Screenshot saved to /tmp/install_app_click.png")
    
    with open("/tmp/install_app_click_dom.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("DOM dumped.")
else:
    print("ERROR: 'Install app' button not found!")
