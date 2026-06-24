import os
import sys
from playwright.sync_api import sync_playwright

def main():
    EMAIL = "inquiries@creativeliberationengine.org"
    SHOP_HANDLE = "latent-space-studios"
    OUTPUT_DIR = "/app/data"
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale="en-US"
        )
        page = context.new_page()
        target_url = f"https://admin.shopify.com/store/{SHOP_HANDLE}/settings/apps/development"
        page.goto(target_url, wait_until="commit")
        page.wait_for_timeout(8000)
        
        # Dump email input and submit button outerHTML
        email_html = page.evaluate("""() => {
            const inputs = Array.from(document.querySelectorAll('input'));
            return inputs.map(i => ({
                id: i.id,
                name: i.name,
                type: i.type,
                outerHTML: i.outerHTML,
                visible: i.offsetWidth > 0 && i.offsetHeight > 0
            }));
        }""")
        
        button_html = page.evaluate("""() => {
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            return buttons.map(b => ({
                text: b.innerText,
                type: b.type,
                outerHTML: b.outerHTML,
                disabled: b.disabled
            }));
        }""")
        
        with open(f"{OUTPUT_DIR}/login_dom.txt", "w", encoding="utf-8") as f:
            f.write("=== INPUTS ===\n")
            for i in email_html:
                f.write(f"ID: {i['id']} | Name: {i['name']} | Type: {i['type']} | Visible: {i['visible']}\nHTML: {i['outerHTML']}\n\n")
            
            f.write("\n=== BUTTONS ===\n")
            for b in button_html:
                f.write(f"Text: {b['text']} | Type: {b['type']} | Disabled: {b['disabled']}\nHTML: {b['outerHTML']}\n\n")
                
        print("DOM DUMPED SUCCESSFULLY")
        browser.close()

if __name__ == "__main__":
    main()
