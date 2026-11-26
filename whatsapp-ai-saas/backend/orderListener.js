const puppeteer = require('puppeteer-core');
const db = require('./db');
const aiController = require('./aiController');
const { redactMessage, redactContact } = require('./logRedact');
const { getSelectorRegistry, inPageSelectors, inPageHealth, CRITICAL_KEYS } = require('./wa/waSelectors');
const { observerInPage } = require('./wa/orderObserverInPage');

const sseClients = new Map();
const activeObservers = new Set();
const browserConnections = new Map();

// File des notes vocales : extraction immédiate, transcription à part, puis
// réinjection dans processMessage. Créée à la demande — les services de
// transcription ne sont chargés que si un vocal arrive réellement.
let voiceQueue = null;
function getVoiceQueue() {
    if (voiceQueue) return voiceQueue;
    const { createVoiceNoteQueue } = require('./services/voiceNoteQueue');
    const voiceNoteService = require('./services/voiceNoteService');
    const transcriptionService = require('./services/transcriptionService');

    voiceQueue = createVoiceNoteQueue({
        isEnabled: async () => (await db.getSetting('voice_notes_transcription', 'off')) === 'on',
        extract: (job) => voiceNoteService.extractVoiceNoteFromPage(job.page, job.messageId),
        transcribe: ({ audio, mimeType }) => transcriptionService.transcribe({ audio, mimeType }),
        onTranscribed: (job, result) =>
            processMessage(job.instanceId, job.contact, result.text, { source: 'voice' })
    });
    return voiceQueue;
}

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
        // Le nom et le texte viennent du client WhatsApp : untrustedInput exclut
        // les agents locaux (Claude Code, Gemini CLI, MCP) qui ont accès au disque.
        const response = await aiController.chatWithAgent(
            'copywriter',
            `Contact ${contact} just sent an order inquiry: "${text}". Generate a short, polite, and persuasive commercial response in French.`,
            null, null, undefined, null, null, false, null, null,
            { untrustedInput: true }
        );
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

/**
 * @param {object} [meta]
 * @param {'text'|'voice'} [meta.source] origine du texte. 'voice' signale une
 *        transcription de note vocale : le pipeline est le même, mais le texte
 *        est une reconstruction, pas ce que le client a tapé.
 */
async function processMessage(instanceId, contact, text, meta = {}) {
    if (!text) return;

    const source = meta.source === 'voice' ? 'voice' : 'text';
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Phase 22: Log & Emit EVERY message
    console.error(`\n------------------------------------------------------\n[IOL Flux] 📩 Nouveau message${source === 'voice' ? ' (vocal transcrit)' : ''} de [${redactContact(contact)}] : ${redactMessage(text)}`);

    const messageEvent = {
        id: msgId,
        type: 'message_received',
        instanceId,
        contactName: contact,
        messageText: text,
        source,
        timestamp: new Date().toISOString()
    };
    pushEvent(instanceId, messageEvent);

    // Continue with Order Detection Pipeline
    if (!quickKeywordCheck(text)) {
        console.error(`[IOL Pipeline] ℹ️ Message ignoré (pas de mot-clé de commande)`);
        return;
    }
    
    console.error(`[IOL Pipeline] ✅ [${redactContact(contact)}] Potentielle commande détectée. Analyse IA en cours...`);
    const orderRadarModel = await db.getSetting('order_radar_model', '');
    const classif = await aiController.classifyOrderIntent(text, contact, orderRadarModel || null);

    if (!classif || !classif.is_order || classif.confidence < 0.5) {
        console.error(`[IOL Pipeline] ❌ Rejeté par l'IA (Pas une commande ou confiance trop faible).`);
        return;
    }
    
    console.error(`[IOL Pipeline] 🎯 INTENTION CONFIRMÉE : ${classif.order_type} (Confiance: ${Math.round(classif.confidence*100)}%)`);
    // Le résumé est produit par l'IA à partir du message : il en reprend le contenu.
    console.error(`[IOL Pipeline] 📝 Résumé : ${redactMessage(classif.summary)}`);
    console.error(`[IOL Pipeline] 🚀 Signature en base de données...`);
    
    // L'enregistrement en base n'a pas de valeur de retour exploitable ; seul
    // compte qu'il se termine avant l'émission de l'événement.
    const [, agentReply] = await Promise.all([
        logOrderToDb(instanceId, contact, text, classif, source),
        transferToAgent(contact, text)
    ]);

    const orderEvent = {
        id: msgId, // Reuse same ID for linked events
        type: 'order_detected',
        instanceId,
        contactName: contact,
        messageText: text,
        source,
        classification: classif,
        agentReply,
        timestamp: new Date().toISOString()
    };

    pushEvent(instanceId, orderEvent);
}

// Logic to Save Order to DB
async function logOrderToDb(instanceId, contact, text, classif, source = 'text') {
    try {
        const query = `
            INSERT INTO detected_orders (instance_id, contact_name, message_text, order_type, confidence, summary, source)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        const values = [instanceId, contact, text, classif.order_type, classif.confidence, classif.summary, source];
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
        // Sélecteurs du registre (livrés, ou fichier signé : wa/waSelectors.js),
        // préparés DANS la page — les candidats que le navigateur refuse y sont écartés.
        const registre = getSelectorRegistry();
        let sel = await targetPage.evaluateHandle(inPageSelectors, registre.forPage());

        // Wait for WhatsApp to be fully loaded
        try {
            const appReady = await targetPage.evaluate((s) => s.S.appReady, sel);
            await targetPage.waitForSelector(appReady, { timeout: 15000 });
            console.error(`[IOL] ✅ WhatsApp UI loaded. Ready to inject observer.`);

            // Contrôle de santé, page chargée seulement : un fichier distant qui
            // casse ce que les sélecteurs livrés trouvaient est écarté sur-le-champ.
            const verdict = registre.reportHealth(await targetPage.evaluate(inPageHealth, registre.forPage(), CRITICAL_KEYS));
            if (verdict.rolledBack) {
                console.error(`[IOL] Sélecteurs distants écartés (version ${verdict.rejected} : ${verdict.keys.join(', ')}).`);
                await sel.dispose().catch(() => {});
                sel = await targetPage.evaluateHandle(inPageSelectors, registre.forPage());
            }
        } catch {
            console.error(`[IOL] ⚠️ Timeout waiting for WhatsApp UI, attempting to inject anyway...`);
        }

        // Inject observer bridge safely (catch if already exposed after server restart)
        try {
            await targetPage.exposeFunction('onNewWaMessage', (contact, text) => {
                console.error(`\n======================================================\n[IOL DOM Bridge] 📥 Message reçu de l'interface : [${redactContact(contact)}] ${redactMessage(text)}`);
                processMessage(instanceId, contact, text);
            });
        } catch {}
        
        try {
            await targetPage.exposeFunction('onIolDebug', (msg) => {
                console.error(`[IOL Background] ${msg}`);
            });
        } catch {}

        // Notes vocales entrantes. Le rappel rend la main tout de suite : la
        // page n'attend rien, et l'extraction puis la transcription suivent
        // leur cours dans la file.
        try {
            await targetPage.exposeFunction('onNewWaVoiceNote', (contact, messageId) => {
                const page = targetPage;
                void getVoiceQueue().submit({ instanceId, contact, messageId, page });
            });
        } catch {}

        await targetPage.evaluate(observerInPage, sel);
        await sel.dispose().catch(() => {});
    
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
