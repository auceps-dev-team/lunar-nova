const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db');
const {
    detectInstalledClis,
    executeExternalCli,
    getAllowedCommands,
    DEFAULT_ALLOWED_COMMANDS
} = require('../services/externalAgentRunner');
const pkg = require('../../package.json');

/**
 * GET /api/cli/status
 * Renvoie le statut complet du bridge CLI, la liste des commandes autorisées et les outils système détectés.
 */
router.get('/status', async (req, res) => {
    try {
        const allowedCommands = Array.from(await getAllowedCommands());
        const installedClis = await detectInstalledClis();
        const binPath = path.resolve(__dirname, '../../bin/wacopilote.cjs');

        res.json({
            success: true,
            version: pkg.version,
            binPath,
            allowedCommands,
            defaultAllowedCommands: DEFAULT_ALLOWED_COMMANDS,
            installedClis
        });
    } catch (err) {
        console.error('[CliBridge] Erreur status:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/cli/mcp-config
 * Génère le bloc de configuration MCP à insérer dans Cursor, Claude Code ou Antigravity.
 */
router.get('/mcp-config', async (req, res) => {
    try {
        const binPath = path.resolve(__dirname, '../../bin/wacopilote.cjs');
        const config = {
            mcpServers: {
                wacopilote: {
                    command: 'node',
                    args: [binPath, 'mcp']
                }
            }
        };

        res.json({
            success: true,
            config,
            formattedString: JSON.stringify(config, null, 2)
        });
    } catch (err) {
        console.error('[CliBridge] Erreur mcp-config:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/cli/run-external
 * Exécute une commande d'un agent CLI externe installé sur la machine.
 */
router.post('/run-external', async (req, res) => {
    const { command, args = [], input = '', timeout = 30000 } = req.body || {};

    if (!command || typeof command !== 'string') {
        return res.status(400).json({ success: false, error: 'Nom de commande requis.' });
    }

    try {
        const result = await executeExternalCli({
            command,
            args: Array.isArray(args) ? args : [],
            input: typeof input === 'string' ? input : '',
            timeout: Math.min(120000, Math.max(1000, Number(timeout) || 30000))
        });

        res.json(result);
    } catch (err) {
        console.error('[CliBridge] Erreur run-external:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/cli/settings
 * Met à jour les réglages de sécurité du bridge CLI (commandes autorisées, timeout par défaut).
 */
router.post('/settings', async (req, res) => {
    const { allowed_cli_commands, cli_timeout_seconds } = req.body || {};

    try {
        if (allowed_cli_commands !== undefined) {
            await db.setSetting('allowed_cli_commands', String(allowed_cli_commands));
        }
        if (cli_timeout_seconds !== undefined) {
            await db.setSetting('cli_timeout_seconds', String(cli_timeout_seconds));
        }

        res.json({ success: true, message: 'Paramètres CLI enregistrés avec succès.' });
    } catch (err) {
        console.error('[CliBridge] Erreur settings:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
