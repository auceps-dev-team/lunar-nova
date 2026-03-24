const express = require('express');
const puppeteer = require('puppeteer-core');
const db = require('./db');
const aiController = require('./aiController');
const { GoogleGenAI } = require('@google/genai');

const sseClients = new Map();
const activeObservers = new Set();
const browserConnections = new Map();

// Keyword Dictionary (FR, EN, Nouchi)
const KEYWORDS = [
    'commander', 'commande', 'je veux', 'acheter', 'prix', 'tarif', 'combien',
    'livraison', 'disponible', 'dispo', 'stock', 'quantité', 'quantite', 'payer',
    'order', 'buy', 'purchase', 'price', 'available', 'how much', 'delivery',
    'shipping', 'quantity', 'pay',
    'combien ça', 'ça coûte', 'ca coute', 'envoyer', 'je prends'
];

function quickKeywordCheck(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return KEYWORDS.some(kw => lower.includes(kw));
}

async function classifyWithGemini(text, contactName) {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `Analyze this WhatsApp message from "${contactName}".
        Message: "${text}"
        
        Is this an order, a product inquiry, or a price request?
        Return EXACTLY this JSON structure, nothing else:
        {
          "is_order": true or false,
          "confidence": number (0.0 to 1.0),
          "order_type": "product_inquiry" | "price_request" | "purchase_intent" | "delivery_question" | "not_an_order",
          "summary": "Short abstract of what they want in French"
        }`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        return JSON.parse(response.text);
    } catch (e) {
        console.error('[IOL] Gemini classification error:', e.message);
        return { is_order: false, confidence: 0 };
    }
}

async function logOrderToDb(instanceId, contact, text, classif) {
    try {
        const res = await db.pool.query(
            `INSERT INTO detected_orders (instance_id, contact_name, message_text, order_type, confidence, summary)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [instanceId, contact, text, classif.order_type, classif.confidence, classif.summary]
        );
        return res.rows[0];
    } catch (e) {
        console.error('[IOL] DB Log error:', e.message);
    }
}

async function transferToAgent(contact, text) {
    try {
        const response = await aiController.chatWithAgent('copywriter', `Contact ${contact} just sent an order inquiry: "${text}". Generate a short, polite, and persuasive commercial response in French.`);
        return response.response;
    } catch (e) {
        console.error('[IOL] Agent transfer error:', e.message);
        return null;
    }
}

function pushEvent(instanceId, orderEvent) {
    const clients = sseClients.get(instanceId) || [];
    clients.forEach(res => {
        // SSE formatting requires data: JSON \n\n
        res.write(`data: ${JSON.stringify(orderEvent)}\n\n`);
    });
}

async function processMessage(instanceId, contact, text) {
    if (!quickKeywordCheck(text)) return;
    
    const classif = await classifyWithGemini(text, contact);
    if (!classif.is_order || classif.confidence < 0.5) return;
    
    const [dbLog, agentReply] = await Promise.all([
        logOrderToDb(instanceId, contact, text, classif),
        transferToAgent(contact, text)
    ]);
    
    const orderEvent = {
        type: 'order_detected',
        instanceId,
        contactName: contact,
        messageText: text,
        classification: classif,
        agentReply,
        timestamp: new Date().toISOString()
    };
    
    pushEvent(instanceId, orderEvent);
}

async function attachObserver(instanceId) {
    if (activeObservers.has(instanceId)) return;
    
    const cdpUrl = `http://localhost:8315`;
    const browser = await puppeteer.connect({ browserURL: cdpUrl, defaultViewport: null });
    
    const targets = await browser.targets();
    let targetPage = null;

    for (const target of targets) {
        if (target.type() === 'webview' && target.url().includes('whatsapp')) {
            const p = await target.page();
            if (p) {
                try {
                    const id = await p.evaluate(() => window.__whatsapp_instance_id);
                    if (id === instanceId) {
                        targetPage = p;
                        break;
                    }
                } catch(e) {}
                if (!targetPage) targetPage = p;
            }
        }
    }

    if (!targetPage) {
        browser.disconnect();
        throw new Error('WhatsApp instance not found');
    }

    browserConnections.set(instanceId, browser);
    
    // Inject observer bridge
    await targetPage.exposeFunction('onNewWaMessage', (contact, text) => {
        processMessage(instanceId, contact, text);
    });

    await targetPage.evaluate(() => {
        if (window.__iol_observer) return;
        
        window.__iol_observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    
                    // Find any message rows inside the added node, or check if the node itself is one
                    const messageNodes = Array.from(node.querySelectorAll ? node.querySelectorAll('div.message-in, div.message-out, [data-id*="false_"], [data-id*="true_"]') : []);
                    if (node.classList?.contains('message-in') || node.classList?.contains('message-out') || (node.getAttribute && (node.getAttribute('data-id')?.includes('false_') || node.getAttribute('data-id')?.includes('true_')))) {
                        messageNodes.push(node);
                    }
                    
                    for (const msgNode of messageNodes) {
                        const textEl = msgNode.querySelector('.copyable-text .selectable-text, .selectable-text.copyable-text');
                        let text = textEl ? textEl.innerText : '';
                        if (!text && msgNode.innerText) {
                            text = msgNode.innerText.split('\n')[0]; // fallback
                        }
                        
                        const contactEl = msgNode.closest('[role="row"]')?.querySelector('span[dir="auto"]');
                        const contact = contactEl ? contactEl.innerText : 'Client (Test)';
                        
                        if (text && text.trim().length > 0) {
                            window.onNewWaMessage(contact, text.trim());
                        }
                    }
                }
            }
        });
        
        const chatWindow = document.querySelector('#main') || document.body;
        window.__iol_observer.observe(chatWindow, { childList: true, subtree: true });
    });
    
    activeObservers.add(instanceId);
    
    targetPage.once('close', () => {
        activeObservers.delete(instanceId);
        browserConnections.delete(instanceId);
    });
}

