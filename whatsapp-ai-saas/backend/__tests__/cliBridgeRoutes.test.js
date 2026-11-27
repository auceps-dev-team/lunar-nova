import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import cliBridgeRouter from '../routes/cliBridge';
import settingsAgentsRouter from '../routes/settings_and_agents';
import db from '../db';

describe('routes/cliBridge.js — Endpoints REST pour le Bridge CLI', { timeout: 30000 }, () => {
    let server;
    let baseUrl;

    beforeAll(async () => {
        const app = express();
        app.use(express.json());
        app.use('/api/cli', cliBridgeRouter);
        app.use('/api', settingsAgentsRouter);

        await new Promise((resolve) => {
            server = http.createServer(app);
            server.listen(0, '127.0.0.1', () => {
                const port = server.address().port;
                baseUrl = `http://127.0.0.1:${port}`;
                resolve();
            });
        });
    });

    afterAll(async () => {
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
    });

    it('GET /api/cli/status renvoie le statut, la version et les commandes autorisées', async () => {
        const res = await fetch(`${baseUrl}/api/cli/status`);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.version).toBeDefined();
        expect(Array.isArray(body.allowedCommands)).toBe(true);
        expect(body.allowedCommands).toContain('claude');
        expect(body.allowedCommands).not.toContain('node');
        expect(body.binPath).toContain('wacopilote.cjs');
    });

    it('GET /api/cli/mcp-config renvoie la configuration JSON MCP formatée', async () => {
        const res = await fetch(`${baseUrl}/api/cli/mcp-config`);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.config).toBeDefined();
        expect(body.config.mcpServers).toBeDefined();
        expect(body.config.mcpServers.wacopilote).toBeDefined();
        expect(body.formattedString).toContain('wacopilote');
    });

    it('POST /api/cli/run-external n\'existe plus (exécution de commande libre retirée)', async () => {
        const res = await fetch(`${baseUrl}/api/cli/run-external`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'node', args: ['-e', 'console.log(1)'] })
        });

        expect(res.status).toBe(404);
    });

    it('POST /api/cli/settings enregistre le timeout', async () => {
        const res = await fetch(`${baseUrl}/api/cli/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cli_timeout_seconds: 45 })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.message).toContain('avec succès');
    });

    it('POST /api/cli/settings refuse de modifier la liste des commandes autorisées', async () => {
        const res = await fetch(`${baseUrl}/api/cli/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ allowed_cli_commands: 'powershell,cmd' })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(await db.getSetting('allowed_cli_commands', '')).not.toContain('powershell');
    });

    it('PUT /api/settings ignore allowed_cli_commands sans faire échouer le reste de l\'enregistrement', async () => {
        const res = await fetch(`${baseUrl}/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                allowed_cli_commands: 'powershell,cmd',
                default_cli_agent: 'claude'
            })
        });

        expect(res.status).toBe(200);
        expect(await db.getSetting('allowed_cli_commands', '')).not.toContain('powershell');
        expect(await db.getSetting('default_cli_agent', '')).toBe('claude');
    });

    it('POST /api/cli/test-bridge refuse le mode external (binaire et arguments libres)', async () => {
        const res = await fetch(`${baseUrl}/api/cli/test-bridge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'external',
                cliCommand: 'node',
                cliArgs: ['-e', 'console.log("SHOULD_NOT_RUN")']
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).toContain('Mode de test inconnu');
    });

    it('POST /api/cli/test-bridge en mode mcp invoque un outil MCP directement', async () => {
        const res = await fetch(`${baseUrl}/api/cli/test-bridge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'mcp',
                agent: 'list_agents',
                prompt: ''
            })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.mode).toBe('mcp');
        expect(body.command).toContain('list_agents');
        expect(body.details.personas).toBeDefined();
    });

    it('POST /api/cli/test-bridge rejette un prompt vide en mode CLI', async () => {
        const res = await fetch(`${baseUrl}/api/cli/test-bridge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'cli',
                agent: 'copywriter',
                prompt: '   '
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).toContain('prompt de test est obligatoire');
    });
});
