import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option('debuggerAddress', '127.0.0.1:9222')
driver = webdriver.Chrome(options=opts)

print("Scrolling down and taking screenshots...")
try:
    driver.get('https://dev.shopify.com/dashboard/219666621/apps/371742310401/settings')
    time.sleep(6)
    
    # Take first screenshot
    driver.save_screenshot('/home/seluser/settings_scroll_1.png')
    
    # Scroll down 800px
    driver.execute_script("window.scrollTo(0, 800);")
    time.sleep(3)
    driver.save_screenshot('/home/seluser/settings_scroll_2.png')
    
    # Scroll down another 800px
    driver.execute_script("window.scrollTo(0, 1600);")
    time.sleep(3)
    driver.save_screenshot('/home/seluser/settings_scroll_3.png')
    
    print("Done scrolling.")
except Exception as e:
    print("Error during scroll:", e)
