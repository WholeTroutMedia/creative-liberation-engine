import puppeteer from 'puppeteer-core';
import 'dotenv/config';

async function main() {
    console.log('Connecting to cortex-browser...');
    const versionRes = await fetch('http://127.0.0.1:9224/json/version');
    const versionInfo = await versionRes.json();
    const wsUrl = versionInfo.webSocketDebuggerUrl;
    
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsUrl,
        defaultViewport: null
    });
    
    console.log('Opening new page...');
    const page = await browser.newPage();
    
    try {
        console.log('Navigating to x.com/login...');
        await page.goto('https://x.com/i/flow/login', { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 6000));
        await page.screenshot({ path: 'src/twitter_login_1_init.png' });
        console.log('Saved twitter_login_1_init.png');
        
        // Enter email/username
        const email = process.env.TWITTER_EMAIL || 'inquiries@creativeliberationengine.org';
        const usernameSelector = 'input[autocomplete="username"], input[name="text"], input[name="username_or_email"]';
        
        const usernameExists = await page.$(usernameSelector);
        if (usernameExists) {
            console.log('Entering email...');
            await page.type(usernameSelector, email, { delay: 100 });
            await page.screenshot({ path: 'src/twitter_login_2_email_typed.png' });
            
            // Press Next
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 4000));
            await page.screenshot({ path: 'src/twitter_login_3_after_next.png' });
            
            // Check for verification prompt (username/phone)
            const suspiciousSelector = 'input[data-testid="ocfEnterTextTextInput"]';
            const suspiciousExists = await page.$(suspiciousSelector);
            if (suspiciousExists) {
                console.log('Suspicious prompt detected, entering username...');
                const phoneOrUser = process.env.TWITTER_USERNAME || 'CLEEngine';
                await page.type(suspiciousSelector, phoneOrUser, { delay: 100 });
                await page.keyboard.press('Enter');
                await new Promise(r => setTimeout(r, 4000));
                await page.screenshot({ path: 'src/twitter_login_4_after_suspicious.png' });
            }
            
            // Enter password
            const passwordSelector = 'input[name="password"]';
            const passwordExists = await page.$(passwordSelector);
            if (passwordExists) {
                console.log('Entering password...');
                const password = process.env.TWITTER_PASSWORD || 'WholeTroutMedia!2026';
                await page.type(passwordSelector, password, { delay: 100 });
                await page.screenshot({ path: 'src/twitter_login_5_password_typed.png' });
                
                await page.keyboard.press('Enter');
                await new Promise(r => setTimeout(r, 6000));
                await page.screenshot({ path: 'src/twitter_login_6_final.png' });
                
                const finalUrl = page.url();
                console.log('Final URL:', finalUrl);
            } else {
                console.log('Password field not found!');
            }
        } else {
            console.log('Username field not found!');
        }
    } catch (err: any) {
        console.error('Error:', err.message);
    } finally {
        await page.close();
        await browser.disconnect();
    }
}

main().catch(console.error);
