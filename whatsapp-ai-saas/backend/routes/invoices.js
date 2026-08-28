const express = require('express');
const router = express.Router();
const invoiceService = require('../services/invoiceService');

router.get('/', async (req, res) => {
    try {
        const data = await invoiceService.listInvoices();
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const data = await invoiceService.getInvoice(req.params.id);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const data = await invoiceService.createInvoice(req.body || {});
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const data = await invoiceService.updateInvoice(req.params.id, req.body || {});
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await invoiceService.deleteInvoice(req.params.id);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/invoices/:id/export-pdf — rend le PDF côté serveur (Chromium
// headless autonome, voir invoiceService.renderPdf) et le renvoie en binaire.
router.post('/:id/export-pdf', async (req, res) => {
    try {
        const { buffer } = await invoiceService.renderPdf(req.params.id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="quote-${req.params.id}.pdf"`);
        res.send(buffer);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

module.exports = router;
