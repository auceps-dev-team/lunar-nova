const express = require('express');
const router = express.Router();
const googlePlacesService = require('../googlePlacesService');
const annuaireCiScraper = require('../scrapers/annuaireCiScraper');
const goAfricaScraper = require('../scrapers/goAfricaScraper');

// POST /api/prospection/search
// Chercher des leads sur différentes sources
router.post('/search', async (req, res) => {
    try {
        // query: le terme de recherche
        // ignoreLandlines: boolean
        // source: 'google' | 'annuaireci' | 'goafrica'
        // pages: number (quantité de pages à scraper)
        const { query, ignoreLandlines, source = 'google', pages = 1 } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'La requête (query) est obligatoire.' });
        }

        console.log(`[Prospection] Recherche en cours: "${query}" | Source: ${source} | Pages: ${pages}`);
        
        let leads = [];

        if (source === 'google') {
            leads = await googlePlacesService.searchPlaces(query, ignoreLandlines);
        } else if (source === 'annuaireci') {
            leads = await annuaireCiScraper.search(query, ignoreLandlines, pages);
        } else if (source === 'goafrica') {
            leads = await goAfricaScraper.search(query, ignoreLandlines, pages);
        } else {
            return res.status(400).json({ error: 'Source de prospection invalide.' });
        }
        
        res.json({
            success: true,
            count: leads.length,
            leads: leads
        });
    } catch (error) {
        console.error(`[Prospection] Erreur lors de la recherche (${req.body.source}):`, error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Erreur lors de la recherche de leads' 
        });
    }
});

// Garder l'ancienne route pour rétrocompatibilité le temps de la transition
router.post('/google', async (req, res) => {
    // Redirige en interne vers la nouvelle logique
    req.body.source = 'google';
    req.url = '/search';
    router.handle(req, res);
});

module.exports = router;
