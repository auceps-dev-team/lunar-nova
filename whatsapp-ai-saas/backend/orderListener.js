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
    if (!text) return;

    // Phase 22: Log & Emit EVERY message
    console.log(`\n------------------------------------------------------\n[IOL Flux] 📩 Nouveau message de [${contact}] : "${text}"`);
    
    const messageEvent = {
        type: 'message_received',
        instanceId,
        contactName: contact,
        messageText: text,
        timestamp: new Date().toISOString()
    };
    pushEvent(instanceId, messageEvent);

    // Continue with Order Detection Pipeline
    if (!quickKeywordCheck(text)) {
        console.log(`[IOL Pipeline] ℹ️ Message ignoré (pas de mot-clé de commande)`);
        return;
    }
    
    console.log(`[IOL Pipeline] ✅ [${contact}] Potentielle commande détectée. Analyse IA en cours...`);
    const classif = await classifyWithGemini(text, contact);
    
    if (!classif || !classif.is_order || classif.confidence < 0.5) {
        console.log(`[IOL Pipeline] ❌ Rejeté par l'IA (Pas une commande ou confiance trop faible).`);
        return;
    }
    
    console.log(`[IOL Pipeline] 🎯 INTENTION CONFIRMÉE : ${classif.order_type} (Confiance: ${Math.round(classif.confidence*100)}%)`);
    console.log(`[IOL Pipeline] 📝 Résumé : ${classif.summary}`);
    console.log(`[IOL Pipeline] 🚀 Signature en base de données...`);
    
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
    let targetPages = [];

    for (const target of targets) {
        if (target.type() === 'webview' && target.url().includes('whatsapp')) {
            const p = await target.page();
            if (p) {
                try {
                    const id = await p.evaluate(() => window.__whatsapp_instance_id);
                    if (id === instanceId) {
                        targetPages = [p];
                        break;
                    }
                } catch(e) {}
                targetPages.push(p);
            }
        }
    }

    if (targetPages.length === 0) {
        console.log(`[IOL] ❌ Could not find WhatsApp page for instance ${instanceId}. Make sure the instance is connected.`);
        browser.disconnect();
        return;
    }

    browserConnections.set(instanceId, browser);

    for (const targetPage of targetPages) {
        // Wait for WhatsApp to be fully loaded
        try {
            await targetPage.waitForSelector('#pane-side', { timeout: 15000 });
            console.log(`[IOL] ✅ WhatsApp UI loaded. Ready to inject observer.`);
        } catch (e) {
            console.log(`[IOL] ⚠️ Timeout waiting for WhatsApp UI, attempting to inject anyway...`);
        }

        // Inject observer bridge safely (catch if already exposed after server restart)
        try {
            await targetPage.exposeFunction('onNewWaMessage', (contact, text) => {
                console.log(`\n======================================================\n[IOL DOM Bridge] 📥 Message Received from UI: [${contact}] "${text}"`);
                processMessage(instanceId, contact, text);
            });
        } catch (e) {}
        
        try {
            await targetPage.exposeFunction('onIolDebug', (msg) => {
                console.log(`[IOL Background] ${msg}`);
            });
        } catch (e) {}

        await targetPage.evaluate(() => {
            if (!document.body || window.__iol_observer) return;
            
            window.onIolDebug('🚀 Order Observer attaché (V3: Strict Structural Scraping) !');
            if (!window.__iol_processed_texts) window.__iol_processed_texts = new Set();
            
            // 1. Polling for Left Panel (Global incoming messages across all chats!)
            if (!window.__iol_poller) {
                window.__iol_poller = setInterval(() => {
                    // Safe search starting from contact names
                    const contactNodes = document.querySelectorAll('#pane-side span[title][dir="auto"]');
                    const recentChats = Array.from(contactNodes).slice(0, 15).map(node => node.closest('div[role="row"], div[role="listitem"], div[style*="transform"]'));
                    
                    for (const chatItem of recentChats) {
                        if (!chatItem) continue;

                        let contact = 'Client (Liste)';
                        const nameNode = chatItem.querySelector('span[title][dir="auto"]');
                        if (nameNode) contact = nameNode.getAttribute('title') || nameNode.innerText;
                        
                        // Try to get message preview
                        let text = '';
                        const spans = chatItem.querySelectorAll('span[dir="ltr"]');
                        for (const node of spans) {
                            const t = node.innerText || node.textContent || '';
                            if (t && t.length > 2 && t !== contact) text = t;
                        }

                        if (text && text.trim().length > 0) {
                            const hash = contact + '|' + text.trim();
                            if (!window.__iol_processed_texts.has(hash)) {
                                window.__iol_processed_texts.add(hash);
                                window.onIolDebug(`[Poller] Nv msg Liste: "${text.substring(0, 30)}..."`);
                                window.onNewWaMessage(contact, text.trim());
                            }
                        }
                    }
                }, 3000);
            }

            // 2. Specialized Mutation Observer for Active Chat
            window.__iol_observer = new MutationObserver((mutations) => {
                const processMessageNode = (msg) => {
                    if (!msg) return;
                    try {
                        const preText = msg.getAttribute('data-pre-plain-text') || '';
                        let contact = 'Client (Actif)';
                        const match = preText.match(/\]\s([^:]+):/);
                        if (match && match[1]) {
                            contact = match[1].trim();
                        }

                        const textNode = msg.querySelector('span.selectable-text, span.copyable-text');
                        const text = textNode ? (textNode.innerText || textNode.textContent || '').trim() : msg.innerText.trim();

                        if (text && text.length > 5) {
                            const hash = contact + '|' + text;
                            if (!window.__iol_processed_texts.has(hash)) {
                                window.__iol_processed_texts.add(hash);
                                window.onIolDebug(`[Observer] Nv msg Actif: "${text.substring(0, 30)}..."`);
                                window.onNewWaMessage(contact, text);
                            }
                        }
                    } catch (err) {}
                };

                for (const m of mutations) {
                    if (m.type === 'characterData' && m.target && m.target.parentElement) {
                        const parentMsg = m.target.parentElement.closest('.copyable-text[data-pre-plain-text]');
                        if (parentMsg) processMessageNode(parentMsg);
                        continue;
                    }

                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) {
                        if (node.parentElement) {
                            const pMsg = node.parentElement.closest('.copyable-text[data-pre-plain-text]');
                            if (pMsg) processMessageNode(pMsg);
                        }
                        continue;
                    }
                    
                    // Specific research-backed selector
                    const msgDivs = Array.from(node.querySelectorAll ? node.querySelectorAll('.copyable-text[data-pre-plain-text]') : []);
                    if (node.matches && node.matches('.copyable-text[data-pre-plain-text]')) {
                        msgDivs.push(node);
                    }
                    
                    // If the node we're adding is INSIDE an existing message container
                    const parentMsg = node.closest && node.closest('.copyable-text[data-pre-plain-text]');
                    if (parentMsg && !msgDivs.includes(parentMsg)) {
                        msgDivs.push(parentMsg);
                    }

                    for (const msg of msgDivs) {
                        processMessageNode(msg);
                    }
                } // Ends addedNodes loop
            } // Ends mutations loop
        });

        // Track both structural additions and text rendering variations
        window.__iol_observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    
    targetPage.once('close', () => {
        activeObservers.delete(instanceId);
        browserConnections.delete(instanceId);
    });
} // End for targetPages

activeObservers.add(instanceId);
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
        
        // CRITICAL: Prevent Node from killing the TCP Keep-Alive after 5s
        req.socket.setTimeout(0);
        req.socket.setNoDelay(true);
        req.socket.setKeepAlive(true);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        if (!sseClients.has(id)) sseClients.set(id, []);
        sseClients.get(id).push(res);

        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);

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
