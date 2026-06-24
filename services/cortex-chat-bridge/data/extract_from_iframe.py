import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
try:
    driver = webdriver.Chrome(options=opts)
    print("CURRENT TOP URL:", driver.current_url)
    
    iframes = driver.find_elements(By.NAME, "app-iframe")
    if not iframes:
        iframes = driver.find_elements(By.XPATH, "//iframe")
        
    if iframes:
        print("Found iframe! Switching context...")
        driver.switch_to.frame(iframes[0])
        print("Switched successfully!")
        
        # Extract location href
        href = driver.execute_script("return window.location.href;")
        print("Iframe location.href:", href)
        
        # Extract navigation entry
        nav_entries = driver.execute_script("return window.performance.getEntriesByType('navigation');")
        print("Navigation entries count:", len(nav_entries))
        for entry in nav_entries:
            print("Nav Entry Name:", entry.get('name'))
            
        # Extract all performance entries
        all_entries = driver.execute_script("return JSON.stringify(window.performance.getEntries());")
        print("Performance entries:", all_entries[:500])
        
        driver.switch_to.default_content()
    else:
        print("ERROR: Iframe not found on page!")
except Exception as e:
    print("ERROR:", e)
