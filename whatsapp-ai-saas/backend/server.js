const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
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
    try {
        // To avoid Protocol error (Browser.getVersion), we MUST connect to the browser root, not a specific page target
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('http://127.0.0.1:8315/json/version');
        const json = await response.json();

        // Connect to the root browser CDP endpoint
        const browser = await chromium.connectOverCDP(json.webSocketDebuggerUrl);
        const contexts = browser.contexts();

        let activeInstancesCount = 0;

        for (const context of contexts) {
            for (const page of context.pages()) {
                if (page.url().includes('web.whatsapp.com')) {
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
        await browser.close();

        res.json({
            status: 'success',
            active_instances: activeInstancesCount,
            message: 'Connected to Electron CDP successfully',
        });

    } catch (error) {
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
        const fetch = (await import('node-fetch')).default;
        const responseTargets = await fetch('http://127.0.0.1:8315/json');
        const targets = await responseTargets.json();

        // Find the specific webview targeting WhatsApp
        const whatsappTarget = targets.find(t => t.url.includes('web.whatsapp.com'));

        if (!whatsappTarget) {
            return res.status(404).json({ error: 'WhatsApp instance not found in targets. Is the tab completely open?' });
        }

        const responseVersion = await fetch('http://127.0.0.1:8315/json/version');
        const jsonVersion = await responseVersion.json();

        // Connect to the root browser CDP endpoint
        browser = await chromium.connectOverCDP(jsonVersion.webSocketDebuggerUrl);
        const contexts = browser.contexts();

        let targetPage = null;

        // Iterate through all contexts and pages to find the WhatsApp Web frame
        for (const context of contexts) {
            for (const page of context.pages()) {
                // Playwright pages usually have a url() that matches the target.url
                if (page.url() === whatsappTarget.url || page.url().includes('web.whatsapp.com')) {
                    targetPage = page;
                    break;
                }
            }
            if (targetPage) break;
        }

        if (!targetPage) {
            await browser.close();
            return res.status(404).json({ error: 'WhatsApp instance found in targets but not in Playwright contexts.' });
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

        await browser.close();

        res.json({
            status: 'success',
            instance_id,
            context: chatContext
        });

    } catch (error) {
        if (browser) await browser.close().catch(() => { });
        console.error('Context Extraction Error:', error);
        res.status(500).json({ error: 'Failed to extract chat context safely. Exception: ' + error.message });
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
        console.log(`[Catalog] Saved temporary image to ${tempImagePath}`);

        // 2. Connect to Playwright
        const fetch = (await import('node-fetch')).default;

        // Root browser CDP Endpoint
        const browserJsonRes = await fetch('http://127.0.0.1:8315/json/version').catch(() => null);
        if (!browserJsonRes) throw new Error("Ensure WhatsApp Desktop app (Electron) is running.");
        const jsonVersion = await browserJsonRes.json();

        // Target specific instance
        const targetsRes = await fetch('http://127.0.0.1:8315/json').catch(() => null);
        const targets = await targetsRes.json();

        // Match the instance_id partition
        const whatsappTarget = targets.find(t =>
            t.url.includes('web.whatsapp.com') &&
            t.url.includes(`whatsapp-ai-saas/persist:${instance_id}/`)
        );

        if (!whatsappTarget) {
            throw new Error("Could not find WhatsApp Web target for the given instance ID.");
        }

        browser = await chromium.connectOverCDP(jsonVersion.webSocketDebuggerUrl);
        const contexts = browser.contexts();
        let targetPage = null;

        for (const context of contexts) {
            for (const page of context.pages()) {
                if (page.url() === whatsappTarget.url || page.url().includes('web.whatsapp.com')) {
                    targetPage = page;
                    break;
                }
            }
            if (targetPage) break;
        }

        if (!targetPage) {
            throw new Error("Target Page Context could not be located.");
        }

        console.log(`[Catalog] Connected to instance: ${instance_id}`);

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

        console.log(`[Catalog] Pre-flight Check Passed. Proceeding with upload...`);

        // Wait a small moment to ensure UI stability
        await targetPage.waitForTimeout(1000);

        // 4. Navigate to Catalog
        // Click the catalog icon in the header or menu
        await targetPage.click('span[data-icon="catalog"]', { timeout: 5000 }).catch(() => {
            throw new Error("Could not find or click the Catalog icon.");
        });

        // Click "Add a new item" (Ajouter un nouvel article)
        await targetPage.waitForSelector('span[data-icon="plus"]', { timeout: 8000 });
        await targetPage.click('span[data-icon="plus"]');

        // 5. Inject Image and Fill Form
        // Native Playwright file input
        console.log(`[Catalog] Locating file input...`);
        // The input type=file is hidden but accept image types
        await targetPage.waitForSelector('input[type="file"][accept*="image"]', { state: 'attached', timeout: 8000 });
        await targetPage.setInputFiles('input[type="file"][accept*="image"]', tempImagePath);

        console.log(`[Catalog] Filling out product forms...`);
        // Need to wait slightly for image to visually load
        await targetPage.waitForTimeout(2000);

        // Find inputs by placeholder or aria-labels (Meta changes these often, so we use flexible selectors)
        // Usually, the first text input is the Name, second is Description (or div contenteditable)
        // Note: Playwright's getByRole or specific placeholder text helps

        // Find main wrapper for the catalog form to constrain selectors
        await targetPage.waitForSelector('.catalog-form-container, div[role="dialog"]', { timeout: 5000 }).catch(() => { });

        // Try filling Name (Usually the first editable text field)
        const nameInputLocator = targetPage.locator('input[type="text"]').first();
        if (await nameInputLocator.isVisible()) {
            await nameInputLocator.fill(productName);
        } else {
            // Fallback: search for placeholder "Nom" or "Item name"
            const altName = targetPage.locator('input[placeholder*="Nom"], input[placeholder*="name"], input[placeholder*="Nom de l\'article"]');
            if (await altName.count() > 0) {
                await altName.first().fill(productName);
            }
        }

        // Try filling Description (Usually a div contenteditable or textarea)
        const descLocator = targetPage.locator('div[title*="Description"], div[aria-label*="Description"], textarea');
        if (await descLocator.count() > 0) {
            // Fill the contenteditable element properly
            await descLocator.first().focus();
            await targetPage.keyboard.type(productDescription);
        }

        // Try filling Price if provided
        if (productPrice) {
            const priceLocator = targetPage.locator('input[placeholder*="Prix"], input[placeholder*="Price"]');
            if (await priceLocator.count() > 0) {
                await priceLocator.first().fill(productPrice.toString());
            }
        }

        console.log(`[Catalog] Form filled. Attempting to submit...`);

        // 6. Final Submit
        // "Ajouter au catalogue" / "Save" / "Add to catalog"
        const submitButton = targetPage.locator('button:has-text("Ajouter"), button:has-text("Save"), button:has-text("Add")').last();
        if (await submitButton.isVisible()) {
            await submitButton.click();
            console.log(`[Catalog] Product Submitted Successfully.`);
        } else {
            console.warn(`[Catalog] Submit button not found. Product might have been filled but not saved automatically.`);
        }

        // Wait for potential network request completion
        await targetPage.waitForTimeout(2000);

        await browser.close();

        // 7. Cleanup
        if (fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
        }

        res.json({
            status: 'success',
            message: 'Product successfully pushed to WhatsApp Business Catalog.'
        });

    } catch (error) {
        if (browser) await browser.close().catch(() => { });
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
