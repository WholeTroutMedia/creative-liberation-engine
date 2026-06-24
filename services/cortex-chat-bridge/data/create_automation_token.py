import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)
print("Navigating to settings...")
driver.get("https://dev.shopify.com/dashboard/219666621/apps/371742310401/settings")
time.sleep(6)

create_token_btns = driver.find_elements(By.XPATH, "//button[contains(text(), 'Create token')]")
if create_token_btns:
    print("Found 'Create token' button! Clicking...")
    driver.execute_script("arguments[0].click();", create_token_btns[0])
    time.sleep(5)
    
    # Save screenshot of what happened
    driver.save_screenshot("/tmp/after_create_token.png")
    print("Screenshot saved to /tmp/after_create_token.png")
    
    # Let's inspect the page or modal
    with open("/tmp/after_create_token_dom.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("DOM dumped after token click.")
else:
    print("ERROR: 'Create token' button not found!")
