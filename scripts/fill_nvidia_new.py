import asyncio
from playwright.async_api import async_playwright

url = "https://accounts.nvgs.nvidia.com/api/1/message/CreateAccount?q=eyJhbGciOiJIUzI1NiJ9.eyJtZXNzYWdlSWQiOiIxNDk3NTU4Mzk3NzA0OTIxMDg4Iiwic2UiOiItIiwicmVkaXJlY3RVcmwiOiJodHRwczovL3d3dy5udmlkaWEuY29tLyIsImlkIjoiIiwianRpIjoiMjhmNzA2OGQtNzlhMi00NGM5LWE2YjctMDQwMDg2NmM4Njc3In0.RXT61nAWisvryWBZL-P1mCc6lH3S06fZKlQCwB4WFAU"
password = "WholeTroutMedia!2026"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:9222")
        context = browser.contexts[0]
        
        # Clear cookies for nvidia
        cookies = await context.cookies()
        filtered_cookies = [c for c in cookies if 'nvidia' not in c['domain']]
        await context.clear_cookies()
        await context.add_cookies(filtered_cookies)
        
        nvidia_page = await context.new_page()
        
        print(f"Navigating to: {url}")
        await nvidia_page.goto(url)
        await nvidia_page.wait_for_load_state('networkidle')
        print("Page loaded URL:", nvidia_page.url)
        
        # take screenshot
        await nvidia_page.screenshot(path="nvidia_create_acct_new2.png")
        
        try:
            print("Trying to find password field")
            await nvidia_page.wait_for_selector("input[type='password']", timeout=10000)
            
            pw_fields = await nvidia_page.locator("input[type='password']").all()
            if pw_fields:
                print(f"Found {len(pw_fields)} password fields")
                for field in pw_fields:
                    await field.fill(password)
            
            checkboxes = await nvidia_page.locator("input[type='checkbox']").all()
            for i, cb in enumerate(checkboxes):
                try:
                    await cb.check(force=True)
                except Exception as e:
                    pass
                    
            # Click submit button
            buttons = await nvidia_page.locator("button, input[type='submit']").all()
            for b in buttons:
                text = await b.inner_text()
                if text and ("submit" in text.lower() or "create" in text.lower() or "continue" in text.lower()):
                    await b.click()
                    print(f"Clicked {text}")
                    break
            
            await asyncio.sleep(5)
            print("Final URL:", nvidia_page.url)
            
        except Exception as e:
            print("Error filling form:", e)
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
