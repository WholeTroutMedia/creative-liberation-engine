import puppeteer from 'puppeteer-core';

async function main() {
    let versionRes;
    try {
        versionRes = await fetch('http://122.0.3.1:9224/json/version');
    } catch {
        versionRes = await fetch('http://122.0.3.1:9222/json/version');
    }
    const versionInfo = await versionRes.json();
    const port = versionRes.url.includes('9224') ? '9224' : '9222';
    const wsUrl = versionInfo.webSocketDebuggerUrl || '';
    const wsEndpoint = wsUrl.replace(/127\.0\.0\.1:\d+|localhost:\d+|192\.168\.2\.15:\d+/, `122.0.3.1:${port}`);
    
    console.log(`[VERIFY] Connecting to CDP: ${wsEndpoint}`);
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null,
    });
    
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    
    console.log(`[VERIFY] Navigating to https://x.com/home ...`);
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 6000));
    
    console.log(`[VERIFY] Current page URL: ${page.url()}`);
    
    const isLoggedIn = await page.evaluate(() => {
        return !!(
            document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
            document.querySelector('[data-testid="tweetButtonInline"]') ||
            document.querySelector('a[href="/compose/post"]') ||
            document.querySelector('[aria-label="Post"]') ||
            document.querySelector('[data-testid="AppTabBar_Home_Link"]')
        );
    });
    
    console.log(`[VERIFY] Is logged in successfully: ${isLoggedIn}`);
    await page.screenshot({ path: '/app/runtime/x_login_success.png' });
    console.log(`[VERIFY] Screenshot saved to runtime/x_login_success.png`);
    
    await browser.disconnect();
}

main().catch(err => {
    console.error("[VERIFY] Fatal error:", err);
});
