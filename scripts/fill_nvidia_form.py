import asyncio
from playwright.async_api import async_playwright

url = "https://accounts.nvgs.nvidia.com/api/1/message/CreateAccount?q=eyJhbGciOiJIUzI1NiJ9.eyJtZXNzYWdlSWQiOiIxNDk3NTU4Mzk3NzA0OTIxMDg4Iiwic2UiOiItIiwicmVkaXJlY3RVcmwiOiJodHRwczovL3d3dy5udmlkaWEuY29tLyIsImlkIjoiIiwianRpIjoiMjhmNzA2OGQtNzlhMi00NGM5LWE2YjctMDQwMDg2NmM4Njc3In0.RXT61nAWisvryWBZL-P1mCc6lH3S06fZKlQCwB4WFAU"
password = "WholeTroutMedia!2026"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:9222")
        context = browser.contexts[0]
        
        nvidia_page = None
        for page in context.pages:
            if "nvidia" in page.url.lower():
                nvidia_page = page
                break
                
        if not nvidia_page:
            nvidia_page = await context.new_page()
            
        print(f"Navigating to: {url}")
        await nvidia_page.goto(url)
        await nvidia_page.wait_for_load_state('networkidle')
        print("Page loaded.")
        
        # We need to fill out the form. Let's look for frames or shadow root
        # Let's print out the structure or try to fill the password fields
        try:
            print("Trying to find password field")
            await nvidia_page.wait_for_selector("input[type='password']", timeout=10000)
            
            # NVIDIA usually has two password fields: new password and confirm password
            pw_fields = await nvidia_page.locator("input[type='password']").all()
            if pw_fields:
                print(f"Found {len(pw_fields)} password fields")
                for field in pw_fields:
                    await field.fill(password)
            else:
                print("No password fields found by locator")
            
            # They also might have checkboxes like "agree to terms"
            checkboxes = await nvidia_page.locator("input[type='checkbox']").all()
            for i, cb in enumerate(checkboxes):
                try:
                    await cb.check(force=True)
                    print(f"Checked checkbox {i}")
                except Exception as e:
                    print(f"Could not check checkbox {i}: {e}")
                    
            # Click submit/create button
            buttons = await nvidia_page.locator("button, input[type='submit']").all()
            for b in buttons:
                text = await b.inner_text()
                if text and ("submit" in text.lower() or "create" in text.lower() or "continue" in text.lower()):
                    print(f"Clicking button: {text}")
                    await b.click()
                    break
            
            await nvidia_page.wait_for_load_state('networkidle')
            await asyncio.sleep(5) # wait for redirect
            print("Final URL:", nvidia_page.url)
            
        except Exception as e:
            print("Error filling form:", e)
            # Maybe inside an iframe?
            for i, frame in enumerate(nvidia_page.frames):
                print(f"Frame {i} URL: {frame.url}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
