const { chromium } = require('playwright');
const fs = require('fs');

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto('https://annuaireci.com/categorie/communication-publicite/abidjan/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000); // wait for dynamic content
    
    const html = await page.content();
    fs.writeFileSync('annuaireci_dump.html', html);
    console.log('HTML saved to annuaireci_dump.html');
    await browser.close();
}

run().catch(console.error);
