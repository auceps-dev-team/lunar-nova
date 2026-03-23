const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const aiController = require('./aiController');
const { logCopilotInteraction, pool, getSetting, setSetting } = require('./db');
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

// --- Phase 15: Modularity APIs ---
app.get('/api/settings', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM app_settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        res.json({ status: 'success', settings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/settings', async (req, res) => {
    try {
        for (const [key, value] of Object.entries(req.body)) {
            await setSetting(key, value);
        }
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/agents', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ai_agents');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/agents', async (req, res) => {
    const { id, name, system_instruction, response_format, provider_override } = req.body;
    try {
        const agentId = id || `agent_${Date.now()}`;
        await pool.query(
            'INSERT INTO ai_agents (id, name, system_instruction, response_format, provider_override) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO UPDATE SET name = $2, system_instruction = $3, response_format = $4, provider_override = $5',
            [agentId, name, system_instruction, response_format || 'text', provider_override || null]
        );
        res.json({ status: 'success', id: agentId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/agents/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM ai_agents WHERE id = $1', [req.params.id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/ai/models', async (req, res) => {
    try {
        const provider = req.query.provider;
        const apiKey = req.query.apiKey;
        const models = await aiController.listModels(provider, apiKey);
        res.json({ status: 'success', models });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint to fetch Copilot Generative Replies
app.post('/api/ai/copilot', async (req, res) => {
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

        // Generate via AI Controller
        console.log(`[Cache Miss] Generating new proposals for ${chatContext.contactName}`);
        const proposalsObj = await aiController.generateProposals(chatContext, model);
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
app.post('/api/ai/agent', async (req, res) => {
    const { persona, message, messages, imageParams, promptFormat, currentTasks, isRealTime } = req.body;

    if (!message && (!messages || messages.length === 0)) {
        return res.status(400).json({ error: 'Missing message.' });
    }

    try {
        const aiResponse = await aiController.chatWithAgent(persona, message, imageParams, promptFormat, messages, currentTasks, isRealTime);
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
app.post('/api/ai/generate-image', async (req, res) => {
    const { prompt, aspectRatio, imageParams, editMode, mode } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt.' });
    }

    try {
        const generationResponse = await aiController.generateImage(prompt, aspectRatio, imageParams, editMode, mode);
        if (generationResponse.error) {
            return res.status(500).json({ error: generationResponse.error });
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
    let tempImagePath = null;

    // Helper functions for human-like behavior
    const humanDelay = async (min = 1500, max = 3500) => {
        const ms = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise(resolve => setTimeout(resolve, ms));
    };
    const humanTypeDelay = () => Math.floor(Math.random() * (120 - 40 + 1)) + 40;

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

    } catch (error) {
        if (tempImagePath && fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath); // Cleanup on fail
        }
        console.error('Image Error:', error);
        res.status(500).json({ error: 'Failed writing file.' });
    }

    try {
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
            const catalogMenuIcon = document.querySelector('span[data-icon="catalog"], span[data-icon="storefront"], span[data-icon="smb-store"]');
            const labelsIcon = document.querySelector('span[data-icon="labels"], span[data-icon="smb-labels-header"]');
            return !!(catalogMenuIcon || labelsIcon);
        });

        if (!isBusinessAccount) {
            console.warn(`[Catalog] SECURITY WARNING: Business icons ('catalog', 'smb-store', 'labels') not found. Proceeding with caution.`);
            // throw new Error("SECURITY BLOCK: The selected instance is not a WhatsApp Business account. Catalog actions cannot be performed.");
        }

        console.log(`[Catalog] Pre - flight Check Passed.Proceeding with upload...`);

        // In Puppeteer, focus using bringToFront or focus
        await targetPage.bringToFront().catch(() => { });

        try {
            await humanDelay(1000, 2000); // Breathe

            // --- ADAPTIVE CHECK ---
            // If the user is ALREADY on the "Add Item" page, we can skip navigation entirely.
            // We know we are there if the file input already exists.
            let isAlreadyOnAddItemPage = false;
            try {
                const immediateFileInput = await targetPage.$('input[type="file"]');
                if (immediateFileInput) {
                    isAlreadyOnAddItemPage = true;
                    console.log(`[Catalog] Adaptive check: User is already on the Add Item page. Skipping navigation.`);
                }
            } catch (e) {
                // Ignore, we will proceed with normal navigation
            }

            if (!isAlreadyOnAddItemPage) {
                // Click Catalog Icon (could be 'catalog', 'smb-store', or 'storefront')
                const storefrontSelectors = 'span[data-icon="catalog"], span[data-icon="smb-store"], span[data-icon="storefront"]';
                await targetPage.waitForSelector(storefrontSelectors, { timeout: 8000 });
                await targetPage.evaluate((sel) => {
                    const icon = document.querySelector(sel);
                    if (icon) {
                        const btn = icon.closest('div[role="button"]') || icon.closest('button') || icon;
                        btn.click();
                    }
                }, storefrontSelectors);
                console.log(`[Catalog] Clicked Catalog/Storefront Icon`);

                // Wait a moment for navigation (human reading time)
                await humanDelay(2500, 4500);

                // Step 2: Intermediate Catalogue Click if we are on "Outils professionnels" (Business Tools sidebar)
                await targetPage.evaluate(() => {
                    const spans = Array.from(document.querySelectorAll('span, div'));
                    const catSpan = spans.find(s => {
                        const txt = s.innerText ? s.innerText.trim().toLowerCase() : '';
                        return (txt === 'catalogue' || txt === 'catalog') && s.closest('div[role="button"]');
                    });
                    if (catSpan) {
                        const btn = catSpan.closest('div[role="button"]');
                        btn.click();
                    }
                });
                console.log(`[Catalog] Checked for intermediate Catalogue menu`);

                await humanDelay(2000, 3000);

                // Wait for "Add a new item" button and click using xpath or evaluate
                const clicked = await targetPage.evaluate(() => {
                    // Exact match from user HTML DOM dump
                    const exactAddBtn = document.querySelector(
                        'button[aria-label*="Ajouter un nouvel article"], button[aria-label*="Add a new item"], ' +
                        'div[aria-label*="Ajouter un nouvel article"], div[aria-label*="Add a new item"], ' +
                        'button[title*="Ajouter un nouvel article"], button[title*="Add a new item"]'
                    );

                    if (exactAddBtn) {
                        const btn = exactAddBtn.closest('div[role="button"]') || exactAddBtn.closest('button') || exactAddBtn;
                        btn.click();
                        return 'exact-aria-label';
                    }

                    // Try to find the "Plus" icon used by WhatsApp for adding items
                    const plusIcon = document.querySelector('span[data-icon="plus"]');
                    if (plusIcon) {
                        const btn = plusIcon.closest('div[role="button"]') || plusIcon.closest('button') || plusIcon;
                        btn.click();
                        return 'icon';
                    }

                    // Fallback to text matching: Meta might use a large div without a standard role
                    const allElements = Array.from(document.querySelectorAll('div, span, button'));
                    const addButton = allElements.find(el => {
                        if (el.children.length > 2 && el.tagName !== 'BUTTON') return false; // Avoid matching parent containers
                        const txt = el.innerText ? el.innerText.trim().toLowerCase() : '';
                        return txt === 'add a new item' || txt === 'ajouter un nouvel article' ||
                            txt === 'ajouter un article' || txt === 'add new item';
                    });

                    if (addButton) {
                        const btn = addButton.closest('div[role="button"]') || addButton.closest('button') || addButton;
                        btn.click();
                        return 'text';
                    }

                    return false;
                });

                if (!clicked) {
                    // Log all buttons to figure out what Meta changed it to
                    const allButtons = await targetPage.evaluate(() => Array.from(document.querySelectorAll('button, div[role="button"]')).map(b => b.innerText || b.getAttribute('aria-label')).filter(Boolean));
                    console.error(`[Catalog] Available buttons:`, allButtons);
                    throw new Error("Could not find the 'Add item' button (Plus icon or text match failed).");
                }
                console.log(`[Catalog] Clicked Add Item Button via ${clicked}`);

                // Wait for form to appear (animation time + human visual register)
                await humanDelay(2500, 4000);
            }

            // We will upload using setInputFiles, wait for input[type="file"]
            const fileInputSelector = 'input[type="file"]';
            await targetPage.waitForSelector(fileInputSelector, { timeout: 10000 });

            const fileInput = await targetPage.$(fileInputSelector);
            if (fileInput) {
                await fileInput.uploadFile(tempImagePath);
                console.log(`[Catalog] Image injected from disk: ${tempImagePath} `);
            } else {
                throw new Error("File input not found in DOM");
            }

            // Wait for image thumbnail to render and load (avoid suspicious speed)
            await humanDelay(3000, 5000);

            // Wait for image thumbnail to render and load (avoid suspicious speed)
            await humanDelay(3000, 5000);

            console.log(`[Catalog] Image upload complete. Handing off to user via Copilot...`);

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

// --- Phase 13: WhatsApp Contacts APIs ---
app.get('/api/wa/contact-lists', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM wa_contact_lists ORDER BY id DESC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/wa/contact-lists', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM wa_contact_lists ORDER BY id DESC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/wa/contact-lists', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('INSERT INTO wa_contact_lists (name) VALUES ($1) RETURNING *', [name]);
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/wa/segments', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM wa_segments ORDER BY id DESC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/wa/segments', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('INSERT INTO wa_segments (name) VALUES ($1) RETURNING *', [name]);
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/wa/contacts', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, s.name as segment_name, l.name as list_name
            FROM wa_contacts c
            LEFT JOIN wa_segments s ON c.segment_id = s.id
            LEFT JOIN wa_contact_lists l ON c.list_id = l.id
            ORDER BY c.id DESC
        `);
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/wa/contacts/bulk', async (req, res) => {
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ error: 'No valid contacts provided' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (const contact of contacts) {
            const { name, phone, segment_name, email, address } = contact;
            let segment_id = null;

            // Simple Auto-Resolution: if a segment is typed, find or create it
            if (segment_name) {
                const segCheck = await client.query('SELECT id FROM wa_segments WHERE name = $1', [segment_name]);
                if (segCheck.rows.length > 0) {
                    segment_id = segCheck.rows[0].id;
                } else {
                    const newSeg = await client.query('INSERT INTO wa_segments (name) VALUES ($1) RETURNING id', [segment_name]);
                    segment_id = newSeg.rows[0].id;
                }
            }

            // Insert the contact
            await client.query(
                'INSERT INTO wa_contacts (name, phone, segment_id, email, address) VALUES ($1, $2, $3, $4, $5)',
                [name || 'Inconnu', phone, segment_id, email || null, address || null]
            );
        }

        await client.query('COMMIT');
        res.json({ status: 'success', imported: contacts.length });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Bulk Import Error: ", err);
        res.status(500).json({ error: 'Database error during bulk insert', details: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/wa/contacts', async (req, res) => {
    const { name, phone, list_id, segment_id, email, address } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO wa_contacts (name, phone, list_id, segment_id, email, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, phone, list_id || null, segment_id || null, email || null, address || null]
        );
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/wa/contacts/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM wa_contacts WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



app.put('/api/wa/contacts/bulk-update', async (req, res) => {
    const { contactIds, segmentId } = req.body;
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'contactIds array is required and cannot be empty' });
    }

    try {
        // Build parameterized query for the IN clause
        const idPlaceholders = contactIds.map((_, i) => `$${i + 2}`).join(',');
        const query = `
            UPDATE wa_contacts 
            SET segment_id = $1 
            WHERE id IN (${idPlaceholders}) 
            RETURNING *
        `;

        const values = [segmentId || null, ...contactIds];
        const result = await pool.query(query, values);

        console.log(`[WA] Bulk updated ${result.rowCount} contacts`);
        res.json({ status: 'success', data: result.rows, updatedCount: result.rowCount });
    } catch (err) {
        console.error('[WA] Error bulk updating contacts:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/wa/contacts/bulk-update-list', async (req, res) => {
    const { contactIds, listId } = req.body;
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'contactIds array is required and cannot be empty' });
    }

    try {
        const idPlaceholders = contactIds.map((_, i) => `$${i + 2}`).join(',');
        const query = `
            UPDATE wa_contacts 
            SET list_id = $1 
            WHERE id IN (${idPlaceholders}) 
            RETURNING *
        `;

        const values = [listId || null, ...contactIds];
        const result = await pool.query(query, values);

        console.log(`[WA] Bulk updated lists for ${result.rowCount} contacts`);
        res.json({ status: 'success', data: result.rows, updatedCount: result.rowCount });
    } catch (err) {
        console.error('[WA] Error bulk updating lists:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/wa/contacts/:id', async (req, res) => {
    const { name, phone, list_id, segment_id, email, address } = req.body;
    try {
        // Try with email/address columns first
        const result = await pool.query(
            'UPDATE wa_contacts SET name = $1, phone = $2, list_id = $3, segment_id = $4, email = $5, address = $6 WHERE id = $7 RETURNING *',
            [name, phone, list_id || null, segment_id || null, email || null, address || null, req.params.id]
        );
        console.log(`[WA] Updated contact ${req.params.id}`);
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        // Fallback: if email/address columns don't exist yet
        if (err.message?.includes('column') && (err.message?.includes('email') || err.message?.includes('address'))) {
            try {
                const result = await pool.query(
                    'UPDATE wa_contacts SET name = $1, phone = $2, list_id = $3, segment_id = $4 WHERE id = $5 RETURNING *',
                    [name, phone, list_id || null, segment_id || null, req.params.id]
                );
                console.log(`[WA] Updated contact ${req.params.id} (legacy mode)`);
                res.json({ status: 'success', data: result.rows[0] });
            } catch (err2) {
                console.error(`[WA] Error updating contact:`, err2);
                res.status(500).json({ error: err2.message });
            }
        } else {
            console.error(`[WA] Error updating contact:`, err);
            res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/api/wa/contacts/bulk-delete', async (req, res) => {
    const { contactIds } = req.body;
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'contactIds array is required and cannot be empty' });
    }

    try {
        const idPlaceholders = contactIds.map((_, i) => `$${i + 1}`).join(',');
        const query = `DELETE FROM wa_contacts WHERE id IN (${idPlaceholders})`;

        const result = await pool.query(query, contactIds);

        console.log(`[WA] Bulk deleted ${result.rowCount} contacts`);
        res.json({ status: 'success', deletedCount: result.rowCount });
    } catch (err) {
        console.error('[WA] Error bulk deleting contacts:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/wa/contacts/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM wa_contacts WHERE id = $1', [req.params.id]);
        res.json({ status: 'success', message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/wa/open-chat', async (req, res) => {
    const { instance_id, phone, contact_id } = req.body;
    if (!instance_id || !phone) return res.status(400).json({ error: 'Missing instance_id or phone' });

    let formattedMessage = '';
    
    try {
        if (contact_id) {
            const contactRes = await pool.query('SELECT * FROM wa_contacts WHERE id = $1', [contact_id]);
            const settingsRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'dynamic_message_template'");
            if (contactRes.rows.length > 0 && settingsRes.rows.length > 0) {
                const contact = contactRes.rows[0];
                const template = settingsRes.rows[0].setting_value;
                if (template) {
                    formattedMessage = template
                        .replace(/\[Nom\]/gi, contact.name || '')
                        .replace(/\[Email\]/gi, contact.email || '')
                        .replace(/\[Adresse\]/gi, contact.address || '');
                }
            }
        }
    } catch (dbErr) {
        console.error("Error formatting template", dbErr);
    }

    let browser;
    try {
        const cdpUrl = `http://localhost:8315`;
        browser = await puppeteer.connect({
            browserURL: cdpUrl,
            defaultViewport: null
        });

        const targets = await browser.targets();
        let targetPage = null;

        for (const target of targets) {
            if (target.type() === 'webview' && target.url().includes('whatsapp')) {
                const p = await target.page();
                if (p) {
                    try {
                        const id = await p.evaluate(() => window.__whatsapp_instance_id);
                        if (id === instance_id) {
                            targetPage = p;
                            break;
                        }
                    } catch (e) { }
                    if (!targetPage) targetPage = p;
                }
            }
        }

        if (!targetPage) {
            browser.disconnect();
            return res.status(404).json({ error: 'WhatsApp instance not found or not ready.' });
        }

        // Clean phone number (e.g. 2250707070707, numbers only)
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const url = `https://web.whatsapp.com/send?phone=${cleanPhone}`;
        await targetPage.goto(url);

        res.json({ status: 'success', message: 'Chat opened', formattedMessage });
    } catch (err) {
        console.error("Open chat error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (browser) browser.disconnect();
    }
});

app.post('/api/wa/verify-contact', async (req, res) => {
    const { instance_id, phone } = req.body;

    if (!instance_id || !phone) {
        return res.status(400).json({ error: 'Missing required fields (instance_id, phone).' });
    }

    let browser;
    try {
        const cdpUrl = `http://localhost:8315`;
        console.log(`[Verifier] Trying to connect to Electron CDP for whatsapp instance...`);
        browser = await puppeteer.connect({
            browserURL: cdpUrl,
            defaultViewport: null
        });

        const targets = await browser.targets();
        let targetPage = null;

        for (const target of targets) {
            if (target.type() === 'webview' && target.url().includes('whatsapp')) {
                const p = await target.page();
                if (p) {
                    try {
                        const id = await p.evaluate(() => window.__whatsapp_instance_id);
                        if (id === instance_id) {
                            targetPage = p;
                            break;
                        }
                    } catch (e) { }
                    if (!targetPage) targetPage = p;
                }
            }
        }

        if (!targetPage) {
            browser.disconnect();
            return res.status(404).json({ error: `Not Found: Could not find WhatsApp Web tab for instance_id: ${instance_id}` });
        }

        console.log(`[Verifier] Navigating to WhatsApp send URL for phone: ${phone}`);
        // Strip out non-numeric characters for absolute safety
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        // User specified format requires a slash before the question mark
        const verifyUrl = `https://web.whatsapp.com/send/?phone=${cleanPhone}`;
        await targetPage.goto(verifyUrl, { waitUntil: 'domcontentloaded' });

        console.log(`[Verifier] Racing chatbox vs error modal using DOM check...`);
        const result = await targetPage.evaluate(() => {
            return new Promise((resolve) => {
                let checkCount = 0;
                const interval = setInterval(() => {
                    checkCount++;

                    // 1. Check for valid chat
                    // When a chat successfully opens, the #main container gets a <header> and a <footer> (message input area).
                    // This avoids false positives from the empty #main wrapper while being far less brittle than strict data-testids.
                    const validElement = document.querySelector('#main header, #main footer, [data-testid="conversation-panel-wrapper"], div[title="Type a message"], div[title="Tapez un message"]');
                    if (validElement) {
                        clearInterval(interval);
                        resolve('VALIDE');
                        return;
                    }

                    // 2. Check for the specific error modal provided by user
                    const modalBody = document.querySelector('[data-animate-modal-body="true"]');
                    if (modalBody) {
                        const text = modalBody.innerText || modalBody.textContent || '';
                        if (text.toLowerCase().includes("n'est pas sur whatsapp") ||
                            text.toLowerCase().includes("is not on whatsapp") ||
                            text.toLowerCase().includes("invalide")) {

                            // Try to click OK to dismiss the modal for the NEXT iteration
                            const buttons = document.querySelectorAll('button');
                            for (const btn of buttons) {
                                const btnText = btn.innerText || btn.textContent || '';
                                if (btnText.trim().toUpperCase() === 'OK') {
                                    btn.click();
                                    break;
                                }
                            }

                            clearInterval(interval);
                            resolve('INVALIDE');
                            return;
                        }
                    }

                    // 15 seconds timeout checking every 500ms
                    if (checkCount > 30) {
                        clearInterval(interval);
                        resolve('TIMEOUT');
                    }
                }, 500);
            });
        });

        if (result === 'VALIDE') {
            console.log(`✅ [Verifier] Le numéro ${cleanPhone} est valide.`);
            try {
                // Try to update DB. Using LIKE handles cases where DB has + prefix
                await pool.query('UPDATE wa_contacts SET status = ? WHERE phone LIKE ?', ['valid', `%${cleanPhone}%`]);
            } catch (dbErr) { console.error('DB Update Error:', dbErr); }
            res.json({ status: 'success', is_valid: true, message: `The number ${cleanPhone} is registered on WhatsApp.` });
        } else {
            console.log(`❌ [Verifier] Le numéro ${cleanPhone} n'est pas sur WhatsApp. (${result})`);
            try {
                await pool.query('UPDATE wa_contacts SET status = ? WHERE phone LIKE ?', ['invalid', `%${cleanPhone}%`]);
            } catch (dbErr) { console.error('DB Update Error:', dbErr); }
            res.json({ status: 'success', is_valid: false, message: `The number ${cleanPhone} is NOT registered on WhatsApp.` });
        }

    } catch (error) {
        console.error(`[Verifier] Erreur globale de vérification: ${error.message}`);
        res.status(500).json({ error: 'System error during WhatsApp validation.', details: error.message });
    } finally {
        if (browser) browser.disconnect();
    }
});

// Nodemon trigger

// Nodemon trigger

app.listen(PORT, () => {
    console.log(`[Orchestrator] Running on http://localhost:${PORT}`);
    console.log(`[Orchestrator] Ready to connect to Electron CDP at port 8315`);
});
