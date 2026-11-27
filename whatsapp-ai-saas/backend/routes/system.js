const express = require('express');
const { getWaDriver } = require('../wa/waDriver');

/**
 * Routes « système » — autrefois déclarées en ligne dans server.js (constat R7
 * de l'audit du 29/09/2026). Monté sur /api : /api/instances.
 *
 * Retirés :
 *   - /api/config (27/11/2026) : il ne servait qu'à transmettre la clé Google
 *     Maps, la carte s'affichant désormais sans clé ;
 *   - /api/context/:instance_id (27/11/2026, fermeture du port de débogage) :
 *     aucun appelant, et il lisait la conversation par ce port. Le copilote lit
 *     la conversation lui-même (src/utils/whatsappContextScript.js).
 */
const router = express.Router();

/**
 * État du pilote WhatsApp et nombre de pages WhatsApp ouvertes. Lu toutes les
 * quelques secondes par l'espace WhatsApp (WorkArea) : `status: 'success'`
 * affiche le copilote comme connecté.
 *
 * Jusqu'à la v1.51.2, cette route interrogeait le port de débogage 8315 et
 * injectait au passage un second observateur dans chaque page, qui ne faisait
 * qu'écrire dans la console de la page : il n'est pas repris.
 */
router.get('/instances', async (req, res) => {
    try {
        const pages = await getWaDriver().listPages();
        res.json({
            status: 'success',
            active_instances: pages.length,
            message: `Pilote WhatsApp disponible (${getWaDriver().kind})`,
        });
    } catch (error) {
        console.error('[Instances] Pilote WhatsApp indisponible :', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Pilote WhatsApp indisponible : l\'application WaCopilote est-elle ouverte ?',
        });
    }
});

module.exports = router;
