import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
try:
    driver = webdriver.Chrome(options=opts)
    print("Navigating to app install trigger URL...")
    install_url = "https://admin.shopify.com/?organization_id=219666621&no_redirect=true&redirect=/oauth/redirect_from_developer_dashboard?client_id%3D97b9cc7fd58c6365df94af95e5061b8e"
    driver.get(install_url)
    time.sleep(8)
    
    print("Current URL:", driver.current_url)
    
    store_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'latent-space-studios.myshopify.com')]")
    if not store_elements:
        store_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'Latent Space Studios')]")
        
    if store_elements:
        print("Found store element! Clicking...")
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
        
        print("Current URL after store click:", driver.current_url)
        print("Page Title:", driver.title)
        driver.save_screenshot("/home/seluser/fresh_install_selector.png")
        print("Screenshot saved to /home/seluser/fresh_install_selector.png")
        with open("/home/seluser/fresh_install_selector_dom.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print("DOM saved.")
    else:
        print("ERROR: Store element not found!")
except Exception as e:
    print("ERROR:", e)
