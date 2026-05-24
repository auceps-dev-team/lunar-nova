const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const puppeteer = require('puppeteer-core');
const crypto = require('crypto');
const fs = require('fs');
const { z } = require('zod');
const path = require('path');
const aiController = require('./aiController');
const { logCopilotInteraction, pool, getSetting, setSetting } = require('./db');
const { getCachedProposals, setCachedProposals } = require('./redisClient');

const app = express();
const PORT = process.env.PORT || process.env.BACKEND_PORT || 3000;

// Update process.env if main process sends new secrets (electron-store)
function handleMessage(msg) {
    if (msg && msg.type === 'UPDATE_ENV' && msg.key) {
        process.env[msg.key] = msg.value;
        console.log(`[Backend] Updated environment variable: ${msg.key}`);
    }
}
process.on('message', handleMessage);
if (process.parentPort) {
    process.parentPort.on('message', (e) => handleMessage(e.data));
}

// Security: Restrict CORS to specific origins
const isDev = process.env.NODE_ENV === 'development';
const allowedOrigins = ['http://localhost:5173', 'file://'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || isDev) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- Google Auth Loopback ---
const authGoogleRouter = require('./routes/authGoogle');
app.use('/api/auth/google', authGoogleRouter);

// --- Prospection (Google Maps API) ---
const prospectionRouter = require('./routes/prospection');
app.use('/api/prospection', prospectionRouter);

// --- WordPress Bridge (Phase 30) ---
const wordpressRouter = require('./routes/wordpress');
const multer = require('multer');
const multerMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
// Apply multer only on the media upload route (all other wp routes use JSON)
app.use('/api/wp', (req, res, next) => {
    if (req.path.endsWith('/media/upload') && req.method === 'POST') {
        return multerMemory.single('file')(req, res, next);
    }
    next();
});
app.use('/api/wp', wordpressRouter);

