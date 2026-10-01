const express = require('express');
const rateLimit = require('express-rate-limit');
const puppeteer = require('puppeteer-core');

/**
 * Routes « système » — autrefois déclarées en ligne dans server.js (constat R7
 * de l'audit du 29/09/2026), déplacées ici sans changement de comportement.
 * Monté sur /api : les chemins restent /api/config, /api/instances et
 * /api/context/:instance_id.
 *
 * Équivalence vérifiée le 1er octobre 2026 sur un serveur isolé : mêmes codes,
 * mêmes corps et mêmes en-têtes de limitation qu'avant le déplacement, avec et
 * sans jeton.
 */
const router = express.Router();

const configLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests' }
});

// API route to get config for frontend
router.get('/config', configLimiter, (req, res) => {
    res.json({
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
});

// API route to get WhatsApp instances status
router.get('/instances', async (req, res) => {
    let browser = null;
    try {
        // To avoid Protocol error (Browser.getVersion), we MUST connect to the browser root, not a specific page target
        // L'appel sert de contrôle de disponibilité du point CDP : la réponse
        // elle-même n'est pas exploitée, seul son aboutissement compte.
        const fetch = (await import('node-fetch')).default;
        await fetch('http://127.0.0.1:8315/json/version');

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

                            console.error('[Orchestrator] Attached DOM Observer for new messages');
                            const observer = new MutationObserver((mutations) => {
                                mutations.forEach((mutation) => {
                                    if (mutation.addedNodes.length) {
                                        mutation.addedNodes.forEach((node) => {
                                            if (node.nodeType === Node.ELEMENT_NODE && node.outerHTML.includes('message-in')) {
                                                console.error('[Orchestrator Event] New incoming message detected!');
                                            }
                                        });
                                    }
                                });
                            });
                            if (document.body) {
                                observer.observe(document.body, { childList: true, subtree: true });
                            } else {
                                console.error('[Orchestrator] document.body not available for observation');
                            }
                        }).catch(err => {
                            if (err && err.message && !err.message.includes('Execution context was destroyed')) {
                                console.error('Failed to attach observer:', err);
                            }
                        });
                    } catch (err) {
                        if (err && err.message && !err.message.includes('Execution context was destroyed')) {
                            console.error('Error attaching observer to page:', err);
                        }
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
router.get('/context/:instance_id', async (req, res) => {
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
                } catch { }
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

module.exports = router;
