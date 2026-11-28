// @vitest-environment node
//
// Règles d'activation et API du Marketplace (ticket #30, PR 1) :
// GET /api/features, PUT /api/features/:id, et le module features.js derrière.
//
// Convention du projet : require, jamais import, pour partager l'instance de db.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';

const db = require('../db');
const features = require('../features');
const { fonctionnalites } = require('../featuresCatalogue');

describe('fonctionnalités — règles et API', () => {
    let server;
    let baseUrl;

    beforeAll(async () => {
        db.__setDbFileForTests(':memory:');
        expect(await db.initDB()).toBe(true);
        const app = express();
        app.use(express.json());
        app.use('/api/features', require('../routes/features'));
        await new Promise((resolve) => {
            server = http.createServer(app);
            server.listen(0, '127.0.0.1', () => {
                baseUrl = `http://127.0.0.1:${server.address().port}`;
                resolve();
            });
        });
    }, 30000);

    afterAll(async () => {
        if (server) await new Promise((resolve) => server.close(resolve));
    });

    const put = async (id, body) => {
        const res = await fetch(`${baseUrl}/api/features/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return { status: res.status, json: await res.json() };
    };
    const etatDe = async (id) => {
        const res = await fetch(`${baseUrl}/api/features`);
        return (await res.json()).data.find((f) => f.id === id).enabled;
    };

    it('GET : le catalogue complet, dans son ordre, avec l\'état de chaque fonctionnalité', async () => {
        const res = await fetch(`${baseUrl}/api/features`);
        expect(res.status).toBe(200);
        const { status, data } = await res.json();
        expect(status).toBe('success');
        expect(data.map((f) => f.id)).toEqual(fonctionnalites.map((f) => f.id));
        for (const f of data) {
            expect(typeof f.enabled).toBe('boolean');
            expect(f.surfaces).toBeTruthy();
        }
        expect(data.find((f) => f.id === 'notes-vocales').enabled).toBe(false);
        expect(data.find((f) => f.id === 'crm').enabled).toBe(true);
    });

    it('le noyau ne se désactive pas (409 FEATURE_CORE)', async () => {
        const { status, json } = await put('noyau', { enabled: false });
        expect(status).toBe(409);
        expect(json).toMatchObject({ code: 'FEATURE_CORE', feature: 'noyau' });
        expect(await features.estActive('noyau')).toBe(true);
    });

    it('désactiver une fonctionnalité dont d\'autres dépendent : 409 qui nomme les dépendantes', async () => {
        const { status, json } = await put('crm', { enabled: false });
        expect(status).toBe(409);
        expect(json.code).toBe('FEATURE_REQUIRED_BY');
        expect(json.dependantes).toEqual(['pipeline']);
        expect(await etatDe('crm')).toBe(true);
    });

    it('éteindre dans l\'ordre, puis activer avec une dépendance éteinte : 409 qui nomme les dépendances', async () => {
        expect((await put('pipeline', { enabled: false })).status).toBe(200);
        expect((await put('crm', { enabled: false })).status).toBe(200);
        expect(await features.estActive('crm')).toBe(false);

        const { status, json } = await put('pipeline', { enabled: true });
        expect(status).toBe(409);
        expect(json.code).toBe('FEATURE_DEPENDENCIES_DISABLED');
        expect(json.dependances).toEqual(['crm']);
        expect(await etatDe('pipeline')).toBe(false);

        expect((await put('crm', { enabled: true })).status).toBe(200);
        const ok = await put('pipeline', { enabled: true });
        expect(ok.status).toBe(200);
        expect(ok.json.data).toMatchObject({ id: 'pipeline', enabled: true });
    });

    it('l\'état est persistant : il est relu dans la table, pas gardé en mémoire', async () => {
        expect((await put('analyses', { enabled: false })).status).toBe(200);
        const { rows } = await db.pool.query("SELECT enabled FROM features WHERE id = 'analyses'");
        expect(Number(rows[0].enabled)).toBe(0);
        // Écriture directe dans la table (comme un autre processus) : vue aussitôt.
        await db.pool.query("UPDATE features SET enabled = 1 WHERE id = 'analyses'");
        expect(await features.estActive('analyses')).toBe(true);
        expect(await etatDe('analyses')).toBe(true);
    });

    it('activer notes-vocales exige commandes, et commandes ne s\'éteint plus tant que notes-vocales est active', async () => {
        expect((await put('notes-vocales', { enabled: true })).status).toBe(200);
        const { status, json } = await put('commandes', { enabled: false });
        expect(status).toBe(409);
        expect(json.dependantes).toEqual(['notes-vocales']);
        expect((await put('notes-vocales', { enabled: false })).status).toBe(200);
    });

    it('fonctionnalité inconnue : 404 FEATURE_UNKNOWN', async () => {
        const { status, json } = await put('n-existe-pas', { enabled: true });
        expect(status).toBe(404);
        expect(json.code).toBe('FEATURE_UNKNOWN');
        await expect(features.estActive('n-existe-pas')).rejects.toThrow(features.ErreurFonctionnalite);
    });

    it('corps invalide : 400, sans rien écrire', async () => {
        for (const body of [{}, { enabled: 'false' }, { enabled: 0 }, { enabled: null }]) {
            const { status, json } = await put('taches', body);
            expect(status, JSON.stringify(body)).toBe(400);
            expect(json.code).toBe('INVALID_BODY');
        }
        expect(await features.estActive('taches')).toBe(true);
    });
});
