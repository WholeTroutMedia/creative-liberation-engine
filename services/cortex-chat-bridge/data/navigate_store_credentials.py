import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)

print("Navigating to develop apps list in admin settings...")
driver.get("https://admin.shopify.com/store/latent-space-studios/settings/apps/development")
time.sleep(12)

print("Current URL:", driver.current_url)
print("Title:", driver.title)
driver.save_screenshot("/tmp/custom_apps_list.png")
print("Screenshot saved to /tmp/custom_apps_list.png")

# Let's locate the Creative Liberation Collective app in the list and click it
app_rows = driver.find_elements(By.XPATH, "//*[contains(text(), 'Creative Liberation Collective')]")
if app_rows:
    print("Found Creative Liberation Collective row! Clicking it...")
    driver.execute_script("arguments[0].click();", app_rows[0])
    time.sleep(8)
    
    print("URL after clicking app row:", driver.current_url)
    driver.save_screenshot("/tmp/custom_app_details.png")
    print("Screenshot saved to /tmp/custom_app_details.png")
    
    with open("/tmp/custom_app_details_dom.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("Details DOM dumped.")
else:
    print("ERROR: Creative Liberation Collective app row not found in developer apps list!")
    with open("/tmp/custom_apps_list_dom.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("List DOM dumped.")
