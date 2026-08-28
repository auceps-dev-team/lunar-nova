const express = require('express');
const router = express.Router();
const documentsService = require('../services/documentsService');

// Ce router est monté sur /api/documents dans server.js : les chemins déclarés
// ici sont donc relatifs. Ils répétaient le préfixe, ce qui exposait l'API sur
// /api/documents/api/documents et renvoyait 404 à tous les appels du frontend.

// --- Phase 26: AI Writer Document APIs ---
router.get('/', async (req, res) => {
    try {
        const data = await documentsService.listDocuments();
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const data = await documentsService.getDocument(req.params.id);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await documentsService.deleteDocument(req.params.id);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const data = await documentsService.createDocument(req.body || {});
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const data = await documentsService.updateDocument(req.params.id, req.body || {});
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});
module.exports = router;
