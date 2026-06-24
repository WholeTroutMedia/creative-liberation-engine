import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
try:
    driver = webdriver.Chrome(options=opts)
    print("Navigating to settings -> Apps...")
    driver.get("https://admin.shopify.com/store/latent-space-studios/settings/apps")
    time.sleep(8)
    
    print("Current URL:", driver.current_url)
    
    # 1. Find Creative Liberation Collective row
    app_rows = driver.find_elements(By.XPATH, "//*[contains(text(), 'Creative Liberation Collective')]/ancestor::div[contains(@class, 'Polaris') or contains(@class, 'Card') or contains(@class, 'row') or contains(@class, 'item') or @role='row']")
    print(f"Found {len(app_rows)} matching rows.")
    
    if app_rows:
        row = app_rows[0]
        # Find button inside that row
        btn = row.find_element(By.XPATH, ".//button")
        print("Found action button! Clicking...")
        driver.execute_script("arguments[0].click();", btn)
        time.sleep(3)
        
        # Take screenshot of the opened menu
        driver.save_screenshot("/home/seluser/dots_clicked.png")
        print("Screenshot of dots menu saved to /home/seluser/dots_clicked.png")
        
        # 2. Click Uninstall option
        options = driver.find_elements(By.XPATH, "//*[contains(text(), 'Uninstall') or contains(text(), 'Delete') or contains(text(), 'Remove')]")
        print(f"Found {len(options)} potential uninstall options.")
        if options:
            print("Clicking uninstall option...")
            driver.execute_script("arguments[0].click();", options[0])
            time.sleep(4)
            
            # Take screenshot of confirmation modal
            driver.save_screenshot("/home/seluser/confirm_modal.png")
            print("Screenshot of modal saved to /home/seluser/confirm_modal.png")
            
            # 3. Click the confirm button in the modal
            confirm_btns = driver.find_elements(By.XPATH, "//button[contains(., 'Uninstall') or contains(@class, 'destructive') or contains(@class, 'critical') or contains(@class, 'primary')]")
            print(f"Found {len(confirm_btns)} potential confirm buttons.")
            
            clicked = False
            for c_btn in confirm_btns:
                text = c_btn.text.strip()
                print(f"Button text: '{text}'")
                if text == "Uninstall" or text == "Delete" or text == "Remove":
                    print("Clicking confirm button!")
                    driver.execute_script("arguments[0].click();", c_btn)
                    clicked = True
                    break
            
            if not clicked and confirm_btns:
                print("Clicking first available modal button...")
                driver.execute_script("arguments[0].click();", confirm_btns[0])
                clicked = True
                
            if clicked:
                time.sleep(8)
                driver.save_screenshot("/home/seluser/after_uninstall.png")
                print("Screenshot after uninstall saved.")
            else:
                print("ERROR: Confirm button not found or clicked!")
        else:
            print("ERROR: Uninstall option not found in menu!")
    else:
        # Fallback
        print("Fallback: Finding all buttons on the page with three dots...")
        btns = driver.find_elements(By.XPATH, "//button[contains(@aria-label, 'actions') or @aria-haspopup='true']")
        print(f"Found {len(btns)} buttons.")
        if len(btns) >= 2:
            print("Clicking first actions button...")
            driver.execute_script("arguments[0].click();", btns[0])
            time.sleep(3)
            driver.save_screenshot("/home/seluser/dots_clicked_fallback.png")
except Exception as e:
    print("ERROR:", e)
