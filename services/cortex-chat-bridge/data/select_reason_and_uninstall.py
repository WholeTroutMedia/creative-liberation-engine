import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
try:
    driver = webdriver.Chrome(options=opts)
    print("Selecting uninstallation reason...")
    
    selects = driver.find_elements(By.XPATH, "//select")
    if selects:
        select = Select(selects[0])
        select.select_by_index(1)
        print("Reason selected.")
        time.sleep(2)
        
        confirm_btns = driver.find_elements(By.XPATH, "//button[contains(., 'Uninstall') or contains(@class, 'destructive') or contains(@class, 'critical') or contains(@class, 'primary')]")
        print(f"Found {len(confirm_btns)} buttons after selecting reason.")
        
        clicked = False
        for c_btn in confirm_btns:
            text = c_btn.text.strip()
            print(f"Button: '{text}', Enabled: {c_btn.is_enabled()}")
            if text == "Uninstall" and c_btn.is_enabled():
                print("Clicking active confirm button...")
                driver.execute_script("arguments[0].click();", c_btn)
                clicked = True
                break
                
        if not clicked:
            footer_btns = driver.find_elements(By.XPATH, "//div[contains(@class, 'modal') or contains(@class, 'Modal')]//button")
            for c_btn in footer_btns:
                text = c_btn.text.strip()
                if text == "Uninstall":
                    print("Clicking footer uninstall button...")
                    driver.execute_script("arguments[0].click();", c_btn)
                    clicked = True
                    break
                    
        if clicked:
            time.sleep(8)
            driver.save_screenshot("/home/seluser/after_uninstall_done.png")
            print("Successfully uninstalled app! Screenshot saved.")
        else:
            print("ERROR: Could not find or click active Uninstall button!")
    else:
        print("ERROR: Dropdown select not found!")
except Exception as e:
    print("ERROR:", e)
