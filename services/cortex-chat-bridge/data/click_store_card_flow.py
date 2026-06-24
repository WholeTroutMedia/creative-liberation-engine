import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
try:
    driver = webdriver.Chrome(options=opts)
    print("CURRENT URL before click:", driver.current_url)
    
    store_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'latent-space-studios.myshopify.com')]")
    if not store_elements:
        store_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'Latent Space Studios')]")
        
    if store_elements:
        print("Found store element! Clicking...")
        # Get parent container that is clickable if the element itself is not clickable
        parent = store_elements[0]
        for _ in range(3):
            if parent.tag_name in ['a', 'button', 'div'] and parent.get_attribute("class") and "card" in parent.get_attribute("class"):
                break
            try:
                parent = parent.find_element(By.XPATH, "..")
            except:
                break
        driver.execute_script("arguments[0].click();", parent)
        time.sleep(12)
        
        print("CURRENT URL after click:", driver.current_url)
        print("CURRENT TITLE:", driver.title)
        driver.save_screenshot("/home/seluser/authorize_page_loaded.png")
        print("Screenshot saved to /home/seluser/authorize_page_loaded.png")
        with open("/home/seluser/authorize_page_dom.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print("DOM saved.")
    else:
        print("ERROR: Store element not found on page!")
except Exception as e:
    print("ERROR:", e)
