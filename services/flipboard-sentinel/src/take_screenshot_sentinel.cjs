const puppeteer = require('puppeteer-core');

async function main() {
    let browser;
    try {
        console.log('Connecting to cortex-browser...');
        // Query the CDP proxy
        const versionRes = await fetch('http://192.168.2.15:9224/json/version');
        const versionInfo = await versionRes.json();
        const wsUrl = versionInfo.webSocketDebuggerUrl;
        console.log('Connecting to:', wsUrl);
        
        browser = await puppeteer.connect({
            browserWSEndpoint: wsUrl,
            defaultViewport: null
        });
        
        const pages = await browser.pages();
        console.log(`Found ${pages.length} pages`);
        
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const url = page.url();
            console.log(`Page ${i}: ${url}`);
            try {
                await page.screenshot({ path: `src/debug_sentinel_page_${i}.png` });
                console.log(`Saved src/debug_sentinel_page_${i}.png`);
            } catch (err) {
                console.error(`Failed to screenshot page ${i}:`, err.message);
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        if (browser) {
            await browser.disconnect();
        }
    }
}

main();
