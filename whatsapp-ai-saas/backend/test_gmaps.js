const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        locale: 'fr-FR'
    });
    const page = await context.newPage();
    
    try {
        console.log("Navigating to Google Maps...");
        await page.goto('https://www.google.com/maps/search/immobilier+abidjan', { waitUntil: 'networkidle' });
        
        // Wait for results
        await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 10000 });
        console.log("Results loaded. Extracting URLs...");
        
        // Scroll the results container a few times to get more items
        const resultsContainer = 'div[role="feed"]';
        for (let i = 0; i < 3; i++) {
            await page.evaluate((selector) => {
                const container = document.querySelector(selector);
                if (container) container.scrollTop = container.scrollHeight;
            }, resultsContainer);
            await page.waitForTimeout(2000); // wait for load
        }
        
        const links = await page.$$eval('a[href*="/maps/place/"]', els => els.map(a => a.href));
        console.log(`Found ${links.length} links.`);
        
        if (links.length > 0) {
            console.log(`Visiting first link: ${links[0]}`);
            await page.goto(links[0], { waitUntil: 'networkidle' });
            
            // Try to extract name, phone, address, website
            const name = await page.$eval('h1', el => el.innerText).catch(() => '');
            
            // Phone is usually a button starting with tel:
            const phone = await page.$eval('button[data-item-id^="phone:tel:"]', el => el.innerText).catch(() => '');
            
            // Website is usually an a tag with data-item-id="authority"
            const website = await page.$eval('a[data-item-id="authority"]', el => el.href).catch(() => '');
            
            // Address is usually a button starting with address
            const address = await page.$eval('button[data-item-id="address"]', el => el.innerText).catch(() => '');
            
            console.log({ name, phone, website, address });
        }
    } catch (e) {
        console.error("Scraping error:", e);
    } finally {
        await browser.close();
    }
})();
