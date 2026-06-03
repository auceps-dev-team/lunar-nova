const { chromium } = require('playwright');
const fs = require('fs');

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto('https://annuaireci.com/entreprises/motion-studio-abidjan-cote-divoire/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    
    const results = await page.evaluate(() => {
        const name = document.querySelector('h1')?.innerText;
        const phoneLinks = Array.from(document.querySelectorAll('a[href^="tel:"]')).map(a => a.href);
        const phones = Array.from(document.querySelectorAll('.phone, [class*="phone"]')).map(e => e.innerText);
        return { name, phoneLinks, phones };
    });
    
    console.log(results);
    await browser.close();
}

run().catch(console.error);
