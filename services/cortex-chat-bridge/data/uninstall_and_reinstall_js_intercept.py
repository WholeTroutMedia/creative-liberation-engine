import time
import requests
import json
import urllib.parse as urlparse
import websocket
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")

def run_flow():
    driver = webdriver.Chrome(options=opts)
    
    # === STEP 1: UNINSTALL ===
    print("[UNINSTALL] Navigating to settings -> Apps...")
    driver.get("https://admin.shopify.com/store/latent-space-studios/settings/apps")
    
    print("[UNINSTALL] Waiting for apps list to load...")
    try:
        WebDriverWait(driver, 25).until(
            EC.presence_of_element_located((By.XPATH, "//button[@aria-label='More actions']"))
        )
        time.sleep(3)
        print("[UNINSTALL] Apps list loaded successfully.")
    except Exception as e:
        print("[UNINSTALL WARNING] Wait timed out or no 'More actions' buttons found:", e)

    btns = driver.find_elements(By.XPATH, "//button[@aria-label='More actions']")
    print(f"[UNINSTALL] Found {len(btns)} 'More actions' button(s) on the page.")
    
    uninstall_btn_to_click = None
    try:
        app_name_el = driver.find_element(By.XPATH, "//*[text()='Creative Liberation Collective']")
        print("[UNINSTALL] Found row with 'Creative Liberation Collective'. Locating its button...")
        parent = app_name_el
        for _ in range(5):
            parent = parent.find_element(By.XPATH, "..")
            found_btns = parent.find_elements(By.XPATH, ".//button[@aria-label='More actions']")
            if found_btns:
                uninstall_btn_to_click = found_btns[0]
                break
    except Exception as e:
        print("[UNINSTALL] Could not find 'Creative Liberation Collective' row specifically:", e)
        
    if uninstall_btn_to_click is None and len(btns) >= 2:
        print("[UNINSTALL] Falling back to first 'More actions' button...")
        uninstall_btn_to_click = btns[0]

    if uninstall_btn_to_click is not None:
        print("[UNINSTALL] App is currently installed. Proceeding with uninstallation...")
        print("[UNINSTALL] Clicking 'More actions' button...")
        driver.execute_script("arguments[0].click();", uninstall_btn_to_click)
        
        print("[UNINSTALL] Waiting for dropdown menu...")
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//*[text()='Uninstall']"))
        )
        opts_el = driver.find_elements(By.XPATH, "//*[text()='Uninstall']")
        if not opts_el:
            print("[UNINSTALL ERROR] Uninstall option not found in menu!")
            return False
            
        print("[UNINSTALL] Clicking 'Uninstall' option...")
        driver.execute_script("arguments[0].click();", opts_el[0])
        
        print("[UNINSTALL] Waiting for custom dropdown button...")
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//button[@aria-label='Select all that apply' or contains(., 'Select all that apply')]"))
        )
        dropdown_btn = driver.find_elements(By.XPATH, "//button[@aria-label='Select all that apply' or contains(., 'Select all that apply')]")
        if not dropdown_btn:
            print("[UNINSTALL ERROR] Custom dropdown button not found!")
            return False
            
        print("[UNINSTALL] Clicking custom dropdown button...")
        driver.execute_script("arguments[0].click();", dropdown_btn[0])
        
        print("[UNINSTALL] Waiting for reason option...")
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//*[text()='Testing multiple apps']"))
        )
        reason_opts = driver.find_elements(By.XPATH, "//*[text()='Testing multiple apps']")
        if not reason_opts:
            print("[UNINSTALL ERROR] Uninstallation reason option not found!")
            return False
            
        print("[UNINSTALL] Selecting reason...")
        driver.execute_script("arguments[0].click();", reason_opts[0])
        time.sleep(2)
        
        print("[UNINSTALL] Locating confirm Uninstall button...")
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
            
        print("[UNINSTALL] Waiting 10 seconds for uninstallation to complete...")
        time.sleep(10)
        print("[UNINSTALL SUCCESS] App uninstalled successfully!")
    else:
        print("[UNINSTALL] App is already uninstalled. Skipping uninstallation...")
    
    # === STEP 2: INSTALL ===
    print("[INSTALL] Navigating to app install trigger URL...")
    install_url = "https://admin.shopify.com/?organization_id=219666621&no_redirect=true&redirect=/oauth/redirect_from_developer_dashboard?client_id%3D97b9cc7fd58c6365df94af95e5061b8e"
    driver.get(install_url)
    
    print("[INSTALL] Waiting for store selector cards to load...")
    WebDriverWait(driver, 25).until(
        EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'latent-space-studios.myshopify.com') or contains(text(), 'Latent Space Studios')]"))
    )
    time.sleep(2)
    
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
    
    print("[INSTALL] Waiting up to 25 seconds for grant page and install button (proceed_cta) to appear...")
    try:
        WebDriverWait(driver, 25).until(
            EC.presence_of_element_located((By.ID, "proceed_cta"))
        )
        print("[INSTALL] Grant page loaded. proceed_cta button found.")
    except Exception as e:
        print("[INSTALL ERROR] Install button (proceed_cta) did not appear! Saving debug screenshot...")
        driver.save_screenshot("/home/seluser/install_failed_grant_page.png")
        return False
        
    try:
        install_btn = driver.find_element(By.ID, "proceed_cta")
    except Exception:
        print("[INSTALL ERROR] Install button (proceed_cta) not found on grant page!")
        return False
        
    print("[INSTALL] Clicking 'Install' button...")
    driver.execute_script("arguments[0].click();", install_btn)
    
    # Wait for the parent page to navigate and find the new target
    print("[CDP] Waiting for new Shopify Admin page target...")
    ws_url = None
    start_wait = time.time()
    while time.time() - start_wait < 15:
        try:
            res = requests.get("http://127.0.0.1:9222/json")
            targets = res.json()
            for target in targets:
                url = target.get('url', '')
                if '/apps/cle-engine-systems' in url:
                    ws_url = target.get('webSocketDebuggerUrl')
                    break
        except Exception as ex:
            pass
        if ws_url:
            break
        time.sleep(0.1)
        
    if not ws_url:
        print("[CDP ERROR] New page target not found!")
        return False
        
    print(f"[CDP] Connecting to new page target: {ws_url}")
    try:
        ws = websocket.create_connection(ws_url, suppress_origin=True)
        ws.settimeout(2.0)
        ws.send(json.dumps({"id": 1, "method": "Network.enable"}))
        print("[CDP] Network tracking enabled on new page target.")
    except Exception as ex:
        print("[CDP CONNECTION ERROR] Failed to connect to new page target:", ex)
        return False
        
    # Poll the WebSocket messages for the authorization code
    start_time = time.time()
    code = None
    captured_url = None
    
    print("[CDP] Polling network requests for 25 seconds...")
    while time.time() - start_time < 25:
        try:
            msg = ws.recv()
            event = json.loads(msg)
            
            if event.get('method') == 'Network.requestWillBeSent':
                url = event.get('params', {}).get('request', {}).get('url', '')
                if 'code=' in url and ('shpca_' in url or 'callback' in url or 'oauth' in url or '97b9cc7f' in url):
                    print(f"[CDP CAPTURED EVENT] {url}")
                    parsed = urlparse.urlparse(url)
                    code = urlparse.parse_qs(parsed.query).get('code', [None])[0]
                    if code:
                        captured_url = url
                        print(f"[CDP SUCCESS] Captured Auth Code: {code}")
                        break
        except websocket.WebSocketTimeoutException:
            pass
        except Exception as e:
            print("[CDP ERROR] Error receiving WebSocket message:", e)
            break
            
    ws.close()
    print("[CDP] WebSocket closed.")
    driver.save_screenshot("/home/seluser/after_js_install_click.png")
    
    if code:
        # === STEP 4: EXCHANGE FOR ACCESS TOKEN ===
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
        print("[ERROR] Failed to capture authorization code in network logs!")
        return False

if __name__ == "__main__":
    run_flow()
