import asyncio
import socket
from urllib.parse import urlparse, urlunparse
from playwright.async_api import async_playwright

def resolve_cdp_url(url: str) -> str:
    parsed = urlparse(url)
    hostname = parsed.hostname
    port = parsed.port or 9224
    try:
        ip = socket.gethostbyname(hostname)
        resolved = urlunparse(parsed._replace(netloc=f"{ip}:{port}"))
        print(f"Resolved CDP URL: {url} -> {resolved}")
        return resolved
    except Exception as e:
        print(f"Could not resolve: {e}")
        return url

async def main():
    async with async_playwright() as pw:
        cdp_endpoint = resolve_cdp_url("http://cortex-browser:9224")
        browser = await pw.chromium.connect_over_cdp(cdp_endpoint)
        contexts = browser.contexts
        if not contexts:
            print("No contexts")
            return
        
        ctx = contexts[0]
        pages = ctx.pages
        print(f"Found {len(pages)} pages in context")
        for i, page in enumerate(pages):
            url = page.url
            print(f"Page {i} URL: {url}")
            if "youtube.com" not in url:  # skip youtube connection checks
                try:
                    await page.screenshot(path=f"/app/data/debug_page_{i}.png")
                    print(f"  Saved debug_page_{i}.png")
                except Exception as e:
                    print(f"  Failed to screenshot page {i}: {e}")

asyncio.run(main())
