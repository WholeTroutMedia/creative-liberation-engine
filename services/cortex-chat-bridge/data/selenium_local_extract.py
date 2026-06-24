import os
import sys
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

OUTPUT_DIR = "/tmp"

def main():
    print("=============================================================")
    print("CLE ENGINE SYSTEMS: DIRECT SELENIUM SCOPE SELECTION")
    print("=============================================================")
    
    opts = Options()
    opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
    
    try:
        driver = webdriver.Chrome(options=opts)
        print("Successfully attached to Chromium session!")
        
        # Target scopes to select
        target_scopes = [
            "write_products", "read_products", 
            "write_inventory", "read_inventory", 
            "write_orders", "read_orders"
        ]
        
        # Open Select Scopes drawer if it is closed
        select_drawer_btns = driver.find_elements(By.XPATH, "//*[contains(text(), 'Select scopes')]")
        if select_drawer_btns and select_drawer_btns[0].is_displayed():
            print("Select Scopes drawer is closed. Clicking 'Select scopes' button...")
            driver.execute_script("arguments[0].click();", select_drawer_btns[0])
            time.sleep(4)
            
        print("Selecting checkboxes directly by ID...")
        for scope in target_scopes:
            try:
                # Find checkbox directly by ID or XPATH
                cb = driver.find_element(By.ID, scope)
                if not cb.is_selected():
                    driver.execute_script("arguments[0].click();", cb)
                    print(f"Successfully checked: {scope}")
                else:
                    print(f"Already checked: {scope}")
            except Exception as e:
                # Fallback to search by input id or name
                try:
                    cbs = driver.find_elements(By.XPATH, f"//input[@id='{scope}' or @name='{scope}']")
                    if cbs:
                        if not cbs[0].is_selected():
                            driver.execute_script("arguments[0].click();", cbs[0])
                            print(f"Successfully checked (fallback XPATH): {scope}")
                        else:
                            print(f"Already checked (fallback XPATH): {scope}")
                    else:
                        print(f"WARNING: Scope '{scope}' checkbox not found!")
                except Exception as inner_e:
                    print(f"ERROR checking scope '{scope}': {inner_e}")
                    
        time.sleep(2)
        driver.save_screenshot(f"{OUTPUT_DIR}/extract_4_scopes_selected.png")
        
        # Click "Done" button
        done_btns = driver.find_elements(By.XPATH, "//button[contains(text(), 'Done')]")
        if not done_btns:
            done_btns = driver.find_elements(By.XPATH, "//*[contains(text(), 'Done')]")
            
        if done_btns:
            print("Found 'Done' button. Clicking...")
            driver.execute_script("arguments[0].click();", done_btns[0])
            time.sleep(3)
        else:
            print("ERROR: 'Done' button not found!")
            
        # Click "Release" button at the top right
        release_btns = driver.find_elements(By.XPATH, "//button[contains(text(), 'Release')]")
        if not release_btns:
            release_btns = driver.find_elements(By.XPATH, "//*[contains(text(), 'Release')]")
            
        if release_btns:
            print("Found 'Release' button. Clicking...")
            driver.execute_script("arguments[0].click();", release_btns[0])
            time.sleep(4)
            
            # Handle confirmation dialog if any
            confirm_btns = driver.find_elements(By.XPATH, "//button[contains(text(), 'Release') or contains(text(), 'Confirm')]")
            # Select the button in the modal dialog specifically
            for btn in confirm_btns:
                # Ensure it's not the same page release button
                if btn.is_displayed() and btn != release_btns[0]:
                    print("Found confirmation Release button. Clicking...")
                    driver.execute_script("arguments[0].click();", btn)
                    time.sleep(6)
                    break
                    
            driver.save_screenshot(f"{OUTPUT_DIR}/extract_5_released.png")
            print(f"Current URL after release: {driver.current_url}")
        else:
            print("ERROR: 'Release' button not found!")

    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
