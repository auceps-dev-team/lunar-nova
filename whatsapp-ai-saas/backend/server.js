const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const crypto = require('crypto');
const { generateProposals, chatWithAgent } = require('./geminiService');
const { logCopilotInteraction } = require('./db');
const { getCachedProposals, setCachedProposals } = require('./redisClient');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// API route to get WhatsApp instances status
app.get('/api/instances', async (req, res) => {
    try {
        // Fetch all targets to specifically find isolated webviews
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('http://127.0.0.1:8315/json');
        const targets = await response.json();

        const whatsappTargets = targets.filter(t => t.url.includes('web.whatsapp.com'));

        for (const target of whatsappTargets) {
            try {
                // Connect directly to the specific webview target
                const browser = await chromium.connectOverCDP(target.webSocketDebuggerUrl);
                const page = browser.contexts()[0].pages()[0];

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

                await browser.close();
            } catch (err) {
                console.error('Error connecting to target CDP:', err);
            }
        }

        res.json({
            status: 'success',
            active_instances: whatsappTargets.length,
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

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('http://127.0.0.1:8315/json');
        const targets = await response.json();

        // Find the specific webview
        const whatsappTarget = targets.find(t => t.url.includes('web.whatsapp.com'));

        if (!whatsappTarget) {
            return res.status(404).json({ error: 'WhatsApp instance not found.' });
        }

        const browser = await chromium.connectOverCDP(whatsappTarget.webSocketDebuggerUrl);
        const targetPage = browser.contexts()[0].pages()[0];

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
        console.error('Context Extraction Error:', error);
        res.status(500).json({ error: 'Failed to extract chat context safely.' });
    }
});

// Endpoint to fetch Copilot Generative Replies
app.post('/api/gemini/copilot', async (req, res) => {
    // Requires instance_id for DB logging in a multi-tenant environment. 
    // Usually passed as part of the request. Let's assume frontend passes it.
    const { instance_id, chatContext } = req.body;

    if (!chatContext) {
        return res.status(400).json({ error: 'Missing chat context.' });
    }

    try {
        // Feature: Redis Session Caching
        // Create an MD5 hash of the last 3 messages to use as a cache key.
        // This prevents excessive API billing if user spams the button without new messages.
        const contextFingerprint = chatContext.contactName + '_' +
            chatContext.messages.slice(-3).map(m => m.text).join('|');

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
        const proposalsObj = await generateProposals(chatContext);
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
    const { persona, message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Missing message.' });
    }

    try {
        const aiResponse = await chatWithAgent(persona, message);
        res.json({
            status: 'success',
            response: aiResponse.response
        });
    } catch (error) {
        console.error('Agent Route Error:', error);
        res.status(500).json({ error: 'Failed to chat with agent.' });
    }
});

app.listen(PORT, () => {
    console.log(`[Orchestrator] Running on http://localhost:${PORT}`);
    console.log(`[Orchestrator] Ready to connect to Electron CDP at port 8315`);
});
