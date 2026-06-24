import time
import requests
import json
import urllib.parse as urlparse
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")

def run_flow():
    driver = webdriver.Chrome(options=opts)
    
    # === STEP 1: UNINSTALL (Custom React Dropdown) ===
    print("[UNINSTALL] Navigating to settings -> Apps...")
    driver.get("https://admin.shopify.com/store/latent-space-studios/settings/apps")
    time.sleep(8)
    
    app_rows = driver.find_elements(By.XPATH, "//*[contains(text(), 'Creative Liberation Collective')]")
    if app_rows:
        print("[UNINSTALL] App is currently installed. Proceeding with custom uninstallation...")
        btns = driver.find_elements(By.XPATH, "//button[@aria-label='More actions']")
        if not btns:
            print("[UNINSTALL ERROR] No 'More actions' buttons found!")
            return False
            
        print("[UNINSTALL] Clicking 'More actions' button...")
        driver.execute_script("arguments[0].click();", btns[0])
        time.sleep(3)
        
        opts_el = driver.find_elements(By.XPATH, "//*[text()='Uninstall']")
        if not opts_el:
            print("[UNINSTALL ERROR] Uninstall option not found in menu!")
            return False
            
        print("[UNINSTALL] Clicking 'Uninstall' option...")
        driver.execute_script("arguments[0].click();", opts_el[0])
        time.sleep(4)
        
        # Click the custom dropdown button "Select all that apply"
        dropdown_btn = driver.find_elements(By.XPATH, "//button[@aria-label='Select all that apply' or contains(., 'Select all that apply')]")
        if not dropdown_btn:
            print("[UNINSTALL ERROR] Custom dropdown button 'Select all that apply' not found!")
            return False
            
        print("[UNINSTALL] Clicking custom dropdown button...")
        driver.execute_script("arguments[0].click();", dropdown_btn[0])
        time.sleep(3)
        
        # Click the "Testing multiple apps" option
        reason_opts = driver.find_elements(By.XPATH, "//*[text()='Testing multiple apps']")
        if not reason_opts:
            print("[UNINSTALL ERROR] Uninstallation reason 'Testing multiple apps' option not found!")
            return False
            
        print("[UNINSTALL] Selecting reason 'Testing multiple apps'...")
        driver.execute_script("arguments[0].click();", reason_opts[0])
        time.sleep(3)
        
        # Click the enabled Uninstall confirmation button
        buttons = driver.find_elements(By.XPATH, "//button")
        clicked = False
        for btn in buttons:
            text = btn.text.strip()
            classes = ' '.join(btn.get_attribute("class").split())
            if text == "Uninstall" and "disabled" not in classes.lower() and btn.is_enabled():
                print(f"[UNINSTALL] Clicking confirm button...")
                driver.execute_script("arguments[0].click();", btn)
                clicked = True
                break
                
        if not clicked:
            print("[UNINSTALL ERROR] Confirm button not found or not enabled!")
            return False
            
        print("[UNINSTALL] Waiting 8 seconds for uninstallation to complete...")
        time.sleep(8)
        print("[UNINSTALL SUCCESS] App uninstalled successfully!")
    else:
        print("[UNINSTALL] App is already uninstalled. Skipping uninstallation...")
    
    # === STEP 2: INSTALL & INTERCEPT ===
    print("[INSTALL] Navigating to app install trigger URL...")
    install_url = "https://admin.shopify.com/?organization_id=219666621&no_redirect=true&redirect=/oauth/redirect_from_developer_dashboard?client_id%3D97b9cc7fd58c6365df94af95e5061b8e"
    driver.get(install_url)
    time.sleep(8)
    
    store_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'latent-space-studios.myshopify.com')]")
    if not store_elements:
        store_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'Latent Space Studios')]")
        
    if not store_elements:
        print("[INSTALL ERROR] Store card selector not found!")
        return False
        
    print("[INSTALL] Clicking store selector card...")
    parent = store_elements[0]
    for _ in range(3):
        if parent.tag_name in ['a', 'button', 'div'] and parent.get_attribute("class") and "card" in parent.get_attribute("class"):
            break
        try:
            parent = parent.find_element(By.XPATH, "..")
        except:
            break
    driver.execute_script("arguments[0].click();", parent)
    time.sleep(10)
    
    # Find the Install button (proceed_cta)
    try:
        install_btn = driver.find_element(By.ID, "proceed_cta")
    except Exception:
        print("[INSTALL ERROR] Install button (proceed_cta) not found on grant page!")
        return False
        
    print("[INSTALL] Clicking 'Install' button and starting high-frequency iframe src interception...")
    driver.execute_script("arguments[0].click();", install_btn)
    
    # Start high-frequency polling loop of the iframe src for 15 seconds
    start_time = time.time()
    code = None
    captured_src = None
    while time.time() - start_time < 15:
        try:
            iframes = driver.find_elements(By.XPATH, "//iframe")
            for iframe in iframes:
                src = iframe.get_attribute("src")
                if src and "code=" in src:
                    captured_src = src
                    parsed = urlparse.urlparse(src)
                    code = urlparse.parse_qs(parsed.query).get('code', [None])[0]
                    break
        except Exception:
            pass
            
        if code:
            break
        time.sleep(0.005) # Poll every 5 milliseconds
        
    print("[POLLING FINISHED]")
    if code:
        print(f"[INTERCEPT SUCCESS] Captured Auth Code in Iframe Src: {code}")
        print(f"Captured Src URL: {captured_src}")
        
        # === STEP 3: EXCHANGE FOR TOKEN ===
        client_id = "97b9cc7fd58c6365df94af95e5061b8e"
        client_secret = "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"
        
        payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code
        }
        
        domains = ["nhkfcf-pf.myshopify.com", "latent-space-studios.myshopify.com"]
        token = None
        for domain in domains:
            token_url = f"https://{domain}/admin/oauth/access_token"
            print(f"[TOKEN EXCHANGE] Sending POST request to {domain}...")
            try:
                res = requests.post(token_url, json=payload, headers={"Content-Type": "application/json"})
                print(f"Status Code: {res.status_code}")
                res_data = res.json()
                print("Payload:", res_data)
                if "access_token" in res_data:
                    token = res_data["access_token"]
                    print(f"[TOKEN SUCCESS] Access token exchanged successfully: {token}")
                    break
            except Exception as e:
                print(f"Failed on domain {domain}: {e}")
                
        if token:
            with open("/home/seluser/access_token.txt", "w", encoding="utf-8") as f:
                f.write(token)
            print("[SUCCESS] Decrypted token saved to /home/seluser/access_token.txt")
            return True
        else:
            print("[ERROR] Token exchange failed!")
            return False
    else:
        print("[ERROR] Failed to capture authorization code in iframe src!")
        try:
            iframes = driver.find_elements(By.XPATH, "//iframe")
            print(f"Final iframe count: {len(iframes)}")
            for idx, iframe in enumerate(iframes):
                print(f"[{idx}] Src: {iframe.get_attribute('src')}")
        except:
            pass
        return False

if __name__ == "__main__":
    run_flow()
