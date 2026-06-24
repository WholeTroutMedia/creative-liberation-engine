import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)

print("Navigating to settings -> Apps and sales channels...")
driver.get("https://admin.shopify.com/store/latent-space-studios/settings/apps")
time.sleep(8)

# Find three dots button next to Creative Liberation Collective
# The app row contains text "Creative Liberation Collective"
# Let's locate the row parent and find the dots button within it
app_rows = driver.find_elements(By.XPATH, "//div[contains(., 'Creative Liberation Collective')]")
dots_btns = driver.find_elements(By.XPATH, "//*[local-name()='svg' and @name='horizontal-dots'] or //button[contains(@aria-label, 'actions')]")

# Let's write a quick loop to locate the correct dots button or click all of them to find out
print(f"Found {len(dots_btns)} action buttons.")
if dots_btns:
    print("Clicking the first action button...")
    driver.execute_script("arguments[0].click();", dots_btns[0])
    time.sleep(4)
    driver.save_screenshot("/tmp/dots_clicked.png")
    print("Screenshot saved to /tmp/dots_clicked.png")
    
    with open("/tmp/dots_clicked_dom.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("DOM dumped after action click.")
else:
    print("ERROR: Action button not found!")