// API route to get config for frontend
app.get('/api/config', (req, res) => {
    res.json({
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
});

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
                            if (document.body) {
                                observer.observe(document.body, { childList: true, subtree: true });
                            } else {
                                console.log('[Orchestrator] document.body not available for observation');
                            }
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

// --- Phase 26: AI Writer Document APIs ---
app.get('/api/documents', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ai_documents ORDER BY updated_at DESC, id DESC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/documents/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ai_documents WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/documents/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM ai_documents WHERE id = $1', [req.params.id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/documents', async (req, res) => {
    const { title, content } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO ai_documents (title, content) VALUES ($1, $2) RETURNING *',
            [title || 'Untitled Document', content || '']
        );
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/documents/:id', async (req, res) => {
    const { title, content } = req.body;
    try {
        const result = await pool.query(
            'UPDATE ai_documents SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [title, content, req.params.id]
        );
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
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

app.get('/api/settings/quota', async (req, res) => {
    try {
        const key = await getSetting('gemini_api_key', '');
        const count = parseInt(await getSetting('gemini_image_count', '0')) || 0;
        const resetDate = await getSetting('gemini_quota_reset_date', '');
        
        res.json({
            status: 'success',
            data: {
                hasCustomKey: key !== '',
                imageUsed: count,
                imageLimit: 40,
                resetDate: resetDate
            }
        });
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
    const { id, name, system_instruction, response_format, provider_override, model_override } = req.body;
    try {
        const agentId = id || `agent_${Date.now()}`;
        await pool.query(
            'INSERT INTO ai_agents (id, name, system_instruction, response_format, provider_override, model_override) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT(id) DO UPDATE SET name = $2, system_instruction = $3, response_format = $4, provider_override = $5, model_override = $6',
            [agentId, name, system_instruction, response_format || 'text', provider_override || null, model_override || null]
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

// Rate Limiter for AI endpoints
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

app.get('/api/ai/models', aiLimiter, async (req, res) => {
    try {
        const provider = req.query.provider;
        const apiKey = req.query.apiKey;
        const models = await aiController.listModels(provider, apiKey);
        res.json({ status: 'success', models });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint to test model / API key connection (Soft Validation)
app.post('/api/test-model', aiLimiter, async (req, res) => {
    const { provider, apiKey, model } = req.body;
    try {
        const models = await aiController.listModels(provider, apiKey);
        if (models && (Array.isArray(models) ? models.length > 0 : (models.chat && models.chat.length > 0))) {
            res.json({ status: 'success', message: 'API connection successful' });
        } else {
            res.json({ status: 'warning', message: 'API connection successful but no models returned' });
        }
    } catch (err) {
        // Soft validation: return warning instead of 500 error
        res.json({ status: 'warning', message: 'API connection failed: ' + err.message });
    }
});

// Debug: return nvidia model definition (hot-loaded)
app.get('/api/debug/nvidia-model', aiLimiter, async (req, res) => {
    try {
        const id = req.query.id;
        try { delete require.cache[require.resolve('./nvidiaModels')]; } catch (e) {}
        const nm = require('./nvidiaModels');
        const def = nm.getModelDef(id);
        res.json({ status: 'success', model: def });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

// Endpoint to fetch Copilot Generative Replies
app.post('/api/ai/copilot', aiLimiter, async (req, res) => {
    // Requires instance_id for DB logging in a multi-tenant environment.
    // Usually passed as part of the request. Let's assume frontend passes it.
    const { instance_id, chatContext, model, provider } = req.body;

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
        const proposalsObj = await aiController.generateProposals(chatContext, model, provider);
        const proposals = proposalsObj.proposed_replies || [];
        
        // Obtenir le provider depuis la réponse ou utiliser les valeurs par défaut
        const usedProvider = proposalsObj.provider || provider || 'gemini';
        const usedModel = proposalsObj.model || model || 'gemini-1.5-pro';
        const tokens = proposalsObj.tokens || 0;
        const cost = proposalsObj.cost || 0.0;
        const status = proposalsObj.status || 'success';

        // Cache for 60 seconds
        await setCachedProposals(cacheKey, proposals, 60);

        // Feature: Audit Logging
        // Asynchronously log the transaction for analytics and security
        logCopilotInteraction(
            instance_id || 'unknown_instance',
            chatContext.contactName,
            chatContext,
            proposals,
            usedProvider,
            usedModel,
            tokens,
            cost,
            status
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

// Schema de validation Zod pour l'agent
const agentSchema = z.object({
    persona: z.string().nullish(),
    message: z.string().nullish(),
    messages: z.array(z.any()).nullish(),
    imageParams: z.object({
        data: z.string(),
        mimeType: z.string()
    }).nullish(),
    attachments: z.array(z.object({
        data: z.string(),
        mimeType: z.string(),
        fileName: z.string().optional()
    })).nullish(),
    promptFormat: z.string().nullish(),
    currentTasks: z.array(z.any()).nullish(),
    isRealTime: z.boolean().nullish(),
    modelOverride: z.string().nullish(),
    provider: z.string().nullish(),
    model: z.string().nullish()
}).refine(data => data.message || (data.messages && data.messages.length > 0), {
    message: "Missing message.",
});

// Endpoint for specialized Persona AI Agents (Legal, Creative)
app.post('/api/ai/agent', aiLimiter, async (req, res) => {
    try {
        // Validation des inputs avec Zod
        const validatedData = agentSchema.parse(req.body);
        const { persona, message, messages, imageParams, attachments, promptFormat, currentTasks, isRealTime, modelOverride, provider, model } = validatedData;

        // Use provider and model from frontend as overrides
        const finalProvider = provider || null;
        const finalModel = modelOverride || model || null;

        const aiResponse = await aiController.chatWithAgent(persona, message, imageParams, attachments, promptFormat, messages, currentTasks, isRealTime, finalModel, finalProvider);
        res.json({
            status: 'success',
            response: aiResponse.response
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        console.error('Agent Route Error:', error);
        res.status(500).json({ error: 'Failed to chat with agent.' });
    }
});

// Endpoint to generate an image (Gemini, NVIDIA NIM, etc.)
app.post('/api/ai/generate-image', aiLimiter, async (req, res) => {
    const { prompt, aspectRatio, imageParams, editMode, mode, provider, imageModel } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt.' });
    }

    try {
        const generationResponse = await aiController.generateImage(prompt, aspectRatio, imageParams, editMode, mode, provider || null, imageModel || null);
        if (generationResponse.error) {
            // Retourner 200 avec status 'error' pour que le frontend puisse afficher le message
            return res.json({ status: 'error', error: generationResponse.error });
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

// Explicit Qwen-Image alias route for direct text-to-image generation
app.post('/api/ai/generate-image-qwen', aiLimiter, async (req, res) => {
    const { prompt, size, seed, provider } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt.' });
    }

    try {
        const generationResponse = await aiController.generateImage(prompt, null, { seed }, null, null, provider || null, 'qwen/qwen-image');
        if (generationResponse.error) {
            return res.json({ status: 'error', error: generationResponse.error });
        }
        res.json({ status: 'success', imageStore: generationResponse.imageBytes });
    } catch (error) {
        console.error('Qwen Image Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate Qwen image via API.' });
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
        const os = require('os');
        const tempDir = process.env.USER_DATA_PATH ? path.join(process.env.USER_DATA_PATH, '.temp') : path.join(os.tmpdir(), 'wacopilote_temp');
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
        return res.status(500).json({ error: 'Failed writing file.' });
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
                try {
                    await targetPage.waitForSelector(storefrontSelectors, { timeout: 6000 });
                } catch (e) {
                    throw new Error("Veuillez ouvrir la page d'accueil de WhatsApp ou le menu de votre Catalogue avant de publier.");
                }

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
                    throw new Error("Impossible de trouver le bouton 'Ajouter un article'. Essayez d'ouvrir la page du catalogue manuellement.");
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

app.post('/api/wa/contact-lists', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('INSERT INTO wa_contact_lists (name) VALUES ($1) RETURNING *', [name]);
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/wa/contact-lists/:id', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('UPDATE wa_contact_lists SET name = $1 WHERE id = $2 RETURNING *', [name, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'List not found' });
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/wa/contact-lists/:id', async (req, res) => {
    try {
        await pool.query('UPDATE wa_contacts SET list_id = NULL WHERE list_id = $1', [req.params.id]);
        await pool.query('DELETE FROM wa_contact_lists WHERE id = $1', [req.params.id]);
        res.json({ status: 'success', message: 'List deleted' });
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

app.put('/api/wa/segments/:id', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('UPDATE wa_segments SET name = $1 WHERE id = $2 RETURNING *', [name, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Segment not found' });
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/wa/segments/:id', async (req, res) => {
    try {
        await pool.query('UPDATE wa_contacts SET segment_id = NULL WHERE segment_id = $1', [req.params.id]);
        await pool.query('DELETE FROM wa_segments WHERE id = $1', [req.params.id]);
        res.json({ status: 'success', message: 'Segment deleted' });
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
            const { name, phone, segment_name, email, address, list_id, segment_id: explicit_segment_id } = contact;
            let segment_id = explicit_segment_id || null;

            // Simple Auto-Resolution: if a segment is typed (and no explicit segment_id), find or create it
            if (segment_name && !segment_id) {
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
                'INSERT INTO wa_contacts (name, phone, segment_id, list_id, email, address) VALUES ($1, $2, $3, $4, $5, $6)',
                [name || 'Inconnu', phone, segment_id, list_id || null, email || null, address || null]
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

            // Phase 19.5: Message Tracking
            try {
                await pool.query(
                    'INSERT INTO wa_message_logs (contact_id, message) VALUES ($1, $2)',
                    [contact_id, formattedMessage || 'Direct link manually opened']
                );
            } catch (logErr) {
                console.error('[WA] Silently caught error logging message:', logErr);
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
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const verifyUrl = `https://web.whatsapp.com/send/?phone=${cleanPhone}`;

        // First, dismiss any lingering OK modal from a previous contact check
        try {
            await targetPage.evaluate(() => {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const t = (btn.innerText || btn.textContent || '').trim().toUpperCase();
                    if (t === 'OK') { btn.click(); break; }
                }
            });
            await new Promise(r => setTimeout(r, 300));
        } catch (_) { }

        await targetPage.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

        console.log(`[Verifier] Racing chatbox vs error modal...`);

        let result = 'TIMEOUT';
        const deadline = Date.now() + 18000; // 18s max

        while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 600));
            try {
                const state = await targetPage.evaluate(() => {
                    // Valid chat: conversation panel visible
                    if (document.querySelector('#main header, #main footer, [data-testid="conversation-panel-wrapper"], div[title="Type a message"], div[title="Tapez un message"]')) {
                        return 'VALIDE';
                    }
                    // Error modal
                    const modalBody = document.querySelector('[data-animate-modal-body="true"]');
                    if (modalBody) {
                        const text = (modalBody.innerText || modalBody.textContent || '').toLowerCase();
                        if (text.includes("n'est pas sur whatsapp") || text.includes("is not on whatsapp") || text.includes("invalide") || text.includes("phone number")) {
                            // Dismiss modal
                            const buttons = document.querySelectorAll('button');
                            for (const btn of buttons) {
                                const t = (btn.innerText || btn.textContent || '').trim().toUpperCase();
                                if (t === 'OK') { btn.click(); break; }
                            }
                            return 'INVALIDE';
                        }
                    }
                    return 'PENDING';
                });
                if (state === 'VALIDE' || state === 'INVALIDE') {
                    result = state;
                    break;
                }
            } catch (evalErr) {
                // Execution context destroyed (page navigating) — wait and retry
                console.warn('[Verifier] Context destroyed, waiting...');
                await new Promise(r => setTimeout(r, 800));
            }
        }

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

// --- Phase 19.5: Contact Analytics Endpoint ---
app.get('/api/wa/analytics', async (req, res) => {
    try {
        const totalRes = await pool.query('SELECT COUNT(*) as count FROM wa_contacts');
        const segmentRes = await pool.query(`
            SELECT s.name, COUNT(c.id) as count 
            FROM wa_segments s 
            LEFT JOIN wa_contacts c ON s.id = c.segment_id 
            GROUP BY s.id, s.name
        `);
        const listRes = await pool.query(`
            SELECT l.name, COUNT(c.id) as count 
            FROM wa_contact_lists l 
            LEFT JOIN wa_contacts c ON l.id = c.list_id 
            GROUP BY l.id, l.name
        `);
        const statusRes = await pool.query(`
            SELECT status, COUNT(id) as count 
            FROM wa_contacts 
            GROUP BY status
        `);
        const messagesRes = await pool.query('SELECT COUNT(*) as count FROM wa_message_logs');

        // AI Consumption Statistics
        const aiProviderRes = await pool.query('SELECT provider, COUNT(id) as count FROM copilot_logs GROUP BY provider');
        const aiModelRes = await pool.query('SELECT model, COUNT(id) as count FROM copilot_logs GROUP BY model');
        const aiRecentRes = await pool.query("SELECT date(created_at) as date, COUNT(id) as count FROM copilot_logs WHERE created_at >= date('now', '-7 days') GROUP BY date(created_at) ORDER BY date(created_at) ASC");

        res.json({
            status: 'success',
            data: {
                totalContacts: parseInt(totalRes.rows[0]?.count || 0, 10),
                bySegment: segmentRes.rows.map(r => ({ name: r.name, count: parseInt(r.count, 10) })),
                byList: listRes.rows.map(r => ({ name: r.name, count: parseInt(r.count, 10) })),
                byStatus: statusRes.rows.map(r => ({ name: r.status, count: parseInt(r.count, 10) })),
                totalMessagesSent: parseInt(messagesRes.rows[0]?.count || 0, 10),
                aiByProvider: aiProviderRes.rows.map(r => ({ name: r.provider || 'unknown', count: parseInt(r.count, 10) })),
                aiByModel: aiModelRes.rows.map(r => ({ name: r.model || 'unknown', count: parseInt(r.count, 10) })),
                aiRecentActivity: aiRecentRes.rows.map(r => ({ date: r.date, count: parseInt(r.count, 10) }))
            }
        });
    } catch (err) {
        console.error('[WA] Error fetching analytics:', err);
        res.status(500).json({ error: err.message });
    }
});

const server = app.listen(PORT, () => {
    console.log(`[Orchestrator] Running on http://localhost:${PORT}`);
    console.log(`[Orchestrator] Ready to connect to Electron CDP at port 8315`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`[CRITICAL] Port ${PORT} is already in use. Exiting to prevent zombie processes.`);
        process.exit(1);
    } else {
        console.error(`[CRITICAL] Server error:`, e);
        process.exit(1);
    }
});
