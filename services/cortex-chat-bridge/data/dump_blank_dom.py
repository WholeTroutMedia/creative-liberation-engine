import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)
print("Current URL:", driver.current_url)
print("Title:", driver.title)
with open("/tmp/blank_dom.html", "w", encoding="utf-8") as f:
    f.write(driver.page_source)
print("DOM dumped!")
