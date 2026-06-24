import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
try:
    driver = webdriver.Chrome(options=opts)
    print("Navigating to app install trigger URL...")
    install_url = "https://admin.shopify.com/?organization_id=219666621&no_redirect=true&redirect=/oauth/redirect_from_developer_dashboard?client_id%3D97b9cc7fd58c6365df94af95e5061b8e"
    driver.get(install_url)
    time.sleep(8)
    
    print("CURRENT URL:", driver.current_url)
    print("CURRENT TITLE:", driver.title)
    driver.save_screenshot("/home/seluser/install_step1.png")
    print("Screenshot saved to /home/seluser/install_step1.png")
    
    with open("/home/seluser/install_step1_dom.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("DOM saved.")
except Exception as e:
    print("ERROR:", e)
