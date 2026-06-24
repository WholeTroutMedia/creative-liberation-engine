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

# Locate eye button (reveal button) next to client secret input
# It has an eye icon (svg with name eye)
reveal_btns = driver.find_elements(By.XPATH, "//button[descendant::*[local-name()='svg'] or contains(@class, 'button')]")
print(f"Found {len(reveal_btns)} buttons on page.")

# Let's locate the button precisely by sibling or matching its grid position
# The eye button is next to Client ID and Secret in settings_page.png
# Let's find button that has class or svg inside Credentials card
# Credentials card has title "Credentials"
credentials_card = driver.find_elements(By.XPATH, "//div[contains(., 'Credentials')]")
if credentials_card:
    print("Found Credentials section. Locating buttons inside it...")
    # Find all buttons inside the credentials card
    btns = credentials_card[0].find_elements(By.XPATH, ".//button")
    print(f"Found {len(btns)} buttons in Credentials card.")
    if len(btns) >= 1:
        print("Clicking the first button (Reveal)...")
        driver.execute_script("arguments[0].click();", btns[0])
        time.sleep(3)
        
        # Now find the Client Secret value! It might be inside a text block or input field
        # Let's dump all text or input values in the credentials card
        inputs = credentials_card[0].find_elements(By.XPATH, ".//input or .//span or .//p")
        for inp in inputs:
            text = inp.text or inp.get_attribute("value")
            if text and not text.startswith("•") and len(text) > 20:
                print(f"Extracted potential secret/credential: {text}")
                
        driver.save_screenshot("/tmp/revealed_secret.png")
        print("Screenshot saved to /tmp/revealed_secret.png")
else:
    print("ERROR: Credentials card not found!")
