const express = require('express');
const router = express.Router();
const { pool, getSetting, setSetting } = require('../db');

// --- Masquage des secrets ---
// Les clés d'API ne sortent jamais du backend : le GET renvoie une chaîne vide et
// signale séparément, via `secretsSet`, lesquelles sont renseignées (pour que l'UI
// puisse afficher « configurée »).
//
// Côté PUT, une valeur vide sur une clé secrète signifie « champ non modifié » et
// n'écrase rien. Une première implémentation renvoyait un masque « ••••1234 » servant
// de sentinelle ; test à l'appui, le préfixe Unicode ne survit pas systématiquement au
// transit et la vraie clé se faisait écraser par le masque. Une sentinelle vide, elle,
// ne peut pas être corrompue en route.
//
// Contrepartie assumée : effacer une clé ne peut plus se faire en vidant le champ.
// L'UI n'offre de toute façon pas cette action aujourd'hui ; il faudra un bouton
// « Supprimer la clé » dédié le jour où le besoin se pose.
const isSecretKey = (key) => key.endsWith('_api_key');

// --- Phase 15: Modularity APIs ---
router.get('/api/settings', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM app_settings');
        const settings = {};
        const secretsSet = {};
        result.rows.forEach(row => {
            if (isSecretKey(row.setting_key)) {
                settings[row.setting_key] = '';
                secretsSet[row.setting_key] = !!row.setting_value;
            } else {
                settings[row.setting_key] = row.setting_value;
            }
        });
        res.json({ status: 'success', settings, secretsSet });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/settings', async (req, res) => {
    try {
        for (const [key, value] of Object.entries(req.body)) {
            if (isSecretKey(key) && (value === '' || value === null || value === undefined)) {
                continue; // Champ laissé tel quel par l'utilisateur.
            }
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
