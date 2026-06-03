const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// --- Phase 26: AI Writer Document APIs ---
router.get('/api/documents', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ai_documents ORDER BY updated_at DESC, id DESC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/documents/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ai_documents WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/documents/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM ai_documents WHERE id = $1', [req.params.id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/documents', async (req, res) => {
    const { title, content } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO ai_documents (title, content) VALUES ($1, $2) RETURNING *',
            [title || 'Untitled Document', content || '']
        );
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/documents/:id', async (req, res) => {
    const { title, content } = req.body;
    try {
        const result = await pool.query(
            'UPDATE ai_documents SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [title, content, req.params.id]
        );
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;
