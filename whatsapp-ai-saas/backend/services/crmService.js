const { pool } = require('../db');
const contactAgent = require('./contactAgent');

/**
 * Service CRM : Gestion unifiée des contacts et segments.
 */

/**
 * Liste les segments avec le décompte des contacts associés.
 * @returns {Promise<Array<object>>}
 */
async function listSegments() {
    const result = await pool.query(`
        SELECT s.*, COUNT(c.id) as contact_count
        FROM wa_segments s
        LEFT JOIN wa_contacts c ON s.id = c.segment_id
        GROUP BY s.id, s.name
        ORDER BY s.id DESC
    `);
    return (result.rows || []).map(r => ({
        ...r,
        contact_count: parseInt(r.contact_count || 0, 10)
    }));
}

/**
 * Crée un nouveau segment ou renvoie l'existant s'il existe déjà avec ce nom.
 * @param {object} params
 * @param {string} params.name
 * @returns {Promise<object>}
 */
async function createSegment({ name } = {}) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
        const err = new Error('Le nom du segment est obligatoire.');
        err.statusCode = 400;
        throw err;
    }
    const trimmed = name.trim();
    const existing = await pool.query('SELECT * FROM wa_segments WHERE name = $1 LIMIT 1', [trimmed]);
    if (existing.rows && existing.rows.length > 0) {
        return existing.rows[0];
    }
    const insertRes = await pool.query(
        'INSERT INTO wa_segments (name) VALUES ($1) RETURNING *',
        [trimmed]
    );
    if (insertRes.rows && insertRes.rows.length > 0) {
        return insertRes.rows[0];
    }
    const fetchRes = await pool.query('SELECT * FROM wa_segments WHERE name = $1 LIMIT 1', [trimmed]);
    return fetchRes.rows[0];
}

/**
 * Supprime un segment et dissocie les contacts.
 * @param {number|string} id
 * @returns {Promise<object>}
 */
async function deleteSegment(id) {
    await pool.query('UPDATE wa_contacts SET segment_id = NULL WHERE segment_id = $1', [id]);
    await pool.query('DELETE FROM wa_segments WHERE id = $1', [id]);
    return { success: true };
}

/**
 * Liste les contacts avec filtres optionnels.
 * @param {object} [filters]
 * @returns {Promise<Array<object>>}
 */
