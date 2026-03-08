const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { generateProposals, chatWithAgent, generateImage } = require('./geminiService');
const { logCopilotInteraction } = require('./db');
const { getCachedProposals, setCachedProposals } = require('./redisClient');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API route to get WhatsApp instances status
app.get('/api/instances', async (req, res) => {
    let browser = null;
    try {
        // To avoid Protocol error (Browser.getVersion), we MUST connect to the browser root, not a specific page target
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('http://127.0.0.1:8315/json/version');
        const json = await response.json();

        // Connect to the root browser CDP endpoint
        browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:8315', defaultViewport: null });
        const targets = await browser.targets();

        let activeInstancesCount = 0;

        for (const target of targets) {
            if (target.url().includes('web.whatsapp.com') && target.type() === 'webview') {
                const page = await target.page();
                if (page) {
                    activeInstancesCount++;

                    try {
                        // Listen to basic WhatsApp DOM events (incoming messages)
                        await page.evaluate(() => {
                            if (window.whatsAppObserverAttached) return;
                            window.whatsAppObserverAttached = true;

                            console.log('[Orchestrator] Attached DOM Observer for new messages');
                            const observer = new MutationObserver((mutations) => {
                                mutations.forEach((mutation) => {
                                    if (mutation.addedNodes.length) {
                                        mutation.addedNodes.forEach((node) => {
                                            if (node.nodeType === Node.ELEMENT_NODE && node.outerHTML.includes('message-in')) {
                                                console.log('[Orchestrator Event] New incoming message detected!');
                                            }
                                        });
                                    }
                                });
                            });
                            observer.observe(document.body, { childList: true, subtree: true });
                        }).catch(err => console.error('Failed to attach observer:', err));
                    } catch (err) {
                        console.error('Error attaching observer to page:', err);
                    }
                }
            }
        }

        // Don't close the browser connecting just the contexts, leave it or close the connection properly
        browser.disconnect();

        res.json({
            status: 'success',
            active_instances: activeInstancesCount,
            message: 'Connected to Electron CDP successfully',
        });

    } catch (error) {
        if (browser) browser.disconnect();
        console.error('CDP Connection Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to connect to Orchestrator CDP. Is the Electron app running and is node-fetch installed?'
        });
    }
});

// Endpoint to extract WhatsApp chat context strictly in READ-ONLY mode
app.get('/api/context/:instance_id', async (req, res) => {
    const { instance_id } = req.params;

    let browser = null;
    try {
        // Connect Puppeteer directly to the Electron remote debugging port
        browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:8315', defaultViewport: null });

        const targets = browser.targets();
        let targetPage = null;

        // Iterate through all targets to find the exact WhatsApp Web instance
        for (const target of targets) {
            if (target.url().includes('web.whatsapp.com') && target.type() === 'webview') {
                try {
                    const page = await target.page();
                    if (page) {
                        const pageInstanceId = await page.evaluate(() => window.__whatsapp_instance_id).catch(() => null);
                        if (pageInstanceId === instance_id) {
                            targetPage = page;
                            break;
                        }
                    }
                } catch (e) { }
            }
        }

        if (!targetPage) {
            browser.disconnect();
            return res.status(404).json({ error: 'WhatsApp instance found in targets but not assigned the expected Webview instance_id.' });
        }

        // Extremely safe DOM Parsing: no clicks, no interactions.
        // We only extract the text content from the active conversation panel.
        const chatContext = await targetPage.evaluate(() => {
            const result = {
                contactName: 'Unknown',
                messages: []
            };

            // WhatsApp structurally keeps the active chat header here
            const headerTitle = document.querySelector('header span[dir="auto"]');
            if (headerTitle) {
                result.contactName = headerTitle.textContent;
            }

            // Extract the last 15 visible messages
            const messageNodes = Array.from(document.querySelectorAll('div.message-in, div.message-out')).slice(-15);

            messageNodes.forEach(node => {
                const textNode = node.querySelector('.selectable-text');
                const timeNode = node.querySelector('[data-icon="msg-time"]');

                if (textNode) {
                    result.messages.push({
                        sender: node.classList.contains('message-in') ? result.contactName : 'You',
                        text: textNode.textContent,
                        // Time is usually adjacent to the metadata block
                        time: timeNode ? timeNode.parentElement.textContent : 'Unknown'
                    });
                }
            });

            return result;
        });

        res.json({
            status: 'success',
            instance_id,
            context: chatContext
        });

    } catch (error) {
        console.error('Context Extraction Error:', error);
        res.status(500).json({ error: 'Failed to extract chat context safely. Exception: ' + error.message });
    } finally {
        if (browser) browser.disconnect();
    }
});

