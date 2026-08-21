const puppeteer = require('puppeteer-core');
const db = require('./db');
const aiController = require('./aiController');
const { redactMessage, redactContact } = require('./logRedact');

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

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Phase 22: Log & Emit EVERY message
    console.log(`\n------------------------------------------------------\n[IOL Flux] 📩 Nouveau message de [${redactContact(contact)}] : ${redactMessage(text)}`);
    
    const messageEvent = {
        id: msgId,
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
    
    console.log(`[IOL Pipeline] ✅ [${redactContact(contact)}] Potentielle commande détectée. Analyse IA en cours...`);
    const orderRadarModel = await db.getSetting('order_radar_model', '');
    const classif = await aiController.classifyOrderIntent(text, contact, orderRadarModel || null);

    if (!classif || !classif.is_order || classif.confidence < 0.5) {
        console.log(`[IOL Pipeline] ❌ Rejeté par l'IA (Pas une commande ou confiance trop faible).`);
        return;
    }
    
    console.log(`[IOL Pipeline] 🎯 INTENTION CONFIRMÉE : ${classif.order_type} (Confiance: ${Math.round(classif.confidence*100)}%)`);
    // Le résumé est produit par l'IA à partir du message : il en reprend le contenu.
    console.log(`[IOL Pipeline] 📝 Résumé : ${redactMessage(classif.summary)}`);
    console.log(`[IOL Pipeline] 🚀 Signature en base de données...`);
    
    // L'enregistrement en base n'a pas de valeur de retour exploitable ; seul
    // compte qu'il se termine avant l'émission de l'événement.
    const [, agentReply] = await Promise.all([
        logOrderToDb(instanceId, contact, text, classif),
        transferToAgent(contact, text)
    ]);
    
    const orderEvent = {
        id: msgId, // Reuse same ID for linked events
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

// Logic to Save Order to DB
async function logOrderToDb(instanceId, contact, text, classif) {
    try {
        const query = `
            INSERT INTO detected_orders (instance_id, contact_name, message_text, order_type, confidence, summary)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        const values = [instanceId, contact, text, classif.order_type, classif.confidence, classif.summary];
        await db.pool.query(query, values);
    } catch (e) {
        console.error('[IOL DB] Save Error:', e.message);
    }
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
                } catch {}
                targetPages.push(p);
            }
        }
    }

    if (targetPages.length === 0) {
        // Erreur levée et non plus retour silencieux : la route
        // /api/orders/listen/start répondait « success » alors qu'aucun
        // écouteur n'était branché — l'interface affichait « écoute active »
        // pendant que rien n'était observé.
        browser.disconnect();
        throw new Error(
            `Aucune page WhatsApp trouvée pour l'instance ${instanceId}. ` +
            'Vérifiez que l\'instance est connectée (QR code scanné) avant de démarrer l\'écoute.'
        );
    }

    browserConnections.set(instanceId, browser);

    for (const targetPage of targetPages) {
        // Wait for WhatsApp to be fully loaded
        try {
            await targetPage.waitForSelector('#pane-side', { timeout: 15000 });
            console.log(`[IOL] ✅ WhatsApp UI loaded. Ready to inject observer.`);
        } catch {
            console.log(`[IOL] ⚠️ Timeout waiting for WhatsApp UI, attempting to inject anyway...`);
        }

        // Inject observer bridge safely (catch if already exposed after server restart)
        try {
            await targetPage.exposeFunction('onNewWaMessage', (contact, text) => {
                console.log(`\n======================================================\n[IOL DOM Bridge] 📥 Message reçu de l'interface : [${redactContact(contact)}] ${redactMessage(text)}`);
                processMessage(instanceId, contact, text);
            });
        } catch {}
        
        try {
            await targetPage.exposeFunction('onIolDebug', (msg) => {
                console.log(`[IOL Background] ${msg}`);
            });
        } catch {}

        await targetPage.evaluate(() => {
            if (!document.body || window.__iol_observer) return;
            
            window.onIolDebug('🚀 Order Observer attaché (V3: Strict Structural Scraping) !');

            // Déduplication des messages déjà traités.
            //
            // C'était un Set sans borne, alimenté toutes les 3 secondes par le
            // poller : sur une session WhatsApp laissée ouverte plusieurs jours,
            // il grossissait indéfiniment dans l'onglet. La fenêtre glissante
            // conserve les N dernières empreintes, ce qui suffit largement à
            // éviter les doublons — un message identique réapparaissant après
            // des milliers d'autres est de toute façon un nouvel événement.
            if (!window.__iol_seen) {
                const MAX_SEEN = 500;
                const order = [];
                const set = new Set();
                window.__iol_seen = {
                    has: (k) => set.has(k),
                    add: (k) => {
                        if (set.has(k)) return;
                        set.add(k);
                        order.push(k);
                        if (order.length > MAX_SEEN) set.delete(order.shift());
                    }
                };
            }
            
            // 1. Polling for Left Panel (Global incoming messages across all chats!)
            if (!window.__iol_poller) {
                window.__iol_poller = setInterval(() => {
                    // WhatsApp's atomic CSS classes (x78zum5, x6s0dn4, ...) are regenerated on every
                    // redesign, but the data-testid anchors it ships for its own QA are stable across
                    // rebuilds, so prefer those; fall back to the older generic-attribute scraping only
                    // if the testids are absent (older client build).
                    let recentChats = Array.from(document.querySelectorAll('[data-testid="cell-frame-container"]')).slice(0, 15);
                    if (recentChats.length === 0) {
                        const contactNodes = document.querySelectorAll('#pane-side span[title][dir="auto"]');
                        recentChats = Array.from(contactNodes).slice(0, 15).map(node => node.closest('div[role="row"], div[role="listitem"], div[style*="transform"]'));
                    }

                    for (const chatItem of recentChats) {
                        if (!chatItem) continue;

                        let contact = 'Client (Liste)';
                        const nameNode = chatItem.querySelector('[data-testid="cell-frame-title"] span[title][dir="auto"]') || chatItem.querySelector('span[title][dir="auto"]');
                        if (nameNode) contact = nameNode.getAttribute('title') || nameNode.innerText;

                        // Try to get message preview, scoped to the preview area when available to avoid
                        // picking up unrelated dir="ltr" spans (e.g. group sender-name prefixes).
                        let text = '';
                        const previewScope = chatItem.querySelector('[data-testid="cell-frame-secondary"]') || chatItem;
                        const spans = previewScope.querySelectorAll('span[dir="ltr"]');
                        for (const node of spans) {
                            const t = node.innerText || node.textContent || '';
                            if (t && t.length > 2 && t !== contact) text = t;
                        }

                        if (text && text.trim().length > 0) {
                            const hash = contact + '|' + text.trim();
                            if (!window.__iol_seen.has(hash)) {
                                window.__iol_seen.add(hash);
                                window.onIolDebug(`[Poller] Nouveau message en liste (${text.length} car.)`);
                                window.onNewWaMessage(contact, text.trim());
                            }
                        }
                    }
                }, 3000);
            }

            // WhatsApp's atomic CSS class names get regenerated on every redesign, so
            // '.copyable-text[data-pre-plain-text]' can silently stop matching anything. The
            // 'data-id' on a message row (prefixed 'true_'/'false_' for outgoing/incoming) is
            // WhatsApp's own internal store key, not a style artifact, so it survives UI overhauls
            // and is used here as the primary anchor; the legacy class-based anchor is kept as a
            // fallback for older client builds.
            const isMessageDataId = (id) => !!id && (id.startsWith('true_') || id.startsWith('false_'));
            const getMsgRoot = (el) => {
                if (!el || !el.closest) return null;
                const legacy = el.closest('.copyable-text[data-pre-plain-text]');
                if (legacy) return legacy;
                const modern = el.closest('[data-id]');
                if (modern && isMessageDataId(modern.getAttribute('data-id'))) return modern;
                // Last resort: the chat list in this build uses role="row" grid items and the message
                // list likely shares the same virtualization pattern; excluding #pane-side keeps this
                // from double-processing sidebar rows already covered by the poller above.
                const ariaRow = el.closest('div[role="row"]');
                if (ariaRow && !ariaRow.closest('#pane-side')) return ariaRow;
                return null;
            };

            // 2. Specialized Mutation Observer for Active Chat
            window.__iol_observer = new MutationObserver((mutations) => {
                const processMessageNode = (msg) => {
                    if (!msg) return;
                    try {
                        const preTextNode = msg.hasAttribute('data-pre-plain-text') ? msg : msg.querySelector('[data-pre-plain-text]');
                        const preText = preTextNode ? (preTextNode.getAttribute('data-pre-plain-text') || '') : '';
                        let contact = 'Client (Actif)';
                        const match = preText.match(/\]\s([^:]+):/);
                        if (match && match[1]) {
                            contact = match[1].trim();
                        }

                        const textNode = msg.querySelector('span.selectable-text, span.copyable-text, span[dir="ltr"]');
                        const text = textNode ? (textNode.innerText || textNode.textContent || '').trim() : msg.innerText.trim();

                        if (text && text.length > 5) {
                            const hash = contact + '|' + text;
                            if (!window.__iol_seen.has(hash)) {
                                window.__iol_seen.add(hash);
                                window.onIolDebug(`[Observer] Nouveau message en conversation (${text.length} car.)`);
                                window.onNewWaMessage(contact, text);
                            }
                        }
                    } catch {}
                };

                for (const m of mutations) {
                    if (m.type === 'characterData' && m.target && m.target.parentElement) {
                        const parentMsg = getMsgRoot(m.target.parentElement);
                        if (parentMsg) processMessageNode(parentMsg);
                        continue;
                    }

                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) {
                        if (node.parentElement) {
                            const pMsg = getMsgRoot(node.parentElement);
                            if (pMsg) processMessageNode(pMsg);
                        }
                        continue;
                    }

                    const msgDivs = Array.from(node.querySelectorAll ? node.querySelectorAll('.copyable-text[data-pre-plain-text]') : []);
                    if (node.matches && node.matches('.copyable-text[data-pre-plain-text]')) {
                        msgDivs.push(node);
                    }
                    if (node.querySelectorAll) {
                        Array.from(node.querySelectorAll('[data-id]')).forEach(el => {
                            if (isMessageDataId(el.getAttribute('data-id')) && !msgDivs.includes(el)) msgDivs.push(el);
                        });
                    }
                    if (node.matches) {
                        const id = node.getAttribute && node.getAttribute('data-id');
                        if (isMessageDataId(id) && !msgDivs.includes(node)) msgDivs.push(node);
                    }

                    if (msgDivs.length === 0) {
                        if (node.querySelectorAll) {
                            Array.from(node.querySelectorAll('div[role="row"]')).forEach(el => {
                                if (!el.closest('#pane-side') && !msgDivs.includes(el)) msgDivs.push(el);
                            });
                        }
                        if (node.matches && node.matches('div[role="row"]') && !node.closest('#pane-side') && !msgDivs.includes(node)) {
                            msgDivs.push(node);
                        }
                    }

                    // If the node we're adding is INSIDE an existing message container
                    const parentMsg = getMsgRoot(node);
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
                        // Le poller survivait à l'arrêt de l'écoute : seul
                        // l'observateur était détaché, l'intervalle continuait de
                        // parcourir le panneau toutes les 3 secondes jusqu'à la
                        // fermeture de l'onglet, et un nouveau démarrage n'en
                        // recréait pas (garde `if (!window.__iol_poller)`) mais
                        // laissait l'ancien tourner à vide.
                        if (window.__iol_poller) {
                            clearInterval(window.__iol_poller);
                            window.__iol_poller = null;
                        }
                    });
                }
            }
        } catch {}
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

    // DELETE Routes for IOL (Inside registerRoutes)
    app.delete('/api/orders/bulk-delete', async (req, res) => {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ status: 'error', error: 'Missing IDs array' });

        try {
            const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
            await db.pool.query(`DELETE FROM detected_orders WHERE id IN (${placeholders})`, ids);
            res.json({ status: 'success' });
        } catch (err) {
            res.status(500).json({ status: 'error', error: err.message });
        }
    });

    app.delete('/api/orders/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await db.pool.query(`DELETE FROM detected_orders WHERE id = $1`, [id]);
            res.json({ status: 'success' });
        } catch (err) {
            res.status(500).json({ status: 'error', error: err.message });
        }
    });
}

module.exports = { registerRoutes };
