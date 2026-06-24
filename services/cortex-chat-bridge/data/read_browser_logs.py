from selenium import webdriver
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option('debuggerAddress', '127.0.0.1:9222')
driver = webdriver.Chrome(options=opts)

print("Fetching browser logs...")
try:
    logs = driver.get_log('browser')
    print(f"Found {len(logs)} browser log entries.")
    for entry in logs:
        print(entry)
except Exception as e:
    print("Failed to get browser logs:", e)
