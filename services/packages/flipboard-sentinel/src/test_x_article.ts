import puppeteer from 'puppeteer-core';

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
    
    console.log(`📡 Connecting to CORTEX browser via CDP at: ${wsEndpoint}`);
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null,
    });
    return browser;
}

async function run() {
    const url = 'https://x.com/i/article/2054400263474008064';
    console.log(`Navigating to ${url}...`);
    const browser = await connectCortex();
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    
    await new Promise(r => setTimeout(r, 5000));
    
    const pageData = await page.evaluate(() => {
        const title = document.title;
        // Let's print out some elements to see the structure
        const bodyText = document.body.innerText;
        const articleHtml = document.querySelector('article')?.innerText || '';
        
        return {
            title,
            bodyText: bodyText.slice(0, 1500),
            articleHtml: articleHtml.slice(0, 1500)
        };
    });
    
    console.log('--- PAGE TITLE ---');
    console.log(pageData.title);
    console.log('--- ARTICLE CONTENT ---');
    console.log(pageData.articleHtml || 'No article tag found');
    console.log('--- BODY TEXT ---');
    console.log(pageData.bodyText);
    
    await page.close();
    await browser.disconnect();
}

run().catch(console.error);
