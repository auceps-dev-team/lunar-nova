const { chromium } = require('playwright');

(async () => {
    try {
        const fetch = (await import('node-fetch')).default;
        console.log('Fetching targets from debugger...');
        const responseTargets = await fetch('http://127.0.0.1:8315/json');
        const targets = await responseTargets.json();

        const whatsappTarget = targets.find(t => t.url.includes('web.whatsapp.com'));
        if (!whatsappTarget) {
            console.log('WhatsApp Target NOT found in /json.');
            return;
        }
        console.log('Found WhatsApp Target:', whatsappTarget.url);

        const responseVersion = await fetch('http://127.0.0.1:8315/json/version');
        const jsonVersion = await responseVersion.json();

        console.log('Connecting to browser CDP...');
        const browser = await chromium.connectOverCDP(jsonVersion.webSocketDebuggerUrl);
        const contexts = browser.contexts();

        console.log(`Found ${contexts.length} contexts.`);

        let targetPage = null;
        for (const context of contexts) {
            const pages = context.pages();
            console.log(`Context has ${pages.length} pages.`);
            for (const page of pages) {
                console.log('  - Page URL:', page.url());
                if (page.url() === whatsappTarget.url || page.url().includes('whatsapp.com')) {
                    targetPage = page;
                }
            }
        }

        if (targetPage) {
            console.log('Successfully resolved Playwright Page instance!');
            const title = await targetPage.title();
            console.log('Page Title:', title);
        } else {
            console.log('FAILED to resolve Playwright Page instance from contexts.');
        }

        await browser.close();
    } catch (err) {
        console.error('Test Failed:', err);
    }
})();
