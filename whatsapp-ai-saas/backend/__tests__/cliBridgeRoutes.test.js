import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import cliBridgeRouter from '../routes/cliBridge';

describe('routes/cliBridge.js — Endpoints REST pour le Bridge CLI', { timeout: 15000 }, () => {
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
});
