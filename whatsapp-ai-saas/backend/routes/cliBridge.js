const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db');
const {
    detectInstalledClis,
    executeExternalCli,
    getAllowedCommands
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

// L'ancienne route POST /api/cli/run-external, qui lançait un binaire avec des
// arguments choisis par l'appelant, a été retirée : avec node ou python dans la
// liste blanche, elle donnait l'exécution de code arbitraire à quiconque
// détenait le jeton API. Aucun écran ne l'appelait.

/**
 * POST /api/cli/test-bridge
 * Teste l'exécution du bridge CLI de manière autonome (sans dépendre des routes API cloud génériques).
 * Deux modes :
 * 1. 'cli' : Exécute le binaire local `bin/wacopilote.cjs run --agent <agent> --prompt <prompt> --json` dans un sous-processus réel.
 * 2. 'mcp' : Exécute l'outil MCP `call_agent` ou `list_agents` via `wacopiloteMcpServer.handleToolCall`.
 *
 * Le mode 'external' (binaire et arguments libres) a été retiré pour la même
 * raison que /run-external.
 */
const TEST_BRIDGE_MODES = ['cli', 'mcp'];

router.post('/test-bridge', async (req, res) => {
    const {
        mode = 'cli',
        agent = 'copywriter',
        prompt = '',
        provider = null,
        model = null
    } = req.body || {};

    if (!TEST_BRIDGE_MODES.includes(mode)) {
        return res.status(400).json({
            success: false,
            error: `Mode de test inconnu : '${mode}'. Modes acceptés : ${TEST_BRIDGE_MODES.join(', ')}.`
        });
    }

    const startTime = Date.now();
    const binPath = path.resolve(__dirname, '../../bin/wacopilote.cjs');

    try {
        if (mode === 'mcp') {
            const { handleToolCall } = require('../mcp/wacopiloteMcpServer');
            let mcpResult;
            let commandStr;

            if (agent === 'list_agents') {
                mcpResult = await handleToolCall('list_agents', {});
                commandStr = 'mcp://tools/call?name=list_agents';
            } else {
                if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
                    return res.status(400).json({ success: false, error: 'Un prompt de test est obligatoire.' });
                }
                mcpResult = await handleToolCall('call_agent', {
                    agent,
                    prompt: prompt.trim(),
                    provider: provider || undefined,
                    model: model || undefined
                });
                commandStr = `mcp://tools/call?name=call_agent&agent=${agent}`;
            }

            const responseText = typeof mcpResult === 'string'
                ? mcpResult
                : (mcpResult.response || mcpResult.content || JSON.stringify(mcpResult, null, 2));

            return res.json({
                success: true,
                mode: 'mcp',
                command: commandStr,
                executionTimeMs: Date.now() - startTime,
                response: responseText,
                details: mcpResult
            });
        }

        // Mode 'cli' par défaut : lance réellement `node bin/wacopilote.cjs run ...`
        if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
            return res.status(400).json({ success: false, error: 'Un prompt de test est obligatoire.' });
        }

        const args = [binPath, 'run', '--agent', agent, '--prompt', prompt.trim(), '--json'];
        if (provider) {
            args.push('--provider', provider);
        }
        if (model) {
            args.push('--model', model);
        }

        const cliResult = await executeExternalCli({
            command: 'node',
            args,
            timeout: 30000,
            skipAllowanceCheck: true
        });

        let parsedOutput = null;
        try {
            const jsonStart = cliResult.stdout.indexOf('{');
            if (jsonStart !== -1) {
                parsedOutput = JSON.parse(cliResult.stdout.slice(jsonStart));
            }
        } catch {
            // Ignorer l'erreur de parsing JSON si la sortie est en texte brut
        }

        const commandDisplay = `node bin/wacopilote.cjs run --agent ${agent} --prompt "${prompt.trim().replace(/"/g, '\\"')}"${provider ? ` --provider ${provider}` : ''}`;

        return res.json({
            success: cliResult.success && (!parsedOutput || parsedOutput.success !== false),
            mode: 'cli',
            command: commandDisplay,
            executionTimeMs: Date.now() - startTime,
            response: (parsedOutput && (parsedOutput.response || parsedOutput.message || parsedOutput.result))
                || cliResult.stdout
                || cliResult.stderr
                || cliResult.error,
            details: parsedOutput || cliResult
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
            executionTimeMs: Date.now() - startTime
        });
    }
});

/**
 * POST /api/cli/settings
 * Met à jour les réglages du bridge CLI (timeout par défaut).
 *
 * La liste des commandes autorisées n'est plus modifiable : elle est fixée
 * dans externalAgentRunner.js (ALLOWED_COMMANDS).
 */
router.post('/settings', async (req, res) => {
    const { allowed_cli_commands, cli_timeout_seconds } = req.body || {};

    if (allowed_cli_commands !== undefined) {
        return res.status(400).json({
            success: false,
            error: 'La liste des commandes CLI autorisées est fixe et ne peut pas être modifiée.'
        });
    }

    try {
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
