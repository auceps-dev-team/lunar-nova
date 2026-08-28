const express = require('express');
const router = express.Router();
const googleMapScraper = require('../scrapers/googleMapScraper');
const annuaireCiScraper = require('../scrapers/annuaireCiScraper');
const goAfricaScraper = require('../scrapers/goAfricaScraper');
const prospectionService = require('../services/prospectionService');

const fs = require('fs');
const path = require('path');

// GET /api/prospection/goafrica-metadata
// Returns the static JSON structure of countries, categories, and subcategories
router.get('/goafrica-metadata', (req, res) => {
    try {
        const dataPath = path.join(__dirname, '../data/goafricaStructure.json');
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath, 'utf8');
            res.json({ success: true, data: JSON.parse(data) });
        } else {
            res.status(404).json({ success: false, error: 'Metadata non trouvée. Veuillez exécuter le script fetchGoAfricaStructure.js' });
        }
    } catch (error) {
        console.error('Error reading goafrica metadata:', error);
        res.status(500).json({ success: false, error: 'Failed to load metadata' });
    }
});

// POST /api/prospection/goafrica-update-metadata
// Régénère la structure des catégories Go Africa.
//
// Cette route était déclarée deux fois : Express ne retenait que la première, et
// la seconde — asynchrone, avec journalisation — était du code mort. Les deux
// lançaient `exec('node <script>')`, ce qui ne fonctionne pas dans l'application
// packagée, qui n'embarque aucun binaire `node`. Le script est désormais appelé
// en process.
router.post('/goafrica-update-metadata', async (req, res) => {
    try {
        console.log('[Prospection] Régénération de la structure GoAfrica...');
        const { generateStructure } = require('../scripts/fetchGoAfricaStructure');
        const result = await generateStructure();
        console.log(`[Prospection] Structure régénérée : ${result.categories} catégories.`);
        res.json({
            success: true,
            message: `Structure mise à jour : ${result.categories} catégories.`,
            categories: result.categories
        });
    } catch (error) {
        console.error('[Prospection] Échec de la mise à jour GoAfrica :', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/prospection/search
// Standard search (non-streaming) — used by annuaireci, goafrica, and as fallback
router.post('/search', async (req, res) => {
    const { source = 'google' } = req.body || {};
    try {
        console.log(`[Prospection] Recherche en cours: "${req.body.query}" | Source: ${source} | Pages: ${req.body.pages || 1}`);
        const { count, leads } = await prospectionService.search(req.body);
        res.json({ success: true, count, leads });
    } catch (error) {
        console.error(`[Prospection] Erreur lors de la recherche (${source}):`, error);
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message || 'Erreur lors de la recherche de leads'
        });
    }
});

// POST /api/prospection/search-stream
// SSE streaming search — sends real-time progress events
router.post('/search-stream', (req, res) => {
    const { query, ignoreLandlines, source = 'google', zone = '', duration = 5, quantity = 20, knownLinks = [], country, subcategorySlug } = req.body;

    if (!query && source !== 'goafrica') {
        return res.status(400).json({ error: 'La requête (query) est obligatoire.' });
    }

    // Set SSE headers
    // Pas d'Access-Control-Allow-Origin ici : le middleware cors de server.js pose
    // déjà l'en-tête pour les origines autorisées, et le forcer à '*' rouvrait la
    // route à n'importe quelle page web.
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.flushHeaders();

    // Helper to send SSE events
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        if (res.flush) {
            res.flush();
        }
    };

    // Listen to scraper progress events
    const onProgress = (data) => {
        console.log('[Prospection/SSE] Sending progress:', data.phase);
        sendEvent('progress', data);
    };
    googleMapScraper.on('progress', onProgress);

    // Handle client disconnect
    req.on('close', () => {
        // Only remove if the request was actually aborted before finishing
        if (!res.writableEnded) {
            console.log('[Prospection/SSE] Client disconnected or request closed, checking if aborted...');
            // In some Node versions, 'close' fires early. Let's just rely on .finally() to clean up.
        }
    });

    // Run the search
    console.log(`[Prospection/SSE] Streaming search: "${query}" | Source: ${source}`);
    
    if (source === 'google') {
        googleMapScraper.search(query, ignoreLandlines, quantity, duration, zone, knownLinks)
            .then((leads) => {
                sendEvent('result', { success: true, count: leads.length, leads });
                res.end();
            })
            .catch((error) => {
                sendEvent('error', { message: error.message });
                res.end();
            })
            .finally(() => {
                googleMapScraper.removeListener('progress', onProgress);
            });
    } else {
        // Non-google sources: run and return result
        // Callback de progression
        const onScrapeProgress = (data) => sendEvent('progress', data);
        
        sendEvent('progress', { phase: 'scroll', newCount: 0, target: req.body.pages || 1, message: 'Démarrage de la recherche...' });
        
        const searchPromise = source === 'goafrica' 
            ? goAfricaScraper.search(query, ignoreLandlines, req.body.pages || 1, country, subcategorySlug, onScrapeProgress)
            : annuaireCiScraper.search(query, ignoreLandlines, req.body.pages || 1, onScrapeProgress);
            
        searchPromise
            .then((leads) => {
                sendEvent('progress', { phase: 'done', message: 'Recherche terminée' });
                sendEvent('result', { success: true, count: leads.length, leads });
                res.end();
            })
            .catch((error) => {
                sendEvent('error', { message: error.message });
                res.end();
            })
            .finally(() => {
                googleMapScraper.removeListener('progress', onProgress);
            });
    }
});

// Backward compatibility
router.post('/google', async (req, res) => {
    req.body.source = 'google';
    req.url = '/search';
    router.handle(req, res);
});

// Clear Google Maps scraper session cache
router.post('/clear-cache', (req, res) => {
    const { query, zone } = req.body || {};
    googleMapScraper.clearSession(query, zone);
    res.json({ success: true, message: query ? `Cache cleared for "${query}"` : 'All cache cleared.' });
});

module.exports = router;
