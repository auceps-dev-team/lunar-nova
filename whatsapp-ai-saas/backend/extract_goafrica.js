const { chromium } = require('playwright');
const fs = require('fs');

async function extractMetadata() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('Fetching countries...');
    await page.goto('https://www.goafricaonline.com/ci', { waitUntil: 'domcontentloaded' });
    
    // Check if there is a country dropdown or list. Usually it's in a modal or a select.
    const countries = await page.evaluate(() => {
        // Go Africa usually has a country selector. Let's look for hrefs with 2 letters.
        const links = Array.from(document.querySelectorAll('a[href^="https://www.goafricaonline.com/"]'));
        const codes = links.map(l => {
            const match = l.href.match(/goafricaonline\.com\/([a-z]{2})(?:\/|$)/);
            return match ? match[1] : null;
        }).filter(Boolean);
        return [...new Set(codes)];
    });
    console.log('Countries:', countries);

    console.log('Fetching categories...');
    await page.goto('https://www.goafricaonline.com/ci/annuaire', { waitUntil: 'domcontentloaded' });
    const categories = await page.evaluate(() => {
        const catLinks = Array.from(document.querySelectorAll('a[href^="/ci/annuaire/"]'));
        return catLinks.map(l => ({
            name: l.innerText.trim(),
            slug: l.getAttribute('href').replace('/ci/annuaire/', '')
        })).filter(c => c.name && c.slug);
    });
    console.log(`Found ${categories.length} categories.`);

    await browser.close();
}

extractMetadata().catch(console.error);
