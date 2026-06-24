import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
try:
    driver = webdriver.Chrome(options=opts)
    print("CURRENT URL:", driver.current_url)
    
    iframes = driver.find_elements(By.XPATH, "//iframe")
    print(f"Found {len(iframes)} iframe(s) on current page.")
    for idx, iframe in enumerate(iframes):
        print(f"[{idx}] Name: {iframe.get_attribute('name')} | Src: {iframe.get_attribute('src')[:150]}...")
        
    with open("/home/seluser/after_install_inspect_dom.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("DOM dumped.")
except Exception as e:
    print("ERROR:", e)