async function detachObserver(instanceId) {
    if (!activeObservers.has(instanceId)) return;
    const browser = browserConnections.get(instanceId);
    if (browser) {
        try {
            const pages = await browser.pages();
            for (const p of pages) {
                if (p.url().includes('whatsapp')) {
                    await p.evaluate(() => {
                        if (window.__iol_observer) {
                            window.__iol_observer.disconnect();
                            window.__iol_observer = null;
                        }
                    });
                }
            }
        } catch (e) {}
        browser.disconnect();
    }
    activeObservers.delete(instanceId);
    browserConnections.delete(instanceId);
}

function registerRoutes(app) {
    app.post('/api/orders/listen/start', async (req, res) => {
        const { instance_id } = req.body;
        if (!instance_id) return res.status(400).json({ error: 'Missing instance_id' });
        
        try {
            await attachObserver(instance_id);
            res.json({ status: 'success', message: 'Listening for orders on ' + instance_id });
        } catch (e) {
            console.error('[IOL] Start error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/orders/listen/stop', async (req, res) => {
        const { instance_id } = req.body;
        if (!instance_id) return res.status(400).json({ error: 'Missing instance_id' });
        
        await detachObserver(instance_id);
        res.json({ status: 'success' });
    });

    app.get('/api/orders/stream/:instance_id', (req, res) => {
        const id = req.params.instance_id;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        if (!sseClients.has(id)) sseClients.set(id, []);
        sseClients.get(id).push(res);

        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30000);

        req.on('close', () => {
            clearInterval(heartbeat);
            const clients = sseClients.get(id) || [];
            sseClients.set(id, clients.filter(c => c !== res));
        });
    });

    app.get('/api/orders/listen/status', (req, res) => {
        res.json({ status: 'success', active_listeners: Array.from(activeObservers) });
    });
    
    app.get('/api/orders', async (req, res) => {
        try {
            const { instance_id, limit = 50 } = req.query;
            let result;
            if (instance_id) {
                result = await db.pool.query('SELECT * FROM detected_orders WHERE instance_id = $1 ORDER BY detected_at DESC LIMIT $2', [instance_id, limit]);
            } else {
                result = await db.pool.query('SELECT * FROM detected_orders ORDER BY detected_at DESC LIMIT $1', [limit]);
            }
            res.json({ status: 'success', data: result.rows });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}

module.exports = { registerRoutes };
