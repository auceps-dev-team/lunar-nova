const express = require('express');
const router = express.Router();
const { pool, getSetting, setSetting } = require('../db');


// --- Phase 15: Modularity APIs ---
router.get('/api/settings', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM app_settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        res.json({ status: 'success', settings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/settings', async (req, res) => {
    try {
        for (const [key, value] of Object.entries(req.body)) {
            await setSetting(key, value);
        }
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/settings/quota', async (req, res) => {
    try {
        const key = await getSetting('gemini_api_key', '');
        const count = parseInt(await getSetting('gemini_image_count', '0')) || 0;
        const resetDate = await getSetting('gemini_quota_reset_date', '');
        
        res.json({
            status: 'success',
            data: {
                hasCustomKey: key !== '',
                imageUsed: count,
                imageLimit: 40,
                resetDate: resetDate
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/agents', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ai_agents');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/agents', async (req, res) => {
    const { id, name, system_instruction, response_format, provider_override, model_override } = req.body;
    try {
        const agentId = id || `agent_${Date.now()}`;
        await pool.query(
            'INSERT INTO ai_agents (id, name, system_instruction, response_format, provider_override, model_override) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT(id) DO UPDATE SET name = $2, system_instruction = $3, response_format = $4, provider_override = $5, model_override = $6',
            [agentId, name, system_instruction, response_format || 'text', provider_override || null, model_override || null]
        );
        res.json({ status: 'success', id: agentId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/agents/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM ai_agents WHERE id = $1', [req.params.id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