// Endpoint to fetch Copilot Generative Replies
app.post('/api/gemini/copilot', async (req, res) => {
    // Requires instance_id for DB logging in a multi-tenant environment.
    // Usually passed as part of the request. Let's assume frontend passes it.
    const { instance_id, chatContext, model } = req.body;

    if (!chatContext) {
        return res.status(400).json({ error: 'Missing chat context.' });
    }

    try {
        // Feature: Redis Session Caching
        // Create an MD5 hash of the last 3 messages to use as a cache key.
        // This prevents excessive API billing if user spams the button without new messages.
        const contextFingerprint = chatContext.contactName + '_' +
            chatContext.messages.slice(-3).map(m => m.text).join('|') + '_' + (model || 'gemini-1.5-pro');

        const cacheKey = 'copilot:' + crypto.createHash('md5').update(contextFingerprint).digest('hex');

        const cached = await getCachedProposals(cacheKey);
        if (cached) {
            console.log(`[Cache Hit] Returning cached proposals for ${chatContext.contactName}`);
            return res.json({
                status: 'success',
                cached: true,
                proposals: cached
            });
        }

        // Generate via Gemini
        console.log(`[Cache Miss] Generating new proposals for ${chatContext.contactName}`);
        const proposalsObj = await generateProposals(chatContext, model);
        const proposals = proposalsObj.proposed_replies || [];

        // Cache for 60 seconds
        await setCachedProposals(cacheKey, proposals, 60);

        // Feature: Audit Logging
        // Asynchronously log the transaction for analytics and security
        logCopilotInteraction(
            instance_id || 'unknown_instance',
            chatContext.contactName,
            chatContext,
            proposals
        );

        res.json({
            status: 'success',
            cached: false,
            proposals: proposals
        });
    } catch (error) {
        console.error('Copilot Route Error:', error);
        res.status(500).json({ error: 'Failed to generate copilot proposals.' });
    }
});

// Endpoint for specialized Persona AI Agents (Legal, Creative)
app.post('/api/gemini/agent', async (req, res) => {
    const { persona, message, imageParams } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Missing message.' });
    }

    try {
        const aiResponse = await chatWithAgent(persona, message, imageParams);
        res.json({
            status: 'success',
            response: aiResponse.response
        });
    } catch (error) {
        console.error('Agent Route Error:', error);
        res.status(500).json({ error: 'Failed to chat with agent.' });
    }
});

// Endpoint to generate an image via Gemini Imagen 4
app.post('/api/gemini/generate-image', async (req, res) => {
    const { prompt, aspectRatio, imageParams } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt.' });
    }

    try {
        const generationResponse = await generateImage(prompt, aspectRatio, imageParams);
        if (generationResponse.error) {
            return res.status(500).json({ status: 'error', error: generationResponse.error });
        }
        res.json({
            status: 'success',
            imageStore: generationResponse.imageBytes
        });
    } catch (error) {
        console.error('Image Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate image via API.' });
    }
});

