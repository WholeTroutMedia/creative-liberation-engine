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
            html = await nvidia_page.content()
            with open("nvidia_dom.html", "w", encoding="utf-8") as f:
                f.write(html)
            print("DOM dumped to nvidia_dom.html")
                
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
