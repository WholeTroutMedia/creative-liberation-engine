import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(options=opts)
print("Page URL:", driver.current_url)
with open("/tmp/settings_dom.html", "w", encoding="utf-8") as f:
    f.write(driver.page_source)
print("Settings page DOM dumped!")
