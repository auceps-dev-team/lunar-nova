/**
 * API du Marketplace des fonctionnalités (ticket #30).
 *
 * GET /api/features      : le catalogue, avec l'état de chaque fonctionnalité.
 * PUT /api/features/:id  : { enabled: true|false }.
 *
 * Protégée par le jeton de l'API locale, comme toutes les routes. Seule
 * l'application appelle le PUT : aucun outil MCP ni aucune commande CLI ne
 * change l'état des fonctionnalités, sinon un agent extérieur pourrait
 * s'ouvrir lui-même des accès.
 */
const express = require('express');
const router = express.Router();
// Par espace de noms (features.etat…), jamais déstructuré : les tests
// substituent ces fonctions à chaud.
const features = require('../features');

router.get('/', async (req, res) => {
    try {
        res.json({ status: 'success', data: await features.etat() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    const enabled = req.body ? req.body.enabled : undefined;
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Le corps doit contenir « enabled » : true ou false.', code: 'INVALID_BODY' });
    }
    try {
        res.json({ status: 'success', data: await features.definir(req.params.id, enabled) });
    } catch (err) {
        if (err instanceof features.ErreurFonctionnalite) {
            return res.status(err.statut).json({ error: err.message, code: err.code, ...err.details });
        }
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
