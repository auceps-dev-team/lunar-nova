const express = require('express');
const router = express.Router();
const db = require('../db');
const aiController = require('../aiController');
const contactAgent = require('../services/contactAgent');
const googleMapScraper = require('../scrapers/googleMapScraper');
const annuaireCiScraper = require('../scrapers/annuaireCiScraper');
const goAfricaScraper = require('../scrapers/goAfricaScraper');

// Defensive JSON extraction for LLM responses that may include stray text/markdown
// fences around the actual JSON object (same pattern already used client-side in
// src/pages/AgentsHub.jsx for the 'creative' persona's JSON output).
function parseJsonResponse(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start === -1 || end === -1 || end < start) return null;
        return JSON.parse(raw.substring(start, end + 1));
    } catch (e) {
        return null;
    }
}

// Postgres returns JSONB columns already parsed as objects; SQLite (via the shim in
// backend/db.js, JSONB -> TEXT) returns the raw string. Handle both.
function parseMaybeJson(value) {
    if (value == null) return null;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (e) {
        return null;
    }
}

async function ensurePhoneUniqueIndex(client) {
    await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_contacts_phone_unique
        ON wa_contacts (phone)
        WHERE phone IS NOT NULL AND phone != ''
    `).catch(() => { /* already exists */ });
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

router.post('/runs', async (req, res) => {
    const { brief, name } = req.body || {};
    if (!brief || !brief.trim()) {
        return res.status(400).json({ success: false, error: 'Le brief est obligatoire.' });
    }
    try {
        const result = await db.pool.query(
            `INSERT INTO pipeline_runs (name, brief) VALUES ($1, $2) RETURNING *`,
            [name || null, brief.trim()]
        );
        res.json({ success: true, run: result.rows[0] });
    } catch (e) {
        console.error('[Pipeline] Create run error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/runs', async (req, res) => {
    try {
        const result = await db.pool.query(`SELECT * FROM pipeline_runs ORDER BY created_at DESC`);
        res.json({ success: true, runs: result.rows.map(r => ({ ...r, search_params: parseMaybeJson(r.search_params) })) });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/runs/:id', async (req, res) => {
    try {
        const runResult = await db.pool.query(`SELECT * FROM pipeline_runs WHERE id = $1`, [req.params.id]);
        if (runResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Run introuvable.' });
        }
        const cardsResult = await db.pool.query(
            `SELECT pc.*, wc.name AS contact_name, wc.phone AS contact_phone
             FROM pipeline_cards pc
             LEFT JOIN wa_contacts wc ON wc.id = pc.contact_id
             WHERE pc.run_id = $1
             ORDER BY pc.created_at ASC`,
            [req.params.id]
        );
        const run = runResult.rows[0];
        res.json({ success: true, run: { ...run, search_params: parseMaybeJson(run.search_params) }, cards: cardsResult.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ---------------------------------------------------------------------------
// Stage 1 — Prospecting Agent: brief -> structured params -> live scrape
// ---------------------------------------------------------------------------

router.post('/runs/:id/prospect', async (req, res) => {
    const { brief } = req.body || {};
    const runId = req.params.id;

    if (!brief || !brief.trim()) {
        return res.status(400).json({ success: false, error: 'Le brief est obligatoire.' });
    }

    try {
        const aiResult = await aiController.chatWithAgent('prospecting_agent', brief, null, null, 'json');
        const parsedParams = parseJsonResponse(aiResult && aiResult.response);

        if (!parsedParams || !parsedParams.query) {
            return res.status(422).json({
                success: false,
                error: "L'agent de prospection n'a pas réussi à interpréter ce brief. Reformulez-le avec un type de commerce et une zone plus explicites."
            });
        }

        const {
            source = 'google',
            query,
            zone = '',
            quantity = 20,
            ignoreLandlines = true,
            duration = 5,
            country = '',
            subcategorySlug = ''
        } = parsedParams;

        let leads = [];
        if (source === 'goafrica') {
            leads = await goAfricaScraper.search(query, ignoreLandlines, 1, country, subcategorySlug);
        } else if (source === 'annuaireci') {
            leads = await annuaireCiScraper.search(query, ignoreLandlines, 1);
        } else {
            leads = await googleMapScraper.search(query, ignoreLandlines, quantity, duration, zone, []);
        }

        await db.pool.query(
            `UPDATE pipeline_runs SET brief = $1, search_params = $2, current_stage = 'contacts', updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [brief.trim(), JSON.stringify(parsedParams), runId]
        );

        res.json({ success: true, parsedParams, count: leads.length, leads });
    } catch (e) {
        console.error('[Pipeline] Prospect stage error:', e);
        res.status(500).json({ success: false, error: e.message || 'Erreur lors de la recherche de leads.' });
    }
});

// ---------------------------------------------------------------------------
// Stage 2 — Contact Agent: format validation + dedup -> insert wa_contacts
// ---------------------------------------------------------------------------

