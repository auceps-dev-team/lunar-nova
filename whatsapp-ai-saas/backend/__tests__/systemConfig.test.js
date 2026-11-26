// @vitest-environment node
//
// GET /api/config — clé Google Maps de la carte de prospection.
//
// Jusqu'au 26/11/2026, elle ne venait que de GOOGLE_MAPS_API_KEY, lue dans
// backend/.env — que l'installeur embarquait (mesuré ce jour-là : la clé était
// lisible dans app.asar d'une version publiée). Le .env n'est plus empaqueté :
// la clé se saisit dans les Paramètres. Ce fichier prouve l'ordre de
// résolution (réglage, puis environnement) et le chiffrement au repos.
//
// Convention du projet : require, jamais import (cf. agentFallbackStrategies).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const express = require('express');
const db = require('../db');

let server;
let base;
const envAvant = process.env.GOOGLE_MAPS_API_KEY;

const lireConfig = async () => (await (await fetch(`${base}/api/config`)).json()).googleMapsApiKey;

describe('GET /api/config — clé Google Maps', () => {
    beforeAll(async () => {
        db.__setDbFileForTests(':memory:');
        await db.initDB();
        const app = express();
        app.use('/api', require('../routes/system'));
        await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
        base = `http://127.0.0.1:${server.address().port}`;
    }, 30000);

    afterAll(async () => {
        if (envAvant === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
        else process.env.GOOGLE_MAPS_API_KEY = envAvant;
        await new Promise((r) => server.close(r));
    });

    it('sans réglage, rend la variable d\'environnement (développement)', async () => {
        process.env.GOOGLE_MAPS_API_KEY = 'cle-environnement';
        expect(await lireConfig()).toBe('cle-environnement');
    });

    it('le réglage saisi dans les Paramètres passe avant l\'environnement', async () => {
        process.env.GOOGLE_MAPS_API_KEY = 'cle-environnement';
        await db.setSetting('google_maps_api_key', 'cle-parametres');
        expect(await lireConfig()).toBe('cle-parametres');
    });

    it('le réglage est chiffré au repos, comme toute clé *_api_key', async () => {
        const brut = (await db.pool.query('SELECT setting_value FROM app_settings WHERE setting_key = $1', ['google_maps_api_key'])).rows[0].setting_value;
        expect(brut).not.toBe('cle-parametres');
        expect(brut).not.toContain('cle-parametres');
    });

    it('ni réglage ni environnement : chaîne vide, jamais undefined', async () => {
        await db.pool.query('DELETE FROM app_settings WHERE setting_key = $1', ['google_maps_api_key']);
        delete process.env.GOOGLE_MAPS_API_KEY;
        expect(await lireConfig()).toBe('');
    });
});
