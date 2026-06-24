import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
try:
    driver = webdriver.Chrome(options=opts)
    print("Selecting uninstallation reason...")
    
    reason_opts = driver.find_elements(By.XPATH, "//*[text()='Testing multiple apps']")
    if reason_opts:
        print("Found 'Testing multiple apps' option! Clicking...")
        driver.execute_script("arguments[0].click();", reason_opts[0])
        time.sleep(3)
        
        driver.save_screenshot("/home/seluser/reason_selected.png")
        print("Screenshot saved to /home/seluser/reason_selected.png")
        
        # Click the now-enabled active Uninstall button
        buttons = driver.find_elements(By.XPATH, "//button")
        clicked = False
        for btn in buttons:
            text = btn.text.strip()
            # We want the button that says "Uninstall" and does NOT have 'disabled' in its class/attributes
            classes = ' '.join(btn.get_attribute("class").split())
            if text == "Uninstall" and "disabled" not in classes.lower() and btn.is_enabled():
                print(f"Clicking enabled Uninstall button with class: {classes}")
                driver.execute_script("arguments[0].click();", btn)
                clicked = True
                break
                
        if clicked:
            time.sleep(8)
            driver.save_screenshot("/home/seluser/uninstalled_final.png")
            print("Successfully uninstalled app! Screenshot saved to /home/seluser/uninstalled_final.png")
            with open("/home/seluser/uninstalled_final_dom.html", "w", encoding="utf-8") as f:
                f.write(driver.page_source)
            print("DOM saved.")
        else:
            print("ERROR: Enabled Uninstall button not found!")
    else:
        print("ERROR: Uninstallation reason option not found!")
except Exception as e:
    print("ERROR:", e)
