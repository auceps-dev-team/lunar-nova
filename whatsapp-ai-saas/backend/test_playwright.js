const { chromium } = require('playwright');
const http = require('http');

async function test() {
    console.log("Fetching root CDP version...");
    const versionRes = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:8315/json/version', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    console.log("Root websocket:", versionRes.webSocketDebuggerUrl);
    const browser = await chromium.connectOverCDP(versionRes.webSocketDebuggerUrl);
    const contexts = browser.contexts();

    console.log(`Found ${contexts.length} contexts.`);

    for (let i = 0; i < contexts.length; i++) {
        const pages = contexts[i].pages();
        console.log(`Context ${i} has ${pages.length} pages.`);
        for (let j = 0; j < pages.length; j++) {
            const page = pages[j];
            console.log(`  Page ${j}: URL = ${page.url()}, Title = ${await page.title().catch(() => 'error')}`);
            if (page.url().includes('web.whatsapp.com')) {
                try {
                    const id = await page.evaluate(() => window.__whatsapp_instance_id);
                    console.log(`    -> window.__whatsapp_instance_id = ${id}`);
                } catch (e) {
                    console.log(`    -> Error evaluating: ${e.message}`);
                }
            }
        }
    }
    await browser.close();
}

test().catch(console.error);
