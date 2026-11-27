// @vitest-environment node
//
// Carte de la prospection sans clé (27/11/2026).
//
// Jusque-là, GET /api/config transmettait une clé Google Maps à l'interface
// pour l'iframe Maps Embed. La carte s'affiche désormais dans une webview sur
// google.com/maps, sans clé : la route est retirée, et la migration v12 efface
// la clé qu'un utilisateur aurait saisie dans les Réglages en v1.51.0.
//
// Convention du projet : require, jamais import (cf. agentFallbackStrategies).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const express = require('express');
const db = require('../db');

let server;
let base;

describe('carte de la prospection sans clé', () => {
    beforeAll(async () => {
        db.__setDbFileForTests(':memory:');
        await db.initDB();

        // Base « d'avant » : une clé saisie en v1.51.0 (chiffrée au repos), v12 pas encore appliquée.
        await db.setSetting('google_maps_api_key', 'cle-saisie-en-v1-51-0');
        await db.setSetting('gemini_api_key', 'cle-gemini-a-garder');
        await db.pool.query('DELETE FROM schema_version WHERE version = 12');
        await db.__rerunInitDBForTests();

        const app = express();
        app.use('/api', require('../routes/system'));
        await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
        base = `http://127.0.0.1:${server.address().port}`;
    }, 30000);

    afterAll(async () => {
        await new Promise((r) => server.close(r));
    });

    it('GET /api/config n\'existe plus : aucune clé n\'est servie à l\'interface', async () => {
        const r = await fetch(`${base}/api/config`);
        expect(r.status).toBe(404);
    });

    it('la migration v12 efface la clé Google Maps enregistrée, et seulement elle', async () => {
        const brut = await db.pool.query('SELECT setting_key FROM app_settings WHERE setting_key = $1', ['google_maps_api_key']);
        expect(brut.rows).toEqual([]);
        expect(await db.getSetting('gemini_api_key')).toBe('cle-gemini-a-garder');
        const v = await db.pool.query('SELECT version FROM schema_version WHERE version = 12');
        expect(v.rows).toHaveLength(1);
    });
});
