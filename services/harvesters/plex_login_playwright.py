import asyncio
import os
import re
from playwright.async_api import async_playwright

async def main():
    print('[*] Connecting to CDP proxy on 9224...')
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp('http://127.0.0.1:9224')
        context = browser.contexts[0]
        page = await context.new_page()
        
        print('[*] Navigating to Plex Sign in...')
        await page.goto('https://app.plex.tv/desktop#!/login', wait_until='networkidle')
        await page.wait_for_timeout(3000)
        
        # Check if already logged in by getting token
        token = await page.evaluate('''() => {
            const keys = Object.keys(localStorage);
            const tokenKey = keys.find(k => k.toLowerCase().includes('myplexaccesstoken'));
            return tokenKey ? localStorage.getItem(tokenKey) : null;
        }''')
        
        if token:
            print(f'[+] Already logged in! Token found: {token[:8]}...')
        else:
            print('[*] Filling login form...')
            # fill email
            await page.fill('input[type="email"]', 'inquiries@creativeliberationengine.org')
            await page.wait_for_timeout(1000)
            
            # click continue/submit
            buttons = await page.locator('button').all()
            for btn in buttons:
                text = await btn.text_content()
                if text and ('continue' in text.lower() or 'sign in' in text.lower()):
                    await btn.click()
                    break
            
            await page.wait_for_timeout(3000)
            
            # check if password exists or it's on a new screen
            if await page.locator('input[type="password"]').count() > 0:
                await page.fill('input[type="password"]', 'WholeTroutMedia!2026')
                await page.wait_for_timeout(1000)
                buttons = await page.locator('button').all()
                for btn in buttons:
                    text = await btn.text_content()
                    if text and ('sign in' in text.lower() or 'submit' in text.lower()):
                        await btn.click()
                        break
                        
            await page.wait_for_timeout(5000)
            
            token = await page.evaluate('''() => {
                return localStorage.getItem('myPlexAccessToken');
            }''')
            
            if token:
                print(f'[+] Login successful! Token: {token[:8]}...')
            else:
                print('[!] Failed to extract token after login.')
                await page.screenshot(path='/app/creative-liberation-engine/services/harvesters/plex_error.png')
                print('[!] Saved error screenshot')
                await browser.close()
                return
                
        # Write to .env
        ENV_PATH = '/app/creative-liberation-engine/.env'
        with open(ENV_PATH, 'r') as f:
            content = f.read()
        content = re.sub(r'PLEX_TOKEN=.*', f'PLEX_TOKEN={token}', content)
        with open(ENV_PATH, 'w') as f:
            f.write(content)
        print('[+] Saved to .env')
        
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
