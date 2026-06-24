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

create_token_btns = driver.find_elements(By.XPATH, "//button[@data-modal-id-param='create_cli_token']")
if create_token_btns:
    print("Found 'Create token' button! Clicking...")
    driver.execute_script("arguments[0].click();", create_token_btns[0])
    time.sleep(3)
    
    generate_btns = driver.find_elements(By.XPATH, "//button[@type='submit' and descendant::*[contains(text(), 'Generate token')]]")
    if generate_btns:
        print("Found 'Generate token' button! Clicking...")
        driver.execute_script("arguments[0].click();", generate_btns[0])
        time.sleep(8)
        
        # Save screenshot
        driver.save_screenshot("/tmp/generated_token.png")
        print("Screenshot saved to /tmp/generated_token.png")
        
        # Dump DOM
        with open("/tmp/generated_token_dom.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print("DOM dumped after token generation.")
    else:
        print("ERROR: 'Generate token' button inside modal not found!")
else:
    print("ERROR: 'Create token' button not found!")
