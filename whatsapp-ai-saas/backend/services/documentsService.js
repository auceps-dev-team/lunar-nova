const { pool } = require('../db');

async function listDocuments() {
    const result = await pool.query('SELECT * FROM ai_documents ORDER BY updated_at DESC, id DESC');
    return result.rows;
}

async function getDocument(id) {
    const result = await pool.query('SELECT * FROM ai_documents WHERE id = $1', [id]);
    if (result.rows.length === 0) {
        const err = new Error('Document introuvable.');
        err.statusCode = 404;
        throw err;
    }
    return result.rows[0];
}

async function createDocument({ title, content } = {}) {
    const result = await pool.query(
        'INSERT INTO ai_documents (title, content) VALUES ($1, $2) RETURNING *',
        [title || 'Untitled Document', content || '']
    );
    return result.rows[0];
}

async function updateDocument(id, { title, content } = {}) {
    const result = await pool.query(
        'UPDATE ai_documents SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
        [title, content, id]
    );
    if (result.rows.length === 0) {
        const err = new Error('Document introuvable.');
        err.statusCode = 404;
        throw err;
    }
    return result.rows[0];
}

async function deleteDocument(id) {
    await pool.query('DELETE FROM ai_documents WHERE id = $1', [id]);
    return { success: true };
}

module.exports = { listDocuments, getDocument, createDocument, updateDocument, deleteDocument };
