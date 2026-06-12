import 'dotenv/config';
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
    
    console.log(`[SOLVER] 📡 Connecting to CORTEX browser via CDP: ${wsEndpoint}`);
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null,
    });
    return browser;
}

async function solve() {
    console.log(`[SOLVER] 🚀 Initializing Twitter/X Autonomous Login Solver...`);
    const browser = await connectCortex();
    const pages = await browser.pages();
    
    // Use first page or create new
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    
    // Set a realistic user agent
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
    });
    
    // Inject __name polyfill for TSX compiled outputs and anti-bot stealth properties
    await page.evaluateOnNewDocument(() => {
        if (typeof (globalThis as any).__name === 'undefined') {
            (globalThis as any).__name = (fn: any) => fn;
        }
        
        // Hide webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });

        // Mock languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });

        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });

        // Mock chrome object
        (window as any).chrome = {
            runtime: {}
        };
    });

    console.log(`[SOLVER] 📡 Navigating to X.com to check state...`);
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    // 1. Verify if already logged in
    const isLoggedIn = await page.evaluate(() => {
        return !!(
            document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
            document.querySelector('[data-testid="tweetButtonInline"]') ||
            document.querySelector('a[href="/compose/post"]') ||
            document.querySelector('[aria-label="Post"]') ||
            !document.querySelector('input[name="password"]') && document.querySelector('[data-testid="AppTabBar_Home_Link"]')
        );
    });

    if (isLoggedIn && !page.url().includes('login')) {
        console.log(`[SOLVER] 🎉 SUCCESS: Already authenticated on X.com!`);
        await browser.disconnect();
        process.exit(0);
    }

    console.log(`[SOLVER] 🔑 State: NOT logged in. Redirecting to login flow...`);
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 6000));

    // Check for IP blocks/limits on flow entry
    const isLimitedOnStart = await page.evaluate(() => {
        const text = document.body.innerText || '';
        return text.includes("temporarily limited") || text.includes("try again later") || text.includes("limited your login");
    });

    if (isLimitedOnStart) {
        console.log(`[SOLVER] 🚨 ERROR: Flagged/Limited immediately on flow start!`);
        await page.screenshot({ path: '/app/runtime/x_login_end.png' });
        await browser.disconnect();
        process.exit(3); // Code 3 triggers Tor rotation loop
    }

    // 2. Perform automated inputs using standardized inquiries handle
    const email = 'inquiries@inceptionengine.systems';
    const password = 'WholeTroutMedia!2026';
    const username = 'InceptionEngine';

    console.log(`[SOLVER] 🔑 Entering email/username: ${email}`);
    const usernameSelector = 'input[autocomplete="username"], input[name="text"], input[name="username_or_email"]';
    try {
        await page.waitForSelector(usernameSelector, { timeout: 15000 });
    } catch {
        console.log(`[SOLVER] 🚨 Username input not found. Saving screenshot and rotating.`);
        await page.screenshot({ path: '/app/runtime/x_login_end.png' });
        await browser.disconnect();
        process.exit(3);
    }

    await page.type(usernameSelector, email, { delay: 100 });
    await new Promise(r => setTimeout(r, 1000));

    // Click Next
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

    // Check for IP blocks or limit messages after email
    const isLimitedPostEmail = await page.evaluate(() => {
        const text = document.body.innerText || '';
        return text.includes("temporarily limited") || text.includes("try again later") || text.includes("limited your login");
    });

    if (isLimitedPostEmail) {
        console.log(`[SOLVER] 🚨 ERROR: Flagged/Limited after email entry!`);
        await page.screenshot({ path: '/app/runtime/x_login_end.png' });
        await browser.disconnect();
        process.exit(3);
    }

    // Check for suspicious activity verification prompt
    const suspiciousSelector = 'input[data-testid="ocfEnterTextTextInput"]';
    const suspiciousExists = await page.$(suspiciousSelector);
    if (suspiciousExists) {
        console.log(`[SOLVER] ⚠️ Suspect activity screen triggered. Injecting handle: ${username}`);
        await page.type(suspiciousSelector, username, { delay: 100 });
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 4000));
    }

    // Enter password
    console.log(`[SOLVER] 🔑 Entering password...`);
    const passwordSelector = 'input[name="password"]';
    try {
        await page.waitForSelector(passwordSelector, { timeout: 10000 });
    } catch {
        console.log(`[SOLVER] 🚨 Password input not found. Checking if limited.`);
        const isLimited = await page.evaluate(() => {
            return document.body.innerText.includes("temporarily limited") || document.body.innerText.includes("try again later");
        });
        await page.screenshot({ path: '/app/runtime/x_login_end.png' });
        await browser.disconnect();
        process.exit(isLimited ? 3 : 1);
    }

    await page.type(passwordSelector, password, { delay: 100 });
    await new Promise(r => setTimeout(r, 1000));

    // Click Login
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
        await page.keyboard.press('Enter');
    }
    await new Promise(r => setTimeout(r, 6000));

    // Final limit check
    const isLimitedFinal = await page.evaluate(() => {
        const text = document.body.innerText || '';
        return text.includes("temporarily limited") || text.includes("try again later") || text.includes("limited your login");
    });

    if (isLimitedFinal) {
        console.log(`[SOLVER] 🚨 ERROR: Flagged/Limited on final login click!`);
        await page.screenshot({ path: '/app/runtime/x_login_end.png' });
        await browser.disconnect();
        process.exit(3);
    }

    // Verify if we are logged in
    const loggedIn = await page.evaluate(() => {
        return !!(
            document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
            document.querySelector('[data-testid="tweetButtonInline"]') ||
            document.querySelector('a[href="/compose/post"]') ||
            document.querySelector('[aria-label="Post"]') ||
            !document.querySelector('input[name="password"]')
        );
    });

    if (loggedIn) {
        console.log(`[SOLVER] 🎉 SUCCESS: Authenticated successfully! Session committed.`);
        await page.screenshot({ path: '/app/runtime/x_login_success.png' });
        await browser.disconnect();
        process.exit(0);
    } else {
        console.log(`[SOLVER] ❌ FAILED: State not detected as logged in.`);
        await page.screenshot({ path: '/app/runtime/x_login_end.png' });
        await browser.disconnect();
        process.exit(1);
    }
}

solve().catch(err => {
    console.error(`[SOLVER] 🚨 Fatal error: ${err.message}`);
    process.exit(1);
});