router.post('/runs/:id/save-contacts', async (req, res) => {
    const { leads, list_id, segment_id } = req.body || {};
    const runId = req.params.id;

    if (!Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ success: false, error: 'Aucun lead à enregistrer.' });
    }

    const client = await db.pool.connect();
    try {
        const { valid, invalid, duplicates } = await contactAgent.validateAndDedupeLeads(leads);

        await client.query('BEGIN');
        await ensurePhoneUniqueIndex(client);

        const savedContacts = [];
        for (const lead of valid) {
            const result = await client.query(
                `INSERT INTO wa_contacts (name, phone, list_id, segment_id, email, address)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (phone) WHERE phone IS NOT NULL AND phone != ''
                 DO NOTHING
                 RETURNING *`,
                [lead.name || 'Inconnu', lead.phone, list_id || null, segment_id || null, null, lead.address || null]
            );
            if (result.rows.length > 0) {
                savedContacts.push(result.rows[0]);
            }
        }

        await client.query(
            `UPDATE pipeline_runs SET current_stage = 'messages', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [runId]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            imported: savedContacts.length,
            invalidCount: invalid.length,
            duplicateCount: duplicates.length,
            invalid,
            duplicates,
            contacts: savedContacts
        });
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[Pipeline] Save contacts error:', e);
        res.status(500).json({ success: false, error: e.message || 'Erreur lors de la sauvegarde des contacts.' });
    } finally {
        client.release();
    }
});

// ---------------------------------------------------------------------------
// Stage 3 — Antoine (outbound_strategist): draft a message per contact
// ---------------------------------------------------------------------------

router.post('/runs/:id/generate-messages', async (req, res) => {
    const { contactIds } = req.body || {};

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Aucun contact sélectionné.' });
    }

    try {
        const placeholders = contactIds.map((_, i) => `$${i + 1}`).join(',');
        const contactsResult = await db.pool.query(
            `SELECT * FROM wa_contacts WHERE id IN (${placeholders})`,
            contactIds
        );

        const drafts = [];
        for (const contact of contactsResult.rows) {
            const prompt = `Rédige un message d'approche court et personnalisé (WhatsApp, pas un email) pour ce prospect :\n` +
                `Nom : ${contact.name}\n` +
                `Adresse/contexte : ${contact.address || 'non précisé'}\n\n` +
                `Le message doit être prêt à copier-coller, sans objet ni signature formelle, ton direct et humain.`;

            let draftMessage = '';
            try {
                const aiResult = await aiController.chatWithAgent('outbound_strategist', prompt, null, null, 'text');
                draftMessage = (aiResult && aiResult.response) || '';
            } catch (aiErr) {
                console.error('[Pipeline] Antoine draft error for contact', contact.id, aiErr);
                draftMessage = '';
            }

            drafts.push({
                contact_id: contact.id,
                name: contact.name,
                phone: contact.phone,
                draft_message: draftMessage
            });
        }

        res.json({ success: true, drafts });
    } catch (e) {
        console.error('[Pipeline] Generate messages error:', e);
        res.status(500).json({ success: false, error: e.message || 'Erreur lors de la génération des messages.' });
    }
});

// ---------------------------------------------------------------------------
// Stage 4 — Clarisse (pipeline_organizer): deterministic Kanban bookkeeping.
// No LLM call in v1 (see backend/agents/personas/pipeline_organizer.js).
// ---------------------------------------------------------------------------

router.post('/runs/:id/organize', async (req, res) => {
    const { cards } = req.body || {};
    const runId = req.params.id;

    if (!Array.isArray(cards) || cards.length === 0) {
        return res.status(400).json({ success: false, error: 'Aucune carte à organiser.' });
    }

    try {
        const createdCards = [];
        for (const card of cards) {
            const result = await db.pool.query(
                `INSERT INTO pipeline_cards (run_id, contact_id, stage, draft_message)
                 VALUES ($1, $2, 'new', $3)
                 RETURNING *`,
                [runId, card.contact_id, card.draft_message || '']
            );
            createdCards.push(result.rows[0]);
        }

        await db.pool.query(
            `UPDATE pipeline_runs SET status = 'organized', current_stage = 'kanban', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [runId]
        );

        res.json({ success: true, cards: createdCards });
    } catch (e) {
        console.error('[Pipeline] Organize error:', e);
        res.status(500).json({ success: false, error: e.message || "Erreur lors de l'organisation Kanban." });
    }
});

// ---------------------------------------------------------------------------
// Kanban board — reads/writes independent of the wizard stage
// ---------------------------------------------------------------------------

router.get('/cards', async (req, res) => {
    const { run_id } = req.query;
    try {
        let query = `
            SELECT pc.*, wc.name AS contact_name, wc.phone AS contact_phone
            FROM pipeline_cards pc
            LEFT JOIN wa_contacts wc ON wc.id = pc.contact_id
        `;
        const params = [];
        if (run_id) {
            query += ` WHERE pc.run_id = $1`;
            params.push(run_id);
        }
        query += ` ORDER BY pc.created_at ASC`;

        const result = await db.pool.query(query, params);
        res.json({ success: true, cards: result.rows });
    } catch (e) {
        console.error('[Pipeline] List cards error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.put('/cards/:id/stage', async (req, res) => {
    const { stage } = req.body || {};
    if (!stage) {
        return res.status(400).json({ success: false, error: 'stage est obligatoire.' });
    }
    try {
        const result = await db.pool.query(
            `UPDATE pipeline_cards SET stage = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
            [stage, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Carte introuvable.' });
        }
        res.json({ success: true, card: result.rows[0] });
    } catch (e) {
        console.error('[Pipeline] Update card stage error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.put('/cards/:id', async (req, res) => {
    const { draft_message, notes } = req.body || {};
    try {
        const result = await db.pool.query(
            `UPDATE pipeline_cards
             SET draft_message = COALESCE($1, draft_message),
                 notes = COALESCE($2, notes),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [draft_message ?? null, notes ?? null, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Carte introuvable.' });
        }
        res.json({ success: true, card: result.rows[0] });
    } catch (e) {
        console.error('[Pipeline] Update card error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/cards/:id', async (req, res) => {
    try {
        await db.pool.query(`DELETE FROM pipeline_cards WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error('[Pipeline] Delete card error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
