const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const puppeteer = require('puppeteer-core');
const orderListener = require('./orderListener');
const { requireApiToken } = require('./apiAuth');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || process.env.BACKEND_PORT || 3000;
// Boucle locale uniquement : sans cet hôte explicite, Node écoute sur 0.0.0.0 et
// expose toute l'API (clés LLM, contacts, identifiants WordPress) au réseau local.
const HOST = process.env.BACKEND_HOST || '127.0.0.1';

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

// Security: Restrict CORS to specific origins.
// `!origin` couvre les clients non-navigateur ; ceux-là restent filtrés par le token.
// Le renderer Electron en production est chargé en file:// : les requêtes fetch
// vers le backend partent alors avec `Origin: null` (origin opaque), et non
// `file://` comme le supposait l'ancienne liste — le renderer aurait été bloqué
// par le navigateur. `null` n'apporte aucun privilège : l'authentification par
// token Bearer reste obligatoire sur toutes les routes, c'est elle la barrière.
const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000', 'null'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Toute l'API est authentifiée. Enregistré avant les routers pour couvrir aussi
// ceux montés plus bas (y compris orderListener.registerRoutes en fin de fichier).
// Le preflight CORS est traité et terminé par le middleware cors ci-dessus, il
// n'atteint donc jamais cette vérification.
app.use(requireApiToken);

// Plafond global. Le service n'écoute que sur la boucle locale et exige un
// token : il ne s'agit donc pas de se protéger d'un tiers, mais d'empêcher
// qu'une boucle de rendu ou un composant qui rappelle en continu ne sature le
// backend ou ne fasse exploser une facture d'API. Le seuil est large pour ne
// jamais gêner un usage normal.
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' }
});
app.use(globalLimiter);

// Plafond serré sur les opérations lourdes : le scraping ouvre un navigateur et
// dure des dizaines de secondes, l'envoi au catalogue accepte jusqu'à 50 Mo de
// base64 et pilote WhatsApp Web.
const heavyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requêtes sur une opération coûteuse. Réessayez dans quelques minutes.' }
});

// --- Google Auth Loopback ---
const authGoogleRouter = require('./routes/authGoogle');
app.use('/api/auth/google', authGoogleRouter);

// --- Prospection (Google Maps API) ---
const prospectionRouter = require('./routes/prospection');
app.use('/api/prospection', heavyLimiter, prospectionRouter);

// --- Agentic Pipeline (Prospection -> Contacts -> Antoine -> Clarisse/Kanban) ---
const pipelineRouter = require('./routes/pipeline');
app.use('/api/pipeline', pipelineRouter);

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

const documentsRouter = require('./routes/documents');
app.use('/api/documents', documentsRouter);

// Chaque router porte désormais un préfixe de montage explicite et déclare des
// chemins relatifs. Quatre d'entre eux étaient montés sur '/' en répétant leur
// préfixe complet en interne, ce qui rendait l'ordre de résolution difficile à
// suivre — et masquait le doublon /api/documents/api/documents.
//
// settings_and_agents et ai sont montés sur /api : ils exposent chacun plusieurs
// familles de chemins (/settings + /agents, /ai + /debug + /test-model), toutes
// disjointes.
const settingsAgentsRouter = require('./routes/settings_and_agents');
app.use('/api', settingsAgentsRouter);

const aiRouter = require('./routes/ai');
app.use('/api', aiRouter);

const catalogRouter = require('./routes/catalog');
app.use('/api/catalog', heavyLimiter, catalogRouter);

const waRouter = require('./routes/wa');
app.use('/api/wa', waRouter);

const cliBridgeRouter = require('./routes/cliBridge');
app.use('/api/cli', cliBridgeRouter);


const configLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests' }
});

// API route to get config for frontend
app.get('/api/config', configLimiter, (req, res) => {
    res.json({
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
});

// API route to get WhatsApp instances status
app.get('/api/instances', async (req, res) => {
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

// Phase 21: Intelligent Order Listener
orderListener.registerRoutes(app);

// Initialisation DB explicite au démarrage (constat N14) : le module db.js ne
// fait plus de « fail fast » au require ni n'appelle process.exit lui-même.
// C'est ici, une seule fois, que l'échec d'initialisation arrête le service —
// les accesseurs restent eux protégés (mode dégradé) s'ils sont appelés avant.
(async () => {
    const ok = await db.initDB().catch((err) => {
        console.error('[CRITICAL] Erreur inattendue à l\'initialisation de la base :', err);
        return false;
    });
    if (!ok) {
        console.error('[CRITICAL] Impossible d\'initialiser la base de données. Arrêt du service.');
        process.exit(1);
    }

    const server = app.listen(PORT, HOST, () => {
        console.log(`[Orchestrator] Running on http://${HOST}:${PORT}`);
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
})();
