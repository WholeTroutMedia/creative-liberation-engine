import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:9222")
        context = browser.contexts[0]
        
        nvidia_page = None
        for page in context.pages:
            if "nvidia" in page.url.lower():
                nvidia_page = page
                break
                
        if nvidia_page:
            print("Filling out NVIDIA form...")
            
            # Fill username if present
            try:
                if await nvidia_page.locator("#registration_username").is_visible(timeout=2000):
                    print("Filling username...")
                    await nvidia_page.fill("#registration_username", "CortexScholar")
            except: pass
            
            # Fill birthday
            try:
                if await nvidia_page.locator("#birthday_full_input").is_visible(timeout=2000):
                    print("Filling birthday...")
                    await nvidia_page.fill("#birthday_full_input", "10/10/1990")
                    await nvidia_page.press("#birthday_full_input", "Enter")
            except: pass
            
            # Fill password
            try:
                if await nvidia_page.locator("#registration_password").is_visible(timeout=2000):
                    print("Filling password...")
                    await nvidia_page.fill("#registration_password", "WholeTroutMedia!2026")
            except: pass

            try:
                if await nvidia_page.locator("#registration_passwordConfirm").is_visible(timeout=2000):
                    print("Filling password confirm...")
                    await nvidia_page.fill("#registration_passwordConfirm", "WholeTroutMedia!2026")
            except: pass
            
            # Check terms
            try:
                print("Checking terms...")
                await nvidia_page.evaluate("document.querySelector('#terms_and_conditions-input').click()")
            except: pass
            
            # Uncheck remember me if needed
            try:
                await nvidia_page.uncheck("#stay_signin_checkbox-input")
            except: pass
            try:
                await nvidia_page.uncheck("#auto_login_checkbox-input")
            except: pass
            try:
                await nvidia_page.uncheck("#stay_signin_checkbox_v2-input")
            except: pass

            # Click Create Account
            print("Clicking Create Account...")
            await nvidia_page.locator("button:has-text('Create Account')").first.click()
            
            print("Waiting for page load...")
            await nvidia_page.wait_for_timeout(6000)
            
            # Check for new inputs to see if successful
            print("Done. URL is now:", nvidia_page.url)
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
