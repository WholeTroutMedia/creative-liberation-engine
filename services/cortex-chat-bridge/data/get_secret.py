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

credentials_card = driver.find_elements(By.XPATH, "//div[contains(., 'Credentials')]")
if credentials_card:
    print("Found Credentials section.")
    btns = credentials_card[0].find_elements(By.XPATH, ".//button")
    if len(btns) >= 1:
        print("Clicking reveal button...")
        driver.execute_script("arguments[0].click();", btns[0])
        time.sleep(4)
        
        # Save screenshot
        driver.save_screenshot("/tmp/revealed_secret.png")
        print("Screenshot saved.")
        
        # Now find the input fields in the credentials section
        # The secret field should have the decrypted text
        inputs = credentials_card[0].find_elements(By.XPATH, ".//input | .//span | .//p")
        print(f"Found {len(inputs)} elements in Credentials section.")
        for idx, inp in enumerate(inputs):
            text = inp.text or inp.get_attribute("value")
            if text:
                print(f"[{idx}] Text: {text}")
                if len(text) > 20 and not text.startswith("•") and text != "97b9cc7fd58c6365df94af95e5061b8e":
                    print(f"SUCCESS! Client Secret is: {text}")
                    with open("/tmp/extracted_secret.txt", "w", encoding="utf-8") as f:
                        f.write(text)
                    print("Saved to /tmp/extracted_secret.txt")
else:
    print("ERROR: Credentials section not found!")
