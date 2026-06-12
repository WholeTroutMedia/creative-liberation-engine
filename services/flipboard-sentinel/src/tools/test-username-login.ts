import puppeteer from 'puppeteer-core';

async function connectCortex() {
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
    
    console.log(`[LOGIN_TEST] Connecting to CORTEX browser via CDP: ${wsEndpoint}`);
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null,
    });
    return browser;
}

async function test() {
    const browser = await connectCortex();
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    
    // Clear cookies and cache via CDP
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Inject polyfill
    await page.evaluateOnNewDocument(() => {
        if (typeof (globalThis as any).__name === 'undefined') {
            (globalThis as any).__name = (fn: any) => fn;
        }
    });

    console.log(`[LOGIN_TEST] Navigating to X.com login...`);
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 6000));

    const usernameSelector = 'input[autocomplete="username"], input[name="text"], input[name="username_or_email"]';
    await page.waitForSelector(usernameSelector, { timeout: 15000 });

    // Clear input
    await page.click(usernameSelector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    
    console.log(`[LOGIN_TEST] Typing username: InceptionEngine`);
    await page.type(usernameSelector, 'InceptionEngine', { delay: 100 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: '/app/runtime/x_login_test_username_entered.png' });

    console.log(`[LOGIN_TEST] Clicking Continue...`);
    const clickedNext = await page.evaluate((btnTexts: string[]) => {
        const all = Array.from(document.querySelectorAll('*'));
        for (const el of all) {
            let hasDirectText = false;
            for (let i = 0; i < el.childNodes.length; i++) {
                const node = el.childNodes[i];
                if (node.nodeType === 3 && node.nodeValue && btnTexts.includes(node.nodeValue.trim())) {
                    hasDirectText = true;
                    break;
                }
            }
            if (hasDirectText && (el as HTMLElement).offsetWidth > 0 && (el as HTMLElement).offsetHeight > 0) {
                (el as HTMLElement).click();
                return true;
            }
        }
        return false;
    }, ['Next', 'Continue']);

    if (!clickedNext) {
        await page.keyboard.press('Enter');
    }
    
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: '/app/runtime/x_login_test_after_username.png' });

    const bodyText = await page.evaluate(() => document.body.innerText);
    const isLimited = bodyText.includes("temporarily limited") || bodyText.includes("try again later");
    console.log(`[LOGIN_TEST] Result is limited: ${isLimited}`);

    await page.close();
    await browser.disconnect();
}

test().catch(err => {
    console.error(`[LOGIN_TEST] Error: ${err.message}`);
});
