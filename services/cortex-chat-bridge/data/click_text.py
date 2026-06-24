import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.connect_over_cdp("http://192.168.224.3:9224")
        ctx = browser.contexts[0] if browser.contexts else None
        if not ctx:
            print("No contexts")
            return
        page = ctx.pages[1]
        
        # Click "Text"
        btn = page.locator("button:has-text('Text')").first
        if await btn.count() == 0:
            btn = page.get_by_text("Text", exact=True).first
            
        if await btn.count() > 0:
            await btn.click()
            print("Clicked Text button")
            await asyncio.sleep(5)
            await page.screenshot(path="/app/data/verification_code_input.png")
            print("Saved verification_code_input.png")
        else:
            print("Text button not found")

asyncio.run(main())
