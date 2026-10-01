// @vitest-environment node
//
// Placeholders `$n` de l'adaptateur PostgreSQL → SQLite (db.js).
//
// Mesuré le 1er octobre 2026 : l'adaptateur remplaçait chaque `$n` par `?` en
// gardant les paramètres dans l'ordre d'origine. Un placeholder répété recevait
// la valeur suivante ou NULL ; des placeholders hors d'ordre échangeaient leurs
// valeurs. Conséquence relevée : modifier un agent personnalisé (POST
// /api/agents, « ON CONFLICT DO UPDATE SET name = $2, … ») échouait à chaque
// fois sur « NOT NULL constraint failed: ai_agents.name ».
//
// Convention du projet : require, jamais import (cf. agentFallbackStrategies).
import { describe, it, expect, beforeAll } from 'vitest';

const db = require('../db');

// La requête exacte de routes/settings_and_agents.js (POST /api/agents).
const UPSERT_AGENT = 'INSERT INTO ai_agents (id, name, system_instruction, response_format, provider_override, model_override) '
    + 'VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT(id) DO UPDATE SET name = $2, system_instruction = $3, '
    + 'response_format = $4, provider_override = $5, model_override = $6';
const READ_AGENT = 'SELECT name, system_instruction, response_format, provider_override, model_override FROM ai_agents WHERE id = $1';

describe('db.pool — placeholders $n à la sémantique PostgreSQL', () => {
    beforeAll(async () => {
        db.__setDbFileForTests(':memory:');
        await db.initDB();
    }, 30000);

    it('un placeholder RÉPÉTÉ reçoit la même valeur : la modification d\'un agent existant aboutit', async () => {
        await db.pool.query(UPSERT_AGENT, ['agent_rep', 'Nom initial', 'Consigne initiale', 'text', null, null]);
        await db.pool.query(UPSERT_AGENT, ['agent_rep', 'Nom modifié', 'Consigne modifiée', 'json', 'openai', 'm-1']);

        const r = await db.pool.query(READ_AGENT, ['agent_rep']);
        expect(r.rows[0]).toEqual({
            name: 'Nom modifié',
            system_instruction: 'Consigne modifiée',
            response_format: 'json',
            provider_override: 'openai',
            model_override: 'm-1'
        });
    });

    it('des placeholders HORS D\'ORDRE ne s\'échangent pas leurs valeurs', async () => {
        await db.pool.query(UPSERT_AGENT, ['agent_ordre', 'Avant', 'c', 'text', null, null]);
        await db.pool.query(UPSERT_AGENT, ['agent_temoin', 'Témoin', 'c', 'text', null, null]);

        // $2 avant $1 : l'ancien adaptateur aurait écrit l'identifiant dans
        // `name` et cherché la ligne par le nom.
        await db.pool.query('UPDATE ai_agents SET name = $2 WHERE id = $1', ['agent_ordre', 'Après']);

        expect((await db.pool.query(READ_AGENT, ['agent_ordre'])).rows[0].name).toBe('Après');
        expect((await db.pool.query(READ_AGENT, ['agent_temoin'])).rows[0].name).toBe('Témoin');
    });

    it('les requêtes aux placeholders ordonnés se comportent comme avant', async () => {
        await db.pool.query(
            'INSERT INTO ai_agents (id, name, system_instruction) VALUES ($1, $2, $3)',
            ['agent_ordinaire', 'Ordinaire', 'consigne']
        );
        const r = await db.pool.query('SELECT name FROM ai_agents WHERE id = $1 AND name = $2', ['agent_ordinaire', 'Ordinaire']);
        expect(r.rows).toEqual([{ name: 'Ordinaire' }]);
    });

    it('une requête sans placeholder reçoit ses paramètres tels quels', async () => {
        const r = await db.pool.query('SELECT 1 AS un');
        expect(r.rows).toEqual([{ un: 1 }]);
    });
});
