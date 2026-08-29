const db = require('../db');
const aiController = require('../aiController');
const contactAgent = require('./contactAgent');
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
    } catch {
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
    } catch {
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

async function createRun({ brief, name } = {}) {
    if (!brief || !brief.trim()) {
        const err = new Error('Le brief est obligatoire.');
        err.statusCode = 400;
        throw err;
    }
    const result = await db.pool.query(
        `INSERT INTO pipeline_runs (name, brief) VALUES ($1, $2) RETURNING *`,
        [name || null, brief.trim()]
    );
    return result.rows[0];
}

async function listRuns() {
    const result = await db.pool.query(`SELECT * FROM pipeline_runs ORDER BY created_at DESC`);
    return result.rows.map(r => ({ ...r, search_params: parseMaybeJson(r.search_params) }));
}

async function getRun(runId) {
    const runResult = await db.pool.query(`SELECT * FROM pipeline_runs WHERE id = $1`, [runId]);
    if (runResult.rows.length === 0) {
        const err = new Error('Run introuvable.');
        err.statusCode = 404;
        throw err;
    }
    const cardsResult = await db.pool.query(
        `SELECT pc.*, wc.name AS contact_name, wc.phone AS contact_phone
         FROM pipeline_cards pc
         LEFT JOIN wa_contacts wc ON wc.id = pc.contact_id
         WHERE pc.run_id = $1
         ORDER BY pc.created_at ASC`,
        [runId]
    );
    const run = runResult.rows[0];
    return { run: { ...run, search_params: parseMaybeJson(run.search_params) }, cards: cardsResult.rows };
}

// ---------------------------------------------------------------------------
// Stage 1 — Prospecting Agent: brief -> structured params -> live scrape
// ---------------------------------------------------------------------------

async function prospectStage(runId, { brief } = {}) {
    if (!brief || !brief.trim()) {
        const err = new Error('Le brief est obligatoire.');
        err.statusCode = 400;
        throw err;
    }

    const aiResult = await aiController.chatWithAgent('prospecting_agent', brief, null, null, 'json');
    const parsedParams = parseJsonResponse(aiResult && aiResult.response);

    if (!parsedParams || !parsedParams.query) {
        const err = new Error("L'agent de prospection n'a pas réussi à interpréter ce brief. Reformulez-le avec un type de commerce et une zone plus explicites.");
        err.statusCode = 422;
        throw err;
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

    return { parsedParams, count: leads.length, leads };
}

// Crée ou récupère un segment de contacts nommé.
async function createSegment(name) {
    if (!name || !name.trim()) return null;
    const trimmed = name.trim();
    const existing = await db.pool.query('SELECT * FROM wa_segments WHERE name = $1', [trimmed]);
    if (existing.rows && existing.rows.length > 0) {
        return existing.rows[0];
    }
    const result = await db.pool.query(
        `INSERT INTO wa_segments (name) VALUES ($1) RETURNING *`,
        [trimmed]
    );
    return result.rows[0];
}

// Crée ou récupère une liste de contacts nommée (utilisée par `pipeline run --auto
// --list-name`, pour répondre au besoin « prospecter et créer une liste » en un
// seul appel CLI/MCP).
async function createContactList(name) {
    if (!name || !name.trim()) return null;
    const trimmed = name.trim();
    const existing = await db.pool.query('SELECT * FROM wa_contact_lists WHERE name = $1', [trimmed]);
    if (existing.rows && existing.rows.length > 0) {
        return existing.rows[0];
    }
    const result = await db.pool.query(
        `INSERT INTO wa_contact_lists (name) VALUES ($1) RETURNING *`,
        [trimmed]
    );
    return result.rows[0];
}

// ---------------------------------------------------------------------------
// Stage 2 — Contact Agent: format validation + dedup -> insert wa_contacts
// & réaffectation des contacts doublons existants au segment / liste spécifié
// ---------------------------------------------------------------------------

async function saveContactsStage(runId, {
    leads,
    list_id,
    listId,
    list_name,
    listName,
    segment_id,
    segmentId,
    segment_name,
    segmentName
} = {}) {
    if (!Array.isArray(leads) || leads.length === 0) {
        const err = new Error('Aucun lead à enregistrer.');
        err.statusCode = 400;
        throw err;
    }

    let finalSegmentId = segment_id || segmentId || null;
    const targetSegmentName = segment_name || segmentName;
    if (!finalSegmentId && targetSegmentName) {
        const seg = await createSegment(targetSegmentName);
        if (seg) finalSegmentId = seg.id;
    }

    let finalListId = list_id || listId || null;
    const targetListName = list_name || listName;
    if (!finalListId && targetListName) {
        const list = await createContactList(targetListName);
        if (list) finalListId = list.id;
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
                [lead.name || 'Inconnu', lead.phone, finalListId || null, finalSegmentId || null, null, lead.address || null]
            );
            if (result.rows && result.rows.length > 0) {
                savedContacts.push(result.rows[0]);
            }
        }

        // Réaffectation et enrichissement des doublons existants
        const reassignedContacts = [];
        const seenUpdatedIds = new Set(savedContacts.map(c => c.id));

        for (const dup of duplicates) {
            const normalizedPhone = contactAgent.normalizePhone(dup.phone);
            if (!normalizedPhone) continue;

            const newName = (dup.name && dup.name.trim() !== '' && dup.name.trim() !== 'Inconnu') ? dup.name.trim() : null;
            const newAddress = (dup.address && dup.address.trim() !== '') ? dup.address.trim() : null;

            await client.query(
                `UPDATE wa_contacts
                 SET list_id = COALESCE($1, list_id),
                     segment_id = COALESCE($2, segment_id),
                     name = COALESCE($3, name),
                     address = COALESCE($4, address)
                 WHERE phone = $5 OR phone = $6`,
                [finalListId || null, finalSegmentId || null, newName, newAddress, dup.phone, normalizedPhone]
            );

            const selectUpdated = await client.query(
                `SELECT * FROM wa_contacts WHERE phone = $1 OR phone = $2 LIMIT 1`,
                [dup.phone, normalizedPhone]
            );

            if (selectUpdated.rows && selectUpdated.rows.length > 0) {
                for (const row of selectUpdated.rows) {
                    if (!seenUpdatedIds.has(row.id)) {
                        seenUpdatedIds.add(row.id);
                        reassignedContacts.push(row);
                    }
                }
            }
        }

        if (runId) {
            await client.query(
                `UPDATE pipeline_runs SET current_stage = 'messages', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [runId]
            );
        }

        await client.query('COMMIT');

        const allContacts = [...savedContacts, ...reassignedContacts];

        return {
            imported: savedContacts.length,
            reassignedCount: reassignedContacts.length,
            invalidCount: invalid.length,
            duplicateCount: duplicates.length,
            invalid,
            duplicates,
            reassigned: reassignedContacts,
            contacts: allContacts
        };
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        client.release();
    }
}

// ---------------------------------------------------------------------------
// Stage 3 — Antoine (outbound_strategist): draft a message per contact
// ---------------------------------------------------------------------------

async function generateMessagesStage({ contactIds } = {}) {
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
        const err = new Error('Aucun contact sélectionné.');
        err.statusCode = 400;
        throw err;
    }

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
            console.error('[PipelineService] Antoine draft error for contact', contact.id, aiErr);
            draftMessage = '';
        }

        drafts.push({
            contact_id: contact.id,
            name: contact.name,
            phone: contact.phone,
            draft_message: draftMessage
        });
    }

    return { drafts };
}

// ---------------------------------------------------------------------------
// Stage 4 — Clarisse (pipeline_organizer): deterministic Kanban bookkeeping.
// No LLM call in v1 (see backend/agents/personas/pipeline_organizer.js).
// ---------------------------------------------------------------------------

async function organizeStage(runId, { cards } = {}) {
    if (!Array.isArray(cards) || cards.length === 0) {
        const err = new Error('Aucune carte à organiser.');
        err.statusCode = 400;
        throw err;
    }

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

    return { cards: createdCards };
}

// ---------------------------------------------------------------------------
// Kanban board — reads/writes independent of the wizard stage
// ---------------------------------------------------------------------------

async function listCards({ run_id } = {}) {
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
    return result.rows;
}

async function updateCardStage(cardId, stage) {
    if (!stage) {
        const err = new Error('stage est obligatoire.');
        err.statusCode = 400;
        throw err;
    }
    const result = await db.pool.query(
        `UPDATE pipeline_cards SET stage = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [stage, cardId]
    );
    if (result.rows.length === 0) {
        const err = new Error('Carte introuvable.');
        err.statusCode = 404;
        throw err;
    }
    return result.rows[0];
}

async function updateCard(cardId, { draft_message, notes } = {}) {
    const result = await db.pool.query(
        `UPDATE pipeline_cards
         SET draft_message = COALESCE($1, draft_message),
             notes = COALESCE($2, notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [draft_message ?? null, notes ?? null, cardId]
    );
    if (result.rows.length === 0) {
        const err = new Error('Carte introuvable.');
        err.statusCode = 404;
        throw err;
    }
    return result.rows[0];
}

async function deleteCard(cardId) {
    await db.pool.query(`DELETE FROM pipeline_cards WHERE id = $1`, [cardId]);
    return { success: true };
}

// ---------------------------------------------------------------------------
// Composite — chains all 4 stages for a one-shot autonomous pipeline run.
// Used by `wacopilote pipeline run --auto` and the MCP `run_pipeline` tool.
// ---------------------------------------------------------------------------

async function runAuto({ brief, name, listId, listName, segmentId, segmentName } = {}) {
    const run = await createRun({ brief, name });
    const { leads } = await prospectStage(run.id, { brief });

    if (!leads || leads.length === 0) {
        return { run, leads: [], contacts: [], drafts: [], cards: [] };
    }

    let resolvedListId = listId || null;
    let contactList = null;
    if (!resolvedListId && listName) {
        contactList = await createContactList(listName);
        if (contactList) resolvedListId = contactList.id;
    }

    let resolvedSegmentId = segmentId || null;
    let contactSegment = null;
    if (!resolvedSegmentId && segmentName) {
        contactSegment = await createSegment(segmentName);
        if (contactSegment) resolvedSegmentId = contactSegment.id;
    }

    const { contacts, reassigned } = await saveContactsStage(run.id, {
        leads,
        list_id: resolvedListId,
        segment_id: resolvedSegmentId
    });
    const contactIds = (contacts || []).map(c => c.id);

    if (contactIds.length === 0) {
        return { run, leads, contactList, contactSegment, contacts: [], drafts: [], cards: [] };
    }

    const { drafts } = await generateMessagesStage({ contactIds });
    const cardsInput = drafts.map(d => ({ contact_id: d.contact_id, draft_message: d.draft_message }));
    const { cards } = await organizeStage(run.id, { cards: cardsInput });

    return { run, leads, contactList, contactSegment, contacts, drafts, cards, reassigned };
}

module.exports = {
    parseJsonResponse,
    parseMaybeJson,
    createRun,
    listRuns,
    getRun,
    prospectStage,
    saveContactsStage,
    generateMessagesStage,
    organizeStage,
    listCards,
    updateCardStage,
    updateCard,
    deleteCard,
    createContactList,
    createSegment,
    runAuto
};
