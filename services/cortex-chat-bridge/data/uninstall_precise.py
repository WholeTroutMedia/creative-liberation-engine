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
    
    btns = driver.find_elements(By.XPATH, "//button[@aria-label='More actions']")
    print(f"Found {len(btns)} 'More actions' buttons.")
    
    if btns:
        print("Clicking first 'More actions' button...")
        driver.execute_script("arguments[0].click();", btns[0])
        time.sleep(4)
        
        driver.save_screenshot("/home/seluser/after_click_dots.png")
        print("Screenshot saved to /home/seluser/after_click_dots.png")
        
        # Dump all text inside any overlays/menus
        menus = driver.find_elements(By.XPATH, "//*[contains(@class, 'popover') or contains(@class, 'portal') or contains(@class, 'Popover') or contains(@class, 'menu') or contains(@class, 'Dropdown')]")
        print(f"Found {len(menus)} overlays/menus.")
        for idx, m in enumerate(menus):
            print(f"Menu {idx} Text: {m.text}")
            
        with open("/home/seluser/after_click_dots_dom.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print("DOM saved.")
    else:
        print("ERROR: No 'More actions' buttons found!")
except Exception as e:
    print("ERROR:", e)
