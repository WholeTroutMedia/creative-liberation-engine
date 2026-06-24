import os

filepath = "/app/creative-liberation-engine/services/cortex-chat-bridge/data/playwright_headless_provision.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Target email segment
target_email = """            # Evaluate script to fill email, force-enable continue button, and click it natively
            print("[PROVISION] Bypassing React and submitting email via native DOM...")
            page.evaluate(f\"\"\"() => {
                const input = document.querySelector('#account_email') || Array.from(document.querySelectorAll('input[type="email"]')).find(i => i.offsetWidth > 0 && i.offsetHeight > 0);
                if (input) {
                    input.focus();
                    input.value = '{EMAIL}';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                // Force enable and click the visible submit button
                const btns = Array.from(document.querySelectorAll('button[name="commit"], button[type="submit"], .login-button'));
                const btn = btns.find(b => b.offsetWidth > 0 && b.offsetHeight > 0) || btns[0];
                if (btn) {
                    btn.removeAttribute('disabled');
                    btn.disabled = false;
                    btn.click();
                }
            }\"\"\")"""

replacement_email = """            # Type email slowly via Playwright locator to trigger framework listeners naturally
            print("[PROVISION] Locating email input field...")
            email_field = page.locator('#account_email, input[type="email"]').first
            email_field.clear()
            email_field.type(EMAIL, delay=50)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_2_email.png")
            
            # Click the visible Continue button
            print("[PROVISION] Clicking Continue with email button...")
            continue_btn = page.locator('button[type="submit"], button[name="commit"], .login-button').first
            continue_btn.click()"""

# Target password segment
target_password = """            # Evaluate script to fill password, force-enable login button, and click it natively
            print("[PROVISION] Bypassing React and submitting password via native DOM...")
            page.evaluate(f\"\"\"() => {
                const input = document.querySelector('#account_password') || Array.from(document.querySelectorAll('input[type="password"]')).find(i => i.offsetWidth > 0 && i.offsetHeight > 0);
                if (input) {
                    input.focus();
                    input.value = '{PASSWORD}';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                // Force enable and click the visible submit button
                const btns = Array.from(document.querySelectorAll('button[name="commit"], button[type="submit"], .login-button'));
                const btn = btns.find(b => b.offsetWidth > 0 && b.offsetHeight > 0) || btns[0];
                if (btn) {
                    btn.removeAttribute('disabled');
                    btn.disabled = false;
                    btn.click();
                }
            }\"\"\")"""

replacement_password = """            # Type password slowly
            print("[PROVISION] Typing password slowly...")
            pwd_field = page.locator('input[type="password"], #account_password').first
            pwd_field.wait_for(state="visible", timeout=25000)
            pwd_field.clear()
            pwd_field.type(PASSWORD, delay=50)
            page.screenshot(path=f"{OUTPUT_DIR}/shopify_3_password.png")
            
            # Click the visible login button
            print("[PROVISION] Clicking submit password button...")
            login_btn = page.locator('button[type="submit"], button[name="commit"], .login-button').first
            login_btn.click()"""

if target_email in content:
    content = content.replace(target_email, replacement_email)
    print("EMAIL REPLACEMENT SUCCESSFUL")
else:
    print("EMAIL TARGET NOT FOUND")

if target_password in content:
    content = content.replace(target_password, replacement_password)
    print("PASSWORD REPLACEMENT SUCCESSFUL")
else:
    print("PASSWORD TARGET NOT FOUND")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
