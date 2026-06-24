import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
try:
    driver = webdriver.Chrome(options=opts)
    print("CURRENT URL:", driver.current_url)
    print("CURRENT TITLE:", driver.title)
    driver.save_screenshot("/home/seluser/current_state_inspect.png")
    print("Screenshot saved to /home/seluser/current_state_inspect.png")
    with open("/home/seluser/current_state_inspect_dom.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("DOM saved.")
except Exception as e:
    print("ERROR:", e)
