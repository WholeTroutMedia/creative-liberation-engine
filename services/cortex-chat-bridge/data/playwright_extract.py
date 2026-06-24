import os
import sys
import time
from playwright.sync_api import sync_playwright

SELENIUM_URL = "http://cortex-browser:9222"
OUTPUT_DIR = "/app/data"
TOKEN_FILE = os.path.join(OUTPUT_DIR, "shopify_token.txt")
TARGET_URL = "https://admin.shopify.com/store/latent-space-studios/settings/apps/development"

def main():
    print("=============================================================")
    print("CLE ENGINE SYSTEMS: PLAYWRIGHT CDP EXTRACTOR")
    print("=============================================================")
    print(f"Connecting to clean Chromium at {SELENIUM_URL}...")
    
    with sync_playwright() as p:
        try:
            # Connect to existing organic Chromium instance over CDP
            browser = p.chromium.connect_over_cdp(SELENIUM_URL)
            print("Successfully connected over CDP!")
            
            # Find the active page or create one
            context = browser.contexts[0]
            if len(context.pages) > 0:
                page = context.pages[0]
                print(f"Attached to active page: {page.url}")
            else:
                page = context.new_page()
                print("Created new page.")
                
            print(f"Navigating to App Development Dashboard: {TARGET_URL}")
            page.goto(TARGET_URL, wait_until="load")
            page.wait_for_timeout(6000)
            
            try:
                page.screenshot(path=f"{OUTPUT_DIR}/extract_1_dashboard.png")
            except Exception:
                pass
            print(f"Active Page URL: {page.url} | Title: {page.title()}")

            # Enable Custom App Development if needed
            allow_btn = page.locator('button:has-text("Allow custom app development")')
            if allow_btn.count() > 0:
                print("[EXTRACT] Allowing custom app development...")
                allow_btn.first.click()
                page.wait_for_timeout(2000)
                page.locator('button:has-text("Allow custom app development")').first.click()
                page.wait_for_timeout(5000)
                try:
                    page.screenshot(path=f"{OUTPUT_DIR}/extract_2_allowed.png")
                except Exception:
                    pass

            # Create Custom App "Creative Liberation Collective"
            create_app_btn = page.locator('button:has-text("Create an app")')
            if create_app_btn.count() > 0:
                print("[EXTRACT] Clicking 'Create an app'...")
                create_app_btn.first.click()
                page.wait_for_timeout(3000)
                
                print("[EXTRACT] Filling App name...")
                page.fill('input[placeholder="App name"]', "Creative Liberation Collective")
                page.wait_for_timeout(1000)
                
                page.locator('button:has-text("Create app")').first.click()
                page.wait_for_timeout(8000)
                try:
                    page.screenshot(path=f"{OUTPUT_DIR}/extract_3_created.png")
                except Exception:
                    pass

            # Open "Creative Liberation Collective" details
            page.goto(TARGET_URL, wait_until="load")
            page.wait_for_timeout(6000)
            
            app_row = page.locator('text=Creative Liberation Collective')
            if app_row.count() > 0:
                print("[EXTRACT] Opening Creative Liberation Collective App details...")
                app_row.first.click()
                page.wait_for_timeout(6000)
                try:
                    page.screenshot(path=f"{OUTPUT_DIR}/extract_4_details.png")
                except Exception:
                    pass
            else:
                print("[EXTRACT ERROR] App row not found after creation/checking.")
                browser.close()
                sys.exit(1)

            # Configure API Scopes if Configure Admin API scopes button is present
            config_scopes_btn = page.locator('button:has-text("Configure Admin API scopes")')
            if config_scopes_btn.count() > 0:
                print("[EXTRACT] Opening Admin API scopes configuration...")
                config_scopes_btn.first.click()
                page.wait_for_timeout(6000)
                
                try:
                    page.screenshot(path=f"{OUTPUT_DIR}/extract_5_scopes.png")
                except Exception:
                    pass
                
                target_scopes = ["write_products", "read_products", "write_inventory", "read_inventory", "write_orders", "read_orders"]
                for scope in target_scopes:
                    checkbox = page.locator(f'input[id="{scope}"]')
                    if checkbox.count() > 0 and not checkbox.is_checked():
                        checkbox.check()
                        print(f"Checked scope: {scope}")
                
                page.wait_for_timeout(2000)
                save_btn = page.locator('button:has-text("Save")')
                if save_btn.count() > 0:
                    save_btn.click()
                    print("[EXTRACT] API scopes saved.")
                    page.wait_for_timeout(6000)
                    try:
                        page.screenshot(path=f"{OUTPUT_DIR}/extract_6_scopes_saved.png")
                    except Exception:
                        pass

            # Check if Configure Storefront API scopes is visible to verify we are on credentials/configuration tab
            # Install App
            install_btn = page.locator('button:has-text("Install app")')
            if install_btn.count() > 0:
                print("[EXTRACT] Clicking Install App...")
                install_btn.click()
                page.wait_for_timeout(2000)
                confirm_install = page.locator('button:has-text("Install")')
                if confirm_install.count() > 0:
                    confirm_install.click()
                    print("[EXTRACT] App installation confirmed.")
                    page.wait_for_timeout(8000)
                    try:
                        page.screenshot(path=f"{OUTPUT_DIR}/extract_7_installed.png")
                    except Exception:
                        pass

            # Reveal Access Token
            reveal_btn = page.locator('button:has-text("Reveal token once")')
            if reveal_btn.count() > 0:
                print("[EXTRACT] Revealing Access Token...")
                reveal_btn.click()
                page.wait_for_timeout(2000)
                try:
                    page.screenshot(path=f"{OUTPUT_DIR}/extract_8_token_revealed.png")
                except Exception:
                    pass

            # Extract Access Token
            token_input = page.locator('input[value^="shpat_"]')
            token = None
            if token_input.count() > 0:
                token = token_input.get_attribute("value")
            else:
                token_input_alt = page.locator('input[type="password"]')
                for idx in range(token_input_alt.count()):
                    val = token_input_alt.nth(idx).get_attribute("value")
                    if val and val.startswith("shpat_"):
                        token = val
                        break
            
            if token:
                print(f"\n[EXTRACT SUCCESS] Access Token successfully extracted: {token[:12]}...")
                with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                    f.write(token)
                print(f"[EXTRACT] Saved token to: {TOKEN_FILE}")
            else:
                print("[EXTRACT ERROR] Access Token input not found on the page.")
                
            print("=============================================================")
            print("CLE ENGINE SYSTEMS: PLAYWRIGHT CDP EXTRACTOR COMPLETE")
            print("=============================================================")
            
        except Exception as e:
            print(f"[EXTRACT ERROR] Unexpected error: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main()
