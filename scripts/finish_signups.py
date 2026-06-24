import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp('http://localhost:9222')
        context = browser.contexts[0]
        
        for page in context.pages:
            url = page.url
            title = await page.title()
            print(f"Checking URL: {url} | Title: {title}")

asyncio.run(main())
