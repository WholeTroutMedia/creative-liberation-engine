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
    
    console.log(`[CHECK] Connecting to CDP: ${wsEndpoint}`);
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null,
    });
    
    const pages = await browser.pages();
    console.log(`[CHECK] Active tabs open: ${pages.length}`);
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        console.log(`[CHECK] Tab #${i} URL: ${page.url()}`);
        
        // Take screenshot of the tab
        await page.screenshot({ path: `/app/runtime/session_tab_${i}.png` });
        console.log(`[CHECK] Screenshot saved as session_tab_${i}.png`);
        
        // Check if logged in
        const isLoggedIn = await page.evaluate(() => {
            return !!(
                document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
                document.querySelector('[data-testid="tweetButtonInline"]') ||
                document.querySelector('a[href="/compose/post"]') ||
                document.querySelector('[aria-label="Post"]') ||
                document.querySelector('[data-testid="AppTabBar_Home_Link"]')
            );
        });
        console.log(`[CHECK] Is logged in: ${isLoggedIn}`);
        
        // Check stealth signatures
        const stealthInfo = await page.evaluate(() => {
            return {
                webdriver: navigator.webdriver,
                languages: navigator.languages,
                pluginsLength: navigator.plugins.length,
                hasChrome: !!(window as any).chrome,
                userAgent: navigator.userAgent
            };
        });
        console.log(`[CHECK] Stealth parameters:`, JSON.stringify(stealthInfo));
        
        // Get all cookies
        const cookies = await page.cookies();
        console.log(`[CHECK] Total cookies: ${cookies.length}`);
    }
    
    await browser.disconnect();
}

main().catch(err => {
    console.error("[CHECK] Fatal error:", err);
});
