const express = require('express');
const router = express.Router();
const pipelineService = require('../services/pipelineService');

function sendError(res, e, fallback) {
    console.error('[Pipeline]', fallback, e);
    res.status(e.statusCode || 500).json({ success: false, error: e.message || fallback });
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

router.post('/runs', async (req, res) => {
    try {
        const run = await pipelineService.createRun(req.body || {});
        res.json({ success: true, run });
    } catch (e) {
        sendError(res, e, 'Create run error');
    }
});

router.get('/runs', async (req, res) => {
    try {
        const runs = await pipelineService.listRuns();
        res.json({ success: true, runs });
    } catch (e) {
        sendError(res, e, 'List runs error');
    }
});

router.get('/runs/:id', async (req, res) => {
    try {
        const { run, cards } = await pipelineService.getRun(req.params.id);
        res.json({ success: true, run, cards });
    } catch (e) {
        sendError(res, e, 'Get run error');
    }
});

// ---------------------------------------------------------------------------
// Stage 1 — Prospecting Agent: brief -> structured params -> live scrape
// ---------------------------------------------------------------------------

router.post('/runs/:id/prospect', async (req, res) => {
    try {
        const result = await pipelineService.prospectStage(req.params.id, req.body || {});
        res.json({ success: true, ...result });
    } catch (e) {
        sendError(res, e, 'Prospect stage error');
    }
});

// ---------------------------------------------------------------------------
// Stage 2 — Contact Agent: format validation + dedup -> insert wa_contacts
// ---------------------------------------------------------------------------

router.post('/runs/:id/save-contacts', async (req, res) => {
    try {
        const result = await pipelineService.saveContactsStage(req.params.id, req.body || {});
        res.json({ success: true, ...result });
    } catch (e) {
        sendError(res, e, 'Save contacts error');
    }
});

// ---------------------------------------------------------------------------
// Stage 3 — Antoine (outbound_strategist): draft a message per contact
// ---------------------------------------------------------------------------

router.post('/runs/:id/generate-messages', async (req, res) => {
    try {
        const { drafts } = await pipelineService.generateMessagesStage(req.body || {});
        res.json({ success: true, drafts });
    } catch (e) {
        sendError(res, e, 'Generate messages error');
    }
});

// ---------------------------------------------------------------------------
// Stage 4 — Clarisse (pipeline_organizer): deterministic Kanban bookkeeping.
// ---------------------------------------------------------------------------

router.post('/runs/:id/organize', async (req, res) => {
    try {
        const { cards } = await pipelineService.organizeStage(req.params.id, req.body || {});
        res.json({ success: true, cards });
    } catch (e) {
        sendError(res, e, 'Organize error');
    }
});

// ---------------------------------------------------------------------------
// Kanban board — reads/writes independent of the wizard stage
// ---------------------------------------------------------------------------

router.get('/cards', async (req, res) => {
    try {
        const cards = await pipelineService.listCards(req.query || {});
        res.json({ success: true, cards });
    } catch (e) {
        sendError(res, e, 'List cards error');
    }
});

router.put('/cards/:id/stage', async (req, res) => {
    try {
        const card = await pipelineService.updateCardStage(req.params.id, req.body && req.body.stage);
        res.json({ success: true, card });
    } catch (e) {
        sendError(res, e, 'Update card stage error');
    }
});

router.put('/cards/:id', async (req, res) => {
    try {
        const card = await pipelineService.updateCard(req.params.id, req.body || {});
        res.json({ success: true, card });
    } catch (e) {
        sendError(res, e, 'Update card error');
    }
});

router.delete('/cards/:id', async (req, res) => {
    try {
        await pipelineService.deleteCard(req.params.id);
        res.json({ success: true });
    } catch (e) {
        sendError(res, e, 'Delete card error');
    }
});

module.exports = router;
