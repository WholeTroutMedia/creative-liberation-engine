import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)
print("Current URL:", driver.current_url)

# Find the store card or text
store_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'latent-space-studios.myshopify.com')]")
if not store_elements:
    store_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'Latent Space Studios')]")

if store_elements:
    print("Found store element! Clicking...")
    driver.execute_script("arguments[0].click();", store_elements[0])
    time.sleep(12)
    
    print("New URL after clicking store card:", driver.current_url)
    print("New Page Title:", driver.title)
    driver.save_screenshot("/tmp/authorize_page_loaded.png")
    print("Screenshot saved to /tmp/authorize_page_loaded.png")
    
    with open("/tmp/authorize_page_dom.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("DOM dumped.")
else:
    print("ERROR: Store element not found on page!")
