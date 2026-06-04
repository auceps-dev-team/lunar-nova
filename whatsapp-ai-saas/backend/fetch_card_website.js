const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
    const b = await chromium.launch({ headless: true });
    const p = await b.newPage();
    await p.goto('https://www.goafricaonline.com/ci/648954-boyoot-promoteur-immobilier-abidjan-cote-ivoire', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3000);
    
    const website = await p.evaluate(() => {
        // Find text containing boyootimmobilier or just the URL
        const links = document.querySelectorAll('a');
        for(let a of links) {
            if (a.href && !a.href.includes('goafricaonline') && a.href.includes('http')) {
                return a.href;
            }
        }
        
        // Sometimes it's in a div or span
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while(node = walk.nextNode()) {
            if (node.nodeValue.includes('boyootimmobilier.com') || node.nodeValue.includes('www.')) {
                return node.nodeValue.trim();
            }
        }
        return null;
    });
    
    console.log("Found website on card:", website);
    await b.close();
})();
