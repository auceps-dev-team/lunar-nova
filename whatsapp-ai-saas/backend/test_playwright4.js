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
    const context = browser.contexts()[0];
    const page = context.pages()[0];

    console.log("Main Page URL:", page.url());
    const frames = page.frames();
    console.log(`Found ${frames.length} frames.`);
    for (let f of frames) {
        console.log(`  Frame URL: ${f.url()} Name: ${f.name()}`);
    }

    await browser.close();
}

test().catch(console.error);
