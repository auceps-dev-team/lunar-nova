const { chromium } = require('playwright');
const http = require('http');

async function test() {
    console.log("Fetching /json...");
    const targetsRes = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:8315/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const webviews = targetsRes.filter(t => t.url.includes('web.whatsapp.com') && t.type !== 'service_worker');
    console.log(`Found ${webviews.length} webviews.`);

    for (const target of webviews) {
        if (!target.webSocketDebuggerUrl) continue;
        console.log("Connecting to target:", target.id);

        try {
            const browser = await chromium.connectOverCDP(target.webSocketDebuggerUrl);
            const context = browser.contexts()[0];
            const page = context.pages().length > 0 ? context.pages()[0] : null;

            if (page) {
                console.log(`  Connected! URL = ${page.url()}`);
                const id = await page.evaluate(() => window.__whatsapp_instance_id).catch(e => "Error: " + e.message);
                console.log(`  -> __whatsapp_instance_id = ${id}`);
            }
            await browser.close();
        } catch (e) {
            console.log(`  Failed to connect: ${e.message}`);
        }
    }
}

test().catch(console.error);
