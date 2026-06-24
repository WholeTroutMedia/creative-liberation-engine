import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function connectCortex() {
    let versionRes;
    try {
        versionRes = await fetch('http://127.0.0.1:9224/json/version');
    } catch {
        versionRes = await fetch('http://127.0.0.1:9222/json/version');
    }
    const versionInfo = await versionRes.json();
    const port = versionRes.url.includes('9224') ? '9224' : '9222';
    const wsUrl = versionInfo.webSocketDebuggerUrl || '';
    const wsEndpoint = wsUrl.replace(/127\.0\.0\.1:\d+|localhost:\d+|192\.168\.2\.15:\d+/, `127.0.0.1:${port}`);
    
    console.log(`[CHECK] 📡 Connecting to CORTEX browser via CDP: ${wsEndpoint}`);
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null,
    });
    return browser;
}

async function check() {
    const browser = await connectCortex();
    const page = await browser.newPage();
    
    // Inject __name polyfill
    await page.evaluateOnNewDocument(() => {
        if (typeof (globalThis as any).__name === 'undefined') {
            (globalThis as any).__name = (fn: any) => fn;
        }
    });

    console.log(`[CHECK] 📡 Navigating to X.com/home...`);
    await page.goto('https://x.com/home', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));

    const currentUrl = page.url();
    console.log(`[CHECK] Current URL: ${currentUrl}`);

    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasLimitMessage = bodyText.includes("temporarily limited") || bodyText.includes("try again later") || bodyText.includes("limited your login");
    console.log(`[CHECK] Body text contains limit/block message: ${hasLimitMessage}`);

    const isLoggedIn = await page.evaluate(() => {
        return !!(
            document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
            document.querySelector('[data-testid="tweetButtonInline"]') ||
            document.querySelector('a[href="/compose/post"]') ||
            document.querySelector('[aria-label="Post"]') ||
            (!document.querySelector('input[name="password"]') && document.querySelector('[data-testid="AppTabBar_Home_Link"]'))
        );
    });
    console.log(`[CHECK] Authenticated state detected: ${isLoggedIn}`);

    // Take screenshot and save to shared runtime volume
    const screenshotPath = '/app/creative-liberation-engine/runtime/x_current_state.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`[CHECK] Saved screenshot to ${screenshotPath}`);

    await page.close();
    await browser.disconnect();
}

check().catch(err => {
    console.error(`[CHECK] Error: ${err.message}`);
});
