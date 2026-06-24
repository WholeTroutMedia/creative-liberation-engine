import time
import requests
import json
import urllib.parse as urlparse
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
try:
    driver = webdriver.Chrome(options=opts)
    print("CURRENT URL before install click:", driver.current_url)
    
    install_btn = driver.find_element(By.ID, "proceed_cta")
    print("Found 'Install' button! Clicking and starting high-frequency URL interception loop...")
    driver.execute_script("arguments[0].click();", install_btn)
    
    # Poll driver.current_url every 10ms for 8 seconds
    start_time = time.time()
    intercepted_url = None
    while time.time() - start_time < 8:
        url = driver.current_url
        if "code=" in url or "example.com" in url:
            intercepted_url = url
            break
        time.sleep(0.01)
        
    print("POLLING LOOP FINISHED.")
    print("Intercepted URL:", intercepted_url or driver.current_url)
    
    # Save a screenshot just in case
    driver.save_screenshot("/home/seluser/after_install_click.png")
    
    if intercepted_url and "code=" in intercepted_url:
        parsed = urlparse.urlparse(intercepted_url)
        code = urlparse.parse_qs(parsed.query).get('code', [None])[0]
        print(f"SUCCESSFULLY INTERCEPTED AUTH CODE: {code}")
        
        # Now exchange the code for the offline access token!
        client_id = "97b9cc7fd58c6365df94af95e5061b8e"
        client_secret = "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"
        
        payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code
        }
        
        # Try both domains
        domains = ["nhkfcf-pf.myshopify.com", "latent-space-studios.myshopify.com"]
        token = None
        for domain in domains:
            token_url = f"https://{domain}/admin/oauth/access_token"
            print(f"Exchanging code on domain {domain}...")
            try:
                res = requests.post(token_url, json=payload, headers={"Content-Type": "application/json"})
                print(f"Response status: {res.status_code}")
                res_data = res.json()
                print("Response payload:", res_data)
                if "access_token" in res_data:
                    token = res_data["access_token"]
                    print(f"SUCCESS! Access Token is: {token}")
                    break
            except Exception as e:
                print(f"Failed on domain {domain}: {e}")
                
        if token:
            with open("/home/seluser/access_token.txt", "w", encoding="utf-8") as f:
                f.write(token)
            print("Access Token saved to /home/seluser/access_token.txt")
        else:
            print("ERROR: Failed to exchange authorization code for access token!")
    else:
        print("ERROR: Authorization code was not intercepted in URL!")
except Exception as e:
    print("ERROR:", e)
