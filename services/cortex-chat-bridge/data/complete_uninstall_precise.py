import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
try:
    driver = webdriver.Chrome(options=opts)
    print("CURRENT URL:", driver.current_url)
    
    # 1. Locate Uninstall option
    opts_el = driver.find_elements(By.XPATH, "//*[text()='Uninstall']")
    print(f"Found {len(opts_el)} elements containing exact text 'Uninstall'.")
    if opts_el:
        print("Clicking 'Uninstall' option...")
        driver.execute_script("arguments[0].click();", opts_el[0])
        time.sleep(4)
        
        driver.save_screenshot("/home/seluser/confirm_modal_precise.png")
        print("Screenshot of modal saved to /home/seluser/confirm_modal_precise.png")
        
        # 2. Locate confirm button in modal
        # Usually it is a critical/destructive Polaris button
        confirm_btns = driver.find_elements(By.XPATH, "//button[contains(., 'Uninstall') or contains(@class, 'destructive') or contains(@class, 'critical') or contains(@class, 'primary')]")
        print(f"Found {len(confirm_btns)} potential confirm buttons in modal.")
        
        clicked = False
        for c_btn in confirm_btns:
            text = c_btn.text.strip()
            print(f"Button text: '{text}'")
            # We want the button that is inside the modal and says "Uninstall" or "Delete"
            if text == "Uninstall":
                print("Clicking confirm button...")
                driver.execute_script("arguments[0].click();", c_btn)
                clicked = True
                break
                
        if not clicked and confirm_btns:
            print("Clicking first available button in modal...")
            driver.execute_script("arguments[0].click();", confirm_btns[0])
            clicked = True
            
        if clicked:
            time.sleep(8)
            driver.save_screenshot("/home/seluser/after_uninstall_precise.png")
            print("Screenshot after uninstall saved to /home/seluser/after_uninstall_precise.png")
            with open("/home/seluser/after_uninstall_precise_dom.html", "w", encoding="utf-8") as f:
                f.write(driver.page_source)
            print("DOM saved.")
        else:
            print("ERROR: Confirm button not found or clicked!")
    else:
        print("ERROR: 'Uninstall' option not found!")
except Exception as e:
    print("ERROR:", e)
