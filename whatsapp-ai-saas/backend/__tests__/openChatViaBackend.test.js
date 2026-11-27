// @vitest-environment node
//
// CLI et MCP (27/11/2026) : le port de débogage fermé, ils n'atteignent plus
// les webviews directement. openChat, hors du backend, demande l'ouverture à
// l'application par son API authentifiée. Faux backend sur port éphémère,
// dossier de données temporaire (mkdtemp) : rien de partagé.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const waInstancesService = require('../services/waInstancesService');

let serveur;
let recu;
let dossier;
const envAvant = { USER_DATA_PATH: process.env.USER_DATA_PATH, WACOPILOTE_API_URL: process.env.WACOPILOTE_API_URL };

describe('openChat depuis le CLI ou le MCP — par l\'API de l\'application', () => {
    beforeAll(async () => {
        const app = express();
        app.use(express.json());
        app.post('/api/wa/open-chat', (req, res) => {
            recu = { auth: req.headers.authorization, corps: req.body };
            if (req.headers.authorization !== 'Bearer jeton-de-test') return res.status(401).json({ error: 'Unauthorized' });
            res.json({ status: 'success', message: 'Chat opened', formattedMessage: req.body.text || '' });
        });
        await new Promise((r) => { serveur = app.listen(0, '127.0.0.1', r); });
        process.env.WACOPILOTE_API_URL = `http://127.0.0.1:${serveur.address().port}`;
    });

    beforeEach(() => {
        recu = null;
        dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'wacopilote-openchat-'));
        process.env.USER_DATA_PATH = dossier;
    });

    afterAll(async () => {
        await new Promise((r) => serveur.close(r));
        for (const [k, v] of Object.entries(envAvant)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    });

    it('transmet la demande avec le jeton du dossier de l\'application', async () => {
        fs.writeFileSync(path.join(dossier, 'api-token'), 'jeton-de-test');
        const r = await waInstancesService.openChat({ instanceId: 'wa-tab-1', phone: '+2250700000000', text: 'Bonjour' });
        expect(r).toEqual({ message: 'Chat opened', formattedMessage: 'Bonjour' });
        expect(recu.auth).toBe('Bearer jeton-de-test');
        expect(recu.corps).toMatchObject({ instance_id: 'wa-tab-1', phone: '+2250700000000', text: 'Bonjour' });
    });

    it('rend le code et le message d\'erreur de l\'application', async () => {
        fs.writeFileSync(path.join(dossier, 'api-token'), 'mauvais-jeton');
        await expect(waInstancesService.openChat({ instanceId: 'wa-tab-1', phone: '2250700000000' }))
            .rejects.toMatchObject({ statusCode: 401, message: 'Unauthorized' });
    });

    it('application fermée : un message qui le dit, code 503', async () => {
        fs.writeFileSync(path.join(dossier, 'api-token'), 'jeton-de-test');
        const avant = process.env.WACOPILOTE_API_URL;
        process.env.WACOPILOTE_API_URL = 'http://127.0.0.1:9';
        try {
            await expect(waInstancesService.openChat({ instanceId: 'wa-tab-1', phone: '2250700000000' }))
                .rejects.toMatchObject({ statusCode: 503, message: expect.stringMatching(/injoignable/) });
        } finally {
            process.env.WACOPILOTE_API_URL = avant;
        }
    });

    it('n\'emploie pas fetch (sa sortie plantait le CLI sous Windows)', async () => {
        fs.writeFileSync(path.join(dossier, 'api-token'), 'jeton-de-test');
        const fetchAvant = globalThis.fetch;
        globalThis.fetch = () => { throw new Error('fetch ne doit pas servir ici'); };
        try {
            const r = await waInstancesService.openChat({ instanceId: 'wa-tab-1', phone: '2250700000000' });
            expect(r.message).toBe('Chat opened');
        } finally {
            globalThis.fetch = fetchAvant;
        }
    });

    it('réponse non JSON : le code HTTP est rendu', async () => {
        fs.writeFileSync(path.join(dossier, 'api-token'), 'jeton-de-test');
        const brut = require('http').createServer((req, res) => { req.resume(); res.statusCode = 502; res.end('Bad Gateway'); });
        await new Promise((r) => brut.listen(0, '127.0.0.1', r));
        const avant = process.env.WACOPILOTE_API_URL;
        process.env.WACOPILOTE_API_URL = `http://127.0.0.1:${brut.address().port}`;
        try {
            await expect(waInstancesService.openChat({ instanceId: 'wa-tab-1', phone: '2250700000000' }))
                .rejects.toMatchObject({ statusCode: 502, message: 'Réponse HTTP 502 de l\'application' });
        } finally {
            process.env.WACOPILOTE_API_URL = avant;
            await new Promise((r) => brut.close(r));
        }
    });

    it('un numéro invalide est refusé avant tout appel', async () => {
        await expect(waInstancesService.openChat({ instanceId: 'wa-tab-1', phone: 'abc' }))
            .rejects.toMatchObject({ statusCode: 400 });
        expect(recu).toBeNull();
    });
});
