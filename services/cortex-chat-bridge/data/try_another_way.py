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
        
        # Click "Try another way"
        btn = page.locator("button:has-text('Try another way')").first
        if await btn.count() == 0:
            btn = page.get_by_text("Try another way", exact=True).first
            
        if await btn.count() > 0:
            await btn.click()
            print("Clicked Try another way button")
            await asyncio.sleep(5)
            await page.screenshot(path="/app/data/try_another_way_options.png")
            print("Saved try_another_way_options.png")
        else:
            print("Try another way button not found")

asyncio.run(main())
