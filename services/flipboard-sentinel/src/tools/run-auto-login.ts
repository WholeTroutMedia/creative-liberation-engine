import puppeteer from 'puppeteer-core';
import fs from 'fs';

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
    
    console.log(`[LOGIN] 📡 Connecting to CORTEX browser via CDP: ${wsEndpoint}`);
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null,
    });
    return browser;
}

async function login() {
    const browser = await connectCortex();
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Inject __name polyfill
    await page.evaluateOnNewDocument(() => {
        if (typeof (globalThis as any).__name === 'undefined') {
            (globalThis as any).__name = (fn: any) => fn;
        }
    });

    console.log(`[LOGIN] 📡 Navigating to X.com login flow...`);
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 6000));
    await page.screenshot({ path: '/app/runtime/x_login_step0_flow_loaded.png' });

    const email = 'inquiries@inceptionengine.systems';
    const password = 'WholeTroutMedia!2026';
    const username = 'InceptionEngine';

    // Check for email/username input
    const usernameSelector = 'input[autocomplete="username"], input[name="text"], input[name="username_or_email"]';
    console.log(`[LOGIN] Waiting for username input...`);
    await page.waitForSelector(usernameSelector, { timeout: 15000 });
    
    console.log(`[LOGIN] Typing email: ${email}`);
    await page.type(usernameSelector, email, { delay: 100 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: '/app/runtime/x_login_step1_typed_email.png' });

    // Click "Next" or press Enter
    console.log(`[LOGIN] Clicking Next...`);
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
        console.log(`[LOGIN] Button not found by text, sending Enter key`);
        await page.keyboard.press('Enter');
    }
    
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: '/app/runtime/x_login_step2_after_next.png' });

    // Check for rate limits or blocks
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes("temporarily limited") || bodyText.includes("try again later")) {
        console.error(`[LOGIN] 🚨 ERROR: Flagged/limited after submitting email.`);
        await browser.disconnect();
        return;
    }

    // Check if unusual activity verification is requested
    const suspiciousSelector = 'input[data-testid="ocfEnterTextTextInput"]';
    const suspiciousExists = await page.$(suspiciousSelector);
    if (suspiciousExists) {
        console.log(`[LOGIN] Verification page detected. Typing handle: ${username}`);
        await page.type(suspiciousSelector, username, { delay: 100 });
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 4000));
        await page.screenshot({ path: '/app/runtime/x_login_step2.5_verification.png' });
    }

    // Wait for password field
    const passwordSelector = 'input[name="password"]';
    console.log(`[LOGIN] Waiting for password input...`);
    await page.waitForSelector(passwordSelector, { timeout: 15000 });
    
    console.log(`[LOGIN] Typing password...`);
    await page.type(passwordSelector, password, { delay: 100 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: '/app/runtime/x_login_step3_typed_password.png' });

    // Click Login / Log in
    console.log(`[LOGIN] Clicking Log in...`);
    const clickedLogin = await page.evaluate((btnTexts: string[]) => {
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
    }, ['Log in', 'Log In', 'Sign in', 'Continue']);

    if (!clickedLogin) {
        console.log(`[LOGIN] Login button not found by text, sending Enter key`);
        await page.keyboard.press('Enter');
    }

    await new Promise(r => setTimeout(r, 8000));
    await page.screenshot({ path: '/app/runtime/x_login_step4_final.png' });

    // Verify authenticated state
    const loggedIn = await page.evaluate(() => {
        return !!(
            document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
            document.querySelector('[data-testid="tweetButtonInline"]') ||
            document.querySelector('a[href="/compose/post"]') ||
            document.querySelector('[aria-label="Post"]') ||
            (!document.querySelector('input[name="password"]') && document.querySelector('[data-testid="AppTabBar_Home_Link"]'))
        );
    });

    console.log(`[LOGIN] Login completed. Status verified: ${loggedIn}`);
    await browser.disconnect();
}

login().catch(err => {
    console.error(`[LOGIN] Fatal error: ${err.message}`);
});
