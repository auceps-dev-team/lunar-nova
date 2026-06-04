const { chromium } = require('playwright');

class GoogleMapScraper {
    async search(query, ignoreLandlines = false, quantity = 20, duration = 5, zone = '') {
        console.log(`[GoogleMapScraper] Searching for "${query}" in "${zone}" | max: ${quantity} leads | max duration: ${duration}min`);
        const leads = [];
        const browser = await chromium.launch({ headless: true });
        
        try {
            const context = await browser.newContext({ locale: 'fr-FR' });
            const page = await context.newPage();
            
            const searchQuery = zone ? `${query} ${zone}` : query;
            const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
            
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
            
            // Accept cookies if present
            try {
                const acceptButton = await page.waitForSelector('button:has-text("Tout accepter")', { timeout: 3000 });
                if (acceptButton) await acceptButton.click();
            } catch (e) {
                // Ignore if no cookie banner
            }

            await page.waitForTimeout(2000); // Wait for initial load

            const linksSet = new Set();
            const startTime = Date.now();
            const durationMs = duration * 60 * 1000;
            
            // Scroll loop
            const resultsContainer = 'div[role="feed"]';
            try {
                await page.waitForSelector(resultsContainer, { timeout: 10000 });
                
                while (linksSet.size < quantity && (Date.now() - startTime) < durationMs) {
                    const links = await page.$$eval('a[href*="/maps/place/"]', els => els.map(a => a.href));
                    for (const link of links) {
                        linksSet.add(link);
                    }
                    
                    if (linksSet.size >= quantity) break;
                    
                    // Scroll down
                    await page.evaluate((selector) => {
                        const container = document.querySelector(selector);
                        if (container) container.scrollTop = container.scrollHeight;
                    }, resultsContainer);
                    
                    // Wait for new elements to load
                    await page.waitForTimeout(1500);
                    
                    // Check if end of list is reached
                    const endOfList = await page.$('span:has-text("Vous avez atteint la fin de la liste")');
                    if (endOfList) break;
                }
            } catch (e) {
                console.log("[GoogleMapScraper] Scroll feed not found or timeout. Maybe only one result?");
                // Fallback: if there's no feed, maybe it directly opened a single place
                const currentUrl = page.url();
                if (currentUrl.includes('/maps/place/')) {
                    linksSet.add(currentUrl);
                }
            }

            const linksToProcess = Array.from(linksSet).slice(0, quantity);
            console.log(`[GoogleMapScraper] Collected ${linksToProcess.length} links. Extracting details...`);
            
            // For each link, open and extract data
            for (const link of linksToProcess) {
                if ((Date.now() - startTime) > durationMs) {
                    console.log("[GoogleMapScraper] Max duration reached during detail extraction.");
                    break;
                }
                
                try {
                    const detailPage = await context.newPage();
                    await detailPage.goto(link, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await detailPage.waitForTimeout(1000); // Let UI settle
                    
                    const name = await detailPage.$eval('h1', el => el.innerText).catch(() => '');
                    let phone = await detailPage.$eval('button[data-item-id^="phone:tel:"]', el => el.innerText).catch(() => '');
                    const website = await detailPage.$eval('a[data-item-id="authority"]', el => el.href).catch(() => '');
                    const address = await detailPage.$eval('button[data-item-id="address"]', el => el.innerText).catch(() => '');
                    
                    await detailPage.close();

                    if (!name) continue; // Skip if no name found
                    
                    if (phone) {
                        phone = phone.replace(/[^\d+]/g, ''); // keep only digits and +
                    }

                    if (ignoreLandlines && phone) {
                        // Basic filtering for CI and FR
                        let isMobile = true;
                        if (phone.startsWith('+33')) {
                            if (!phone.match(/^\+33[67]/)) isMobile = false;
                        } else if (phone.startsWith('+225')) {
                            if (!phone.match(/^\+225[01|05|07]/)) isMobile = false;
                        }
                        if (!isMobile) continue; // Skip landlines
                    }

                    leads.push({
                        name,
                        phone: phone || '',
                        address: address || '',
                        website: website || '',
                        link: link
                    });

                } catch (e) {
                    console.error(`[GoogleMapScraper] Error scraping link ${link}:`, e.message);
                }
            }
            
        } catch (error) {
            console.error('[GoogleMapScraper] Main error:', error);
            throw error;
        } finally {
            await browser.close();
        }
        
        return leads;
    }
}

module.exports = new GoogleMapScraper();
