content = open("/home/seluser/uninstall_and_reinstall_js_intercept.py").read()
anchor = "driver.execute_script(\"arguments[0].click();\", install_btn)"
idx = content.find(anchor)
if idx != -1:
    patched_code = content[:idx + len(anchor)] + """

    # Start high-frequency polling loop of the iframe src for 25 seconds
    print("[POLLING] Starting high-frequency iframe src polling...")
    start_time = time.time()
    code = None
    captured_src = None
    while time.time() - start_time < 25:
        try:
            iframes = driver.find_elements(By.XPATH, "//iframe")
            for iframe in iframes:
                src = iframe.get_attribute("src")
                if src and "code=" in src:
                    captured_src = src
                    parsed = urlparse.urlparse(src)
                    code = urlparse.parse_qs(parsed.query).get("code", [None])[0]
                    break
        except Exception:
            pass
            
        if code:
            break
        time.sleep(0.005)
        
    if code:
        print("[INTERCEPT SUCCESS] Captured Auth Code:", code)
        
        # === STEP 3: EXCHANGE FOR ACCESS TOKEN ===
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
            token_url = f"https://{domain}/admin/api/oauth/access_token"
            print("[TOKEN EXCHANGE] Sending POST request to:", domain)
            try:
                res = requests.post(token_url, json=payload, headers={"Content-Type": "application/json"})
                print("Status Code:", res.status_code)
                res_data = res.json()
                print("Payload:", res_data)
                if "access_token" in res_data:
                    token = res_data["access_token"]
                    print("[TOKEN SUCCESS] Access token exchanged successfully:", token)
                    break
            except Exception as e:
                print("Failed on domain", domain, ":", e)
                
        if token:
            with open("/home/seluser/access_token.txt", "w", encoding="utf-8") as f:
                f.write(token)
            print("[SUCCESS] Decrypted token saved to /home/seluser/access_token.txt")
            
            # Write to NAS .env file
            try:
                env_path = "/app/creative-liberation-engine/services/latent-space-engine/.env"
                lines = open(env_path).readlines()
                new_lines = []
                for line in lines:
                    if line.startswith("SHOPIFY_ADMIN_ACCESS_TOKEN="):
                        new_lines.append(f"SHOPIFY_ADMIN_ACCESS_TOKEN={token}\n")
                    else:
                        new_lines.append(line)
                open(env_path, "w").write("".join(new_lines))
                print("[SUCCESS] NAS .env file successfully hydrated!")
            except Exception as e:
               print("Failed to write to NAS .env:", e)
                
            return True
        else:
            print("[ERROR] Token exchanged failed!")
            return False
    else:
        print("[ERROR] Failed to capture authorization code via high-frequency DOM polling!")
        return False

if __name__ == '__main__':
    run_flow()"""
    open("/home/seluser/cdp_automated_install.py", "w").write(patched_code)
    print("SUCCESSFULC PATCHED!")
else:
    print("ERROR: Anchor not found!")
