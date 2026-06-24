import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)
print("Current URL:", driver.current_url)

# Find all buttons containing the word Install
install_btns = driver.find_elements(By.XPATH, "//button[contains(., 'Install')]")
if install_btns:
    # Target the visible and clickable one
    target_btn = None
    for btn in install_btns:
        if btn.is_displayed():
            target_btn = btn
            break
            
    if not target_btn:
        target_btn = install_btns[0]
        
    print(f"Found Install button! Text: '{target_btn.text}'. Clicking...")
    driver.execute_script("arguments[0].click();", target_btn)
    time.sleep(12)
    
    print("New URL after install:", driver.current_url)
    print("Page Title:", driver.title)
    driver.save_screenshot("/tmp/after_install.png")
    print("Screenshot saved to /tmp/after_install.png")
    
    with open("/tmp/after_install_dom.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("DOM dumped.")
else:
    print("ERROR: Install button not found!")
