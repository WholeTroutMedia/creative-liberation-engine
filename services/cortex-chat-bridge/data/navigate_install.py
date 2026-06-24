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

install_links = driver.find_elements(By.XPATH, "//a[descendant::*[contains(text(), 'Install app')] or contains(text(), 'Install app')]")
if install_links:
    href = install_links[0].get_attribute("href")
    print(f"Found 'Install app' link! URL: {href}")
    print("Navigating directly in the same tab...")
    driver.get(href)
    time.sleep(12)
    
    print("New Page URL:", driver.current_url)
    print("New Page Title:", driver.title)
    driver.save_screenshot("/tmp/install_page_loaded.png")
    print("Screenshot saved to /tmp/install_page_loaded.png")
    
    with open("/tmp/install_page_dom.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("DOM dumped.")
else:
    print("ERROR: 'Install app' link not found!")
