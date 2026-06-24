import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option('debuggerAddress', '127.0.0.1:9222')
driver = webdriver.Chrome(options=opts)
print('Navigating...')
driver.get('https://admin.shopify.com/store/latent-space-studios/settings/apps')
time.sleep(10)
print('URL:', driver.current_url)
print('Title:', driver.title)
driver.save_screenshot('/home/seluser/settings_apps_list.png')
btns = driver.find_elements(By.XPATH, '//button')
print(f'Buttons: {len(btns)}')
for i, b in enumerate(btns):
    try:
        txt = b.text.strip()
        label = b.get_attribute('aria-label')
        if txt or label:
            print(f'Btn {i}: Text="{txt}", Aria-Label="{label}"')
    except Exception as e:
        pass
