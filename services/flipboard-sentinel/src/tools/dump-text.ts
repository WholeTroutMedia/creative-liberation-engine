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
    
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null,
    });
    return browser;
}

async function main() {
    const browser = await connectCortex();
    const pages = await browser.pages();
    if (pages.length > 0) {
        const page = pages[0];
        const bodyText = await page.evaluate(() => document.body.innerText);
        console.log("=== BODY INNER TEXT ===");
        console.log(bodyText);
        console.log("=======================");
        
        const html = await page.evaluate(() => document.body.innerHTML);
        console.log("=== HTML CONTAINING 'limit' ===");
        const matches = html.match(/<[^>]*>[^<]*limit[^<]*<[^>]*>/gi) || [];
        console.log(matches.slice(0, 10));
    }
    await browser.disconnect();
}

main().catch(console.error);