// Endpoint to automatically push an item to WhatsApp Business Catalog via Playwright
app.post('/api/catalog/upload', async (req, res) => {
    const { instance_id, productName, productDescription, productPrice, imageBase64 } = req.body;

    if (!instance_id || !productName || !imageBase64) {
        return res.status(400).json({ error: 'Missing required fields (instance_id, productName, imageBase64).' });
    }

    let browser;
    let tempImagePath;

    try {
        // 1. Prepare the temporary image file
        const tempDir = path.join(__dirname, '.temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Strip out base64 header if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const fileName = `catalog_product_${Date.now()}.png`;
        tempImagePath = path.join(tempDir, fileName);

        fs.writeFileSync(tempImagePath, base64Data, 'base64');
        console.log(`[Catalog] Saved temporary image to ${tempImagePath} `);

        // 2. Connect to Puppeteer
        browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:8315', defaultViewport: null });
        const targets = browser.targets();
        let targetPage = null;

        for (const target of targets) {
            if (target.url().includes('web.whatsapp.com') && target.type() === 'webview') {
                try {
                    const page = await target.page();
                    if (page) {
                        const pageInstanceId = await page.evaluate(() => window.__whatsapp_instance_id).catch(() => null);
                        if (pageInstanceId === instance_id) {
                            targetPage = page;
                            break;
                        }
                    }
                } catch (e) { }
            }
        }

        if (!targetPage) {
            throw new Error(`Target Page Context could not be located.Ensure the Webview for instance ${instance_id} is mounted.`);
        }

        console.log(`[Catalog] Connected to instance: ${instance_id} `);

        // 3. Pre-flight Check: Is it a Business Account?
        const isBusinessAccount = await targetPage.evaluate(() => {
            // Business accounts have specific data-icon available on the top header/menu area
            const catalogMenuIcon = document.querySelector('span[data-icon="catalog"]');
            const labelsIcon = document.querySelector('span[data-icon="labels"]');
            return !!(catalogMenuIcon || labelsIcon);
        });

        if (!isBusinessAccount) {
            throw new Error("SECURITY BLOCK: The selected instance is not a WhatsApp Business account. Catalog actions cannot be performed.");
        }

        console.log(`[Catalog] Pre - flight Check Passed.Proceeding with upload...`);

        // In Puppeteer, focus using bringToFront or focus
        await targetPage.bringToFront().catch(() => { });

        try {
            // Click Catalog Icon
            await targetPage.waitForSelector('span[data-icon="catalog"]', { timeout: 5000 });
            await targetPage.evaluate(() => document.querySelector('span[data-icon="catalog"]').closest('div[role="button"]').click());
            console.log(`[Catalog] Clicked Catalog Icon`);

            // Wait a moment for navigation
            await new Promise(r => setTimeout(r, 2000));

            // Wait for "Add a new item" button and click using xpath or evaluate
            await targetPage.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const addButton = buttons.find(b => b.innerText.includes('Add a new item') || b.innerText.includes('Ajouter un nouvel article'));
                if (addButton) addButton.click();
            });
            console.log(`[Catalog] Clicked Add Item Button`);

            // Wait for form to appear
            await new Promise(r => setTimeout(r, 2000));

            // We will upload using setInputFiles, wait for input[type="file"] or input[accept="image/*"]
            const fileInputSelector = 'input[type="file"][accept="image/png,image/jpeg,image/webp"]';
            await targetPage.waitForSelector(fileInputSelector, { timeout: 10000 });

            const fileInput = await targetPage.$(fileInputSelector);
            if (fileInput) {
                await fileInput.uploadFile(tempImagePath);
                console.log(`[Catalog] Image injected from disk: ${tempImagePath} `);
            } else {
                throw new Error("File input not found in DOM");
            }

            // Wait for image thumbnail to render
            await new Promise(r => setTimeout(r, 2000));

            // Find Inputs and Textareas
            // Item Name (usually the first input[type="text"])
            const inputs = await targetPage.$$('div[contenteditable="true"]');
            if (inputs.length > 0) {
                // First is usually Name
                await inputs[0].click();
                await targetPage.keyboard.type(productName, { delay: 10 });
                console.log(`[Catalog] Pushed Product Name`);
            }

            // Description (usually the second contenteditable div)
            if (productDescription && inputs.length > 1) {
                await inputs[1].click();
                await targetPage.keyboard.type(productDescription, { delay: 10 });
                console.log(`[Catalog] Pushed Product Description`);
            }

            // Price (find input by placeholder or type)
            if (productPrice) {
                const priceInput = await targetPage.$('input[placeholder*="Prix"], input[placeholder*="Price"]');
                if (priceInput) {
                    await priceInput.type(productPrice.toString(), { delay: 10 });
                    console.log(`[Catalog] Pushed Product Price`);
                }
            }

            console.log(`[Catalog] Form filled.Attempting to submit...`);

            // Final Submission (Optional: uncomment to auto-submit, better to let user verify)
            // await targetPage.evaluate(() => {
            //     const buttons = Array.from(document.querySelectorAll('button'));
            //     const saveBtn = buttons.find(b => b.innerText.includes('Add to catalog') || b.innerText.includes('Ajouter au catalogue'));
            //     if (saveBtn) saveBtn.click();
            // });

        } catch (e) {
            console.error("Puppeteer Catalog Interaction Error", e);
            throw new Error(`Catalog interaction failed: ${e.message} `);
        }

        res.json({
            status: 'success',
            message: 'Product successfully pushed to WhatsApp Business Catalog.'
        });

    } catch (error) {
        if (tempImagePath && fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath); // Cleanup on fail
        }
        console.error('Catalog Automation Error:', error);
        res.status(500).json({ error: 'Failed to automate WhatsApp Catalog. Exception: ' + error.message });
    }
});

app.listen(PORT, () => {
    console.log(`[Orchestrator] Running on http://localhost:${PORT}`);
    console.log(`[Orchestrator] Ready to connect to Electron CDP at port 8315`);
});
