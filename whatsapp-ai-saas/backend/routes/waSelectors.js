/**
 * /api/wa/selectors — état du registre des sélecteurs WhatsApp, et actions.
 *
 *   GET  /api/wa/selectors           état + paquet pour une page (copilote)
 *   POST /api/wa/selectors/check     vérifie la release, applique si plus récent
 *   POST /api/wa/selectors/rollback  écarte la version distante en service
 *
 * Authentifié comme toutes les routes (apiAuth : aucun chemin public).
 */
const express = require('express');
const { getSelectorRegistry, inPageSelectors } = require('../wa/waSelectors');

function createWaSelectorsRouter(registre = getSelectorRegistry()) {
    const router = express.Router();

    router.get('/', (req, res) => {
        res.json({ status: 'success', registry: registre.status(), page: registre.forPage(), helper: inPageSelectors.toString() });
    });

    router.post('/check', async (req, res) => {
        try {
            const r = await registre.checkForUpdate();
            res.json({ status: 'success', result: r, registry: registre.status() });
        } catch (e) {
            res.status(500).json({ status: 'error', error: e.message });
        }
    });

    router.post('/rollback', (req, res) => {
        try {
            const r = registre.rollback('manuel');
            res.json({ status: 'success', result: r, registry: registre.status() });
        } catch (e) {
            res.status(500).json({ status: 'error', error: e.message });
        }
    });

    return router;
}

module.exports = { createWaSelectorsRouter };
