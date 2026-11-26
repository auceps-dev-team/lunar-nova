// D1 (docs/audit.md) : la modification d'un agent personnalisé échouait.
// La clause ON CONFLICT … DO UPDATE réutilisait $2…$6, que la couche
// pg -> SQLite de db.js convertit en « ? » positionnels : 11 marqueurs pour
// 6 valeurs, et `NOT NULL constraint failed: ai_agents.name`.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';

// require() et non import : même instance de module que celle qu'utilise la
// route (voir la note de agentFallbackStrategies.test.js).
const db = require('../db');
const settingsAgentsRouter = require('../routes/settings_and_agents');

describe('routes/settings_and_agents.js — agents personnalisés', () => {
    let server;
    let baseUrl;

    const post = (body) => fetch(`${baseUrl}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    beforeAll(async () => {
        db.__setDbFileForTests(':memory:');
        await db.initDB();

        const app = express();
        app.use(express.json());
        app.use('/api', settingsAgentsRouter);
        await new Promise((resolve) => {
            server = http.createServer(app).listen(0, '127.0.0.1', () => {
                baseUrl = `http://127.0.0.1:${server.address().port}`;
                resolve();
            });
        });
    });

    afterAll(async () => {
        if (server) await new Promise((resolve) => server.close(resolve));
    });

    it('crée puis modifie un agent existant', async () => {
        const created = await post({
            id: 'agent_test_d1',
            name: 'Assistant v1',
            system_instruction: 'Instructions v1',
            response_format: 'text'
        });
        expect(created.status).toBe(200);

        const updated = await post({
            id: 'agent_test_d1',
            name: 'Assistant v2',
            system_instruction: 'Instructions v2',
            response_format: 'json',
            provider_override: 'openrouter',
            model_override: 'mistral-large'
        });
        expect(updated.status).toBe(200);

        const { rows } = await db.pool.query('SELECT * FROM ai_agents WHERE id = $1', ['agent_test_d1']);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            name: 'Assistant v2',
            system_instruction: 'Instructions v2',
            response_format: 'json',
            provider_override: 'openrouter',
            model_override: 'mistral-large'
        });
    });

    it('efface les overrides quand ils sont retirés à la modification', async () => {
        await post({ id: 'agent_test_d1_b', name: 'A', system_instruction: 'I', provider_override: 'ollama', model_override: 'llama3' });
        await post({ id: 'agent_test_d1_b', name: 'A', system_instruction: 'I', provider_override: '', model_override: '' });

        const { rows } = await db.pool.query('SELECT provider_override, model_override FROM ai_agents WHERE id = $1', ['agent_test_d1_b']);
        expect(rows[0]).toEqual({ provider_override: null, model_override: null });
    });

    it('refuse un agent sans nom ou sans instructions (400 au lieu d\'une erreur SQLite)', async () => {
        const noName = await post({ id: 'agent_test_d1_c', system_instruction: 'I' });
        expect(noName.status).toBe(400);

        const noInstructions = await post({ id: 'agent_test_d1_c', name: 'A' });
        expect(noInstructions.status).toBe(400);

        const { rows } = await db.pool.query('SELECT id FROM ai_agents WHERE id = $1', ['agent_test_d1_c']);
        expect(rows).toHaveLength(0);
    });
});
