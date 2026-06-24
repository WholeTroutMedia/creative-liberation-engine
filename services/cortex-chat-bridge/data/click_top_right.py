import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)
print("Current URL:", driver.current_url)

# Find top-right button containing Latent Space Studios
top_btn = driver.find_elements(By.XPATH, "//*[contains(text(), 'Latent Space Studios')]")
if top_btn:
    print("Found Latent Space Studios button in top right! Clicking...")
    driver.execute_script("arguments[0].click();", top_btn[0])
    time.sleep(6)
    print("New URL:", driver.current_url)
    driver.save_screenshot("/tmp/top_btn_click.png")
    print("Screenshot saved to /tmp/top_btn_click.png")
else:
    print("ERROR: Latent Space Studios button not found!")