async function listContacts({ segmentId, segment_id, listId, list_id, status, search, limit = 100, offset = 0 } = {}) {
    const sId = segmentId ?? segment_id;
    const lId = listId ?? list_id;
    const conditions = [];
    const params = [];

    if (sId != null && sId !== '') {
        params.push(sId);
        conditions.push(`c.segment_id = $${params.length}`);
    }
    if (lId != null && lId !== '') {
        params.push(lId);
        conditions.push(`c.list_id = $${params.length}`);
    }
    if (status) {
        params.push(status);
        conditions.push(`c.status = $${params.length}`);
    }
    if (search && search.trim() !== '') {
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm, searchTerm, searchTerm);
        const p3 = params.length;
        const p2 = p3 - 1;
        const p1 = p3 - 2;
        conditions.push(`(c.name LIKE $${p1} OR c.phone LIKE $${p2} OR c.email LIKE $${p3})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 100, 1000));
    const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

    params.push(safeLimit);
    const limitIdx = params.length;
    params.push(safeOffset);
    const offsetIdx = params.length;

    const queryText = `
        SELECT c.*, s.name as segment_name, l.name as list_name
        FROM wa_contacts c
        LEFT JOIN wa_segments s ON c.segment_id = s.id
        LEFT JOIN wa_contact_lists l ON c.list_id = l.id
        ${whereClause}
        ORDER BY c.id DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await pool.query(queryText, params);
    return result.rows || [];
}

/**
 * Récupère un contact par son ID.
 * @param {number|string} id
 * @returns {Promise<object>}
 */
async function getContact(id) {
    const result = await pool.query(`
        SELECT c.*, s.name as segment_name, l.name as list_name
        FROM wa_contacts c
        LEFT JOIN wa_segments s ON c.segment_id = s.id
        LEFT JOIN wa_contact_lists l ON c.list_id = l.id
        WHERE c.id = $1
    `, [id]);
    if (!result.rows || result.rows.length === 0) {
        const err = new Error('Contact introuvable.');
        err.statusCode = 404;
        throw err;
    }
    return result.rows[0];
}

/**
 * Crée un contact avec validation du téléphone.
 * @param {object} params
 * @returns {Promise<object>}
 */
async function createContact({ name, phone, email, address, segmentId, segment_id, listId, list_id, status } = {}) {
    if (!phone || typeof phone !== 'string' || phone.trim() === '') {
        const err = new Error('Le numéro de téléphone est obligatoire.');
        err.statusCode = 400;
        throw err;
    }
    const cleanPhone = phone.trim();
    const sId = segmentId ?? segment_id ?? null;
    const lId = listId ?? list_id ?? null;

    const existing = await pool.query('SELECT id FROM wa_contacts WHERE phone = $1 LIMIT 1', [cleanPhone]);
    if (existing.rows && existing.rows.length > 0) {
        return updateContact(existing.rows[0].id, {
            name,
            phone: cleanPhone,
            email,
            address,
            segmentId: sId,
            listId: lId,
            status
        });
    }

    const cleanName = (name && typeof name === 'string' && name.trim() !== '') ? name.trim() : 'Inconnu';
    const cleanStatus = status || 'unverified';

    const insertRes = await pool.query(
        `INSERT INTO wa_contacts (name, phone, email, address, segment_id, list_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [cleanName, cleanPhone, email || null, address || null, sId, lId, cleanStatus]
    );

    if (insertRes.rows && insertRes.rows.length > 0) {
        return getContact(insertRes.rows[0].id);
    }
    const selectRes = await pool.query('SELECT * FROM wa_contacts WHERE phone = $1 ORDER BY id DESC LIMIT 1', [cleanPhone]);
    return getContact(selectRes.rows[0].id);
}

/**
 * Met à jour un contact existant.
 * @param {number|string} id
 * @param {object} updates
 * @returns {Promise<object>}
 */
async function updateContact(id, { name, phone, email, address, segmentId, segment_id, listId, list_id, status } = {}) {
    const existing = await getContact(id);
    const sId = (segmentId !== undefined || segment_id !== undefined) ? (segmentId ?? segment_id) : existing.segment_id;
    const lId = (listId !== undefined || list_id !== undefined) ? (listId ?? list_id) : existing.list_id;

    await pool.query(
        `UPDATE wa_contacts
         SET name = COALESCE($1, name),
             phone = COALESCE($2, phone),
             email = COALESCE($3, email),
             address = COALESCE($4, address),
             segment_id = $5,
             list_id = $6,
             status = COALESCE($7, status)
         WHERE id = $8`,
        [
            name !== undefined ? name : existing.name,
            phone !== undefined ? phone : existing.phone,
            email !== undefined ? email : existing.email,
            address !== undefined ? address : existing.address,
            sId,
            lId,
            status !== undefined ? status : existing.status,
            id
        ]
    );

    return getContact(id);
}

/**
 * Supprime un contact.
 * @param {number|string} id
 * @returns {Promise<object>}
 */
async function deleteContact(id) {
    await pool.query('DELETE FROM wa_contacts WHERE id = $1', [id]);
    return { success: true };
}

/**
 * Assigne une liste d'IDs de contact à un segment (ou détache si segmentId est null).
 * @param {Array<number|string>} contactIds
 * @param {number|string|null} segmentId
 * @returns {Promise<object>}
 */
async function assignContactsToSegment(contactIds, segmentId) {
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return { updatedCount: 0, segmentId: segmentId || null };
    }
    let updatedCount = 0;
    for (const cId of contactIds) {
        await pool.query('UPDATE wa_contacts SET segment_id = $1 WHERE id = $2', [segmentId || null, cId]);
        updatedCount++;
    }
    return { updatedCount, segmentId: segmentId || null };
}

module.exports = {
    listSegments,
    createSegment,
    deleteSegment,
    listContacts,
    getContact,
    createContact,
    updateContact,
    deleteContact,
    assignContactsToSegment
};
