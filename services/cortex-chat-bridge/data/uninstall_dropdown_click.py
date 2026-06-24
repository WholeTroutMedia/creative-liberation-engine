import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
try:
    driver = webdriver.Chrome(options=opts)
    print("Opening uninstallation dropdown...")
    
    dropdown_btn = driver.find_element(By.XPATH, "//button[@aria-label='Select all that apply' or contains(., 'Select all that apply')]")
    print("Found dropdown button! Clicking...")
    driver.execute_script("arguments[0].click();", dropdown_btn)
    time.sleep(3)
    
    driver.save_screenshot("/home/seluser/dropdown_opened.png")
    print("Screenshot saved to /home/seluser/dropdown_opened.png")
    
    # Locate all options inside the listbox or custom popup
    options = driver.find_elements(By.XPATH, "//*[@role='option'] | //*[contains(@class, 'Option')] | //li[contains(@class, 'Option')]")
    print(f"Found {len(options)} options via role/class search.")
    
    for idx, opt in enumerate(options):
        print(f"Option {idx} Text: {opt.text}")
        
    with open("/home/seluser/dropdown_opened_dom.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("DOM saved.")
except Exception as e:
    print("ERROR:", e)
