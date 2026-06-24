import asyncio
import re
from playwright.async_api import async_playwright

url = "https://accounts.nvgs.nvidia.com/api/1/message/CreateAccount?q=eyJhbGciOiJIUzI1NiJ9.eyJtZXNzYWdlSWQiOiIxNDk3NTU4Mzk3NzA0OTIxMDg4Iiwic2UiOiItIiwicmVkaXJlY3RVcmwiOiJodHRwczovL3d3dy5udmlkaWEuY29tLyIsImlkIjoiIiwianRpIjoiMjhmNzA2OGQtNzlhMi00NGM5LWE2YjctMDQwMDg2NmM4Njc3In0.RXT61nAWisvryWBZL-P1mCc6lH3S06fZKlQCwB4WFAU"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:9222")
        context = browser.contexts[0]
        
        # Check if there's an existing NVIDIA tab
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
        
        # take a screenshot
        await nvidia_page.screenshot(path="nvidia_create_acct.png")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
