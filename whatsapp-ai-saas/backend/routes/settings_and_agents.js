const express = require('express');
const router = express.Router();
const { pool, setSetting } = require('../db');

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

// Réglages que l'API générique ne doit jamais écrire. `allowed_cli_commands`
// étendait la liste des binaires exécutables par le backend : l'écrire
// revenait à autoriser n'importe quelle commande. La clé est ignorée plutôt que
// refusée, parce que la page Réglages renvoie l'objet complet lu par le GET —
// une base qui contient encore cette clé ferait sinon échouer chaque
// enregistrement.
const PROTECTED_SETTINGS = new Set(['allowed_cli_commands']);

// --- Phase 15: Modularity APIs ---
router.get('/settings', async (req, res) => {
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

router.put('/settings', async (req, res) => {
    try {
        for (const [key, value] of Object.entries(req.body)) {
            if (PROTECTED_SETTINGS.has(key)) {
                continue;
            }
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

// DELETE /api/settings/:key — Supprime une clé secrète (*_api_key).
//
// Complément nécessaire de PUT /settings qui, lui, ignore les valeurs vides sur
// les secrets (une clé ne pouvait donc jamais être effacée via l'interface).
// Permet à l'UI d'offrir un bouton « Supprimer la clé » sans contourner le
// masquage du GET. Seules les clés secrètes peuvent être supprimées : les autres
// réglages n'ont pas de cycle de vie « suppression ».
router.delete('/settings/:key', async (req, res) => {
    const key = typeof req.params.key === 'string' ? req.params.key.trim() : '';
    if (!key) {
        return res.status(400).json({ error: 'Invalid key parameter.' });
    }
    if (!isSecretKey(key)) {
        return res.status(400).json({ error: 'Seules les clés API (*_api_key) peuvent être supprimées.' });
    }
    try {
        await pool.query('DELETE FROM app_settings WHERE setting_key = $1', [key]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/settings/channels-status', async (req, res) => {
    try {
        const { getExecutionChannelsStatus } = require('../services/agentFallbackRouter');
        const status = await getExecutionChannelsStatus();
        res.json({ status: 'success', data: status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /settings/quota a été retiré : il ne comptait que les images générées
// avec la clé Gemini par défaut, et la génération d'image n'existe plus.

router.get('/agents', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ai_agents');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/agents', async (req, res) => {
    const { id, name, system_instruction, response_format, provider_override, model_override } = req.body || {};
    if (!name || !system_instruction) {
        return res.status(400).json({ error: 'Le nom et les instructions système de l\'agent sont obligatoires.' });
    }
    try {
        const agentId = id || `agent_${Date.now()}`;
        // `excluded.<colonne>` désigne la valeur proposée par l'INSERT. La
        // version précédente réutilisait $2…$6 dans la clause DO UPDATE : la
        // couche pg -> SQLite de db.js convertit chaque $n en « ? » positionnel,
        // donc 11 marqueurs pour 6 valeurs, et la mise à jour d'un agent
        // existant échouait sur `NOT NULL constraint failed: ai_agents.name`.
        await pool.query(
            'INSERT INTO ai_agents (id, name, system_instruction, response_format, provider_override, model_override) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT(id) DO UPDATE SET name = excluded.name, system_instruction = excluded.system_instruction, response_format = excluded.response_format, provider_override = excluded.provider_override, model_override = excluded.model_override',
            [agentId, name, system_instruction, response_format || 'text', provider_override || null, model_override || null]
        );
        res.json({ status: 'success', id: agentId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/agents/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM ai_agents WHERE id = $1', [req.params.id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
