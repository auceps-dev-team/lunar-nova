const { chromium } = require('playwright');
const http = require('http');

async function test() {
    const versionRes = await new Promise((resolve) => {
        http.get('http://127.0.0.1:8315/json/version', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
    });

    const browser = await chromium.connectOverCDP(versionRes.webSocketDebuggerUrl);
    const contexts = browser.contexts();

    for (let c of contexts) {
        for (let p of c.pages()) {
            const url = p.url();
            if (url.includes('whatsapp')) {
                try {
                    const title = await p.title().catch(() => 'error');
                    console.log(`URL: ${url} | Title: ${title}`);
                    const id = await p.evaluate(() => window.__whatsapp_instance_id).catch(e => "Error evaluating: " + e.message);
                    console.log(` -> ID: ${id}`);
                } catch (e) { }
            }
        }
    }

    console.log("DONE");
    process.exit(0);
}

test();
