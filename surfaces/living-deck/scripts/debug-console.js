import { chromium } from 'playwright';

async function run() {
  console.log('Launching browser debug run...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type().toUpperCase()}]: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER EXCEPTION]: ${err.message}`);
  });

  try {
    console.log('Navigating to http://localhost:5173/...');
    await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 5000 });
    console.log('Page loaded successfully.');
    
    // Check if stylesheet is applied
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    console.log(`Body Background Color: ${bodyBg}`);
  } catch (error) {
    console.error('Navigation or loading error:', error.message);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

run();
