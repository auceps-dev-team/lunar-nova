const db = require('../db');

// Normalize a raw phone string for comparison: keep a leading '+' if present, strip
// everything else that isn't a digit. Existing wa_contacts rows were never normalized
// at insert time (see backend/routes/wa.js bulk insert), so both sides of any dedup
// comparison must go through this same function rather than relying on exact string
// equality or a SQL-side transform (which would also need to work across both the
// Postgres and SQLite dialects this app supports).
//
// Limite connue : l'indicatif pays n'est pas retiré, donc « 0707070707 » et
// « +2250707070707 » ne sont pas rapprochés. Comportement défensif assumé —
// sans pays de référence fiable par lead, fusionner deux numéros dont l'égalité
// n'est pas prouvée coûterait des contacts ; en écarter un bon coûte un appel.
// Couvert par contactAgent.test.js.
function normalizePhone(raw) {
    if (!raw) return '';
    const trimmed = String(raw).trim();
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    return hasPlus ? `+${digits}` : digits;
}

function isValidPhoneFormat(normalized) {
    if (!normalized) return false;
    const digitCount = normalized.replace(/^\+/, '').length;
    return digitCount >= 8 && digitCount <= 15;
}

/**
 * Format-validates and deduplicates a batch of scraped leads against wa_contacts,
 * without any LLM call (v1 scope: format + dedup only, no live WhatsApp check).
 *
 * @param {Array<{name?: string, phone?: string, [key: string]: any}>} leads
 * @param {object} [pool=db.pool]  Pool SQL injectable — par défaut celui de
 *   l'application. L'injection permet aux tests unitaires de passer un faux
 *   pool sans dépendre du binding natif sqlite3.
 * @returns {Promise<{valid: Array, invalid: Array, duplicates: Array}>}
 */
async function validateAndDedupeLeads(leads, pool = db.pool) {
    const valid = [];
    const invalid = [];
    const duplicates = [];
    const seenInBatch = new Set();

    const existingResult = await pool.query(
        `SELECT phone FROM wa_contacts WHERE phone IS NOT NULL AND phone != ''`
    );
    const existingPhones = new Set(
        existingResult.rows.map(row => normalizePhone(row.phone)).filter(Boolean)
    );

    for (const lead of (leads || [])) {
        const normalizedPhone = normalizePhone(lead.phone);

        if (!isValidPhoneFormat(normalizedPhone)) {
            invalid.push(lead);
            continue;
        }

        if (existingPhones.has(normalizedPhone) || seenInBatch.has(normalizedPhone)) {
            duplicates.push(lead);
            continue;
        }

        seenInBatch.add(normalizedPhone);
        valid.push({ ...lead, phone: normalizedPhone });
    }

    return { valid, invalid, duplicates };
}

module.exports = { validateAndDedupeLeads, normalizePhone, isValidPhoneFormat };
