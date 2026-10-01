const path = require('path');
const dotenv = require('dotenv');

// Charge le fichier .env du backend ou de la racine
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });
dotenv.config({ quiet: true });

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const orderListener = require('./orderListener');
const { requireApiToken } = require('./apiAuth');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || process.env.BACKEND_PORT || 3000;
// Boucle locale uniquement : sans cet hôte explicite, Node écoute sur 0.0.0.0 et
// expose toute l'API (clés LLM, contacts, historiques WhatsApp) au réseau local.
const HOST = process.env.BACKEND_HOST || '127.0.0.1';

// Update process.env if main process sends new secrets (electron-store)
function handleMessage(msg) {
    if (msg && msg.type === 'UPDATE_ENV' && msg.key) {
        process.env[msg.key] = msg.value;
        console.error(`[Backend] Updated environment variable: ${msg.key}`);
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

// Origine refusée : réponse 403 nette. Auparavant le middleware cors levait une
// erreur, qu'Express transformait en 500 avec trace de pile dans le journal —
// n'importe quelle page web pouvait ainsi remplir les journaux à volonté.
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
        return res.status(403).json({ error: 'Origine non autorisée.' });
    }
    next();
});

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

// Toute l'API est authentifiée. Enregistré avant les routers pour couvrir aussi
// ceux montés plus bas (y compris orderListener.registerRoutes en fin de fichier).
// Le preflight CORS est traité et terminé par le middleware cors ci-dessus, il
// n'atteint donc jamais cette vérification.
//
// Et AVANT l'analyse des corps. Mesuré le 1er octobre 2026 : placée après, un
// JSON malformé sans jeton renvoyait 400 (le corps était lu avant le contrôle),
// et 20 Mo envoyés sans jeton étaient analysés en 0,22 s avant le 401 — contre
// 0,004 s pour 10 octets. L'origine `null` étant autorisée (renderer en
// file://), une iframe sandboxée de n'importe quel site pouvait le déclencher,
// sans limite de débit puisque le limiteur vient après l'authentification.
// requireApiToken ne lit que les en-têtes, le chemin et la query : rien ne
// l'oblige à attendre le corps.
app.use(requireApiToken);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

const documentsRouter = require('./routes/documents');
app.use('/api/documents', documentsRouter);

const invoicesRouter = require('./routes/invoices');
app.use('/api/invoices', invoicesRouter);

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

// /api/config, /api/instances et /api/context/:instance_id : autrefois déclarées
// en ligne ici (constat R7 de l’audit du 29/09/2026), déplacées sans changement.
const systemRouter = require('./routes/system');
app.use('/api', systemRouter);

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
        console.error(`[Orchestrator] Running on http://${HOST}:${PORT}`);
        console.error(`[Orchestrator] Ready to connect to Electron CDP at port 8315`);
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
