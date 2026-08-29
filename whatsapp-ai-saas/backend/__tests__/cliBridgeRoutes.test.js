import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import cliBridgeRouter from '../routes/cliBridge';

describe('routes/cliBridge.js — Endpoints REST pour le Bridge CLI', { timeout: 30000 }, () => {
    let server;
    let baseUrl;

    beforeAll(async () => {
        const app = express();
        app.use(express.json());
        app.use('/api/cli', cliBridgeRouter);

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
        expect(body.allowedCommands).toContain('node');
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

    it('POST /api/cli/run-external rejette une requête sans nom de commande', async () => {
        const res = await fetch(`${baseUrl}/api/cli/run-external`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).toContain('Nom de commande requis');
    });

    it('POST /api/cli/settings enregistre les nouveaux réglages', async () => {
        const res = await fetch(`${baseUrl}/api/cli/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                allowed_cli_commands: 'gemini,claude,custom_cli',
                cli_timeout_seconds: 45
            })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.message).toContain('avec succès');
    });

    it('POST /api/cli/test-bridge en mode external exécute un binaire machine autorisé', async () => {
        const res = await fetch(`${baseUrl}/api/cli/test-bridge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'external',
                cliCommand: 'node',
                cliArgs: ['--version']
            })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.mode).toBe('external');
        expect(body.response).toMatch(/^v\d+/);
        expect(body.executionTimeMs).toBeGreaterThanOrEqual(0);
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
