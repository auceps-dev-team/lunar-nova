// @vitest-environment node
//
// Express 5 (27/11/2026) : `req.body` n'est plus initialisé à `{}` quand aucun
// analyseur ne l'a rempli (requête sans corps, ou d'un autre type). 27 lectures
// de `req.body` dans les routes le déstructurent sans garde : une requête sans
// corps y levait une TypeError, rendue en 500, au lieu du refus de validation
// attendu. server.js rétablit `{}` après les analyseurs ; ce test le vérifie
// sur le vrai serveur.
//
// Isolation : port éphémère, dossier de données créé par mkdtemp.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function portLibre() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
    });
}

describe('server.js — requête authentifiée sans corps (Express 5)', () => {
    let serveur;
    let base;
    let donnees;
    let jeton;

    beforeAll(async () => {
        donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'wacopilote-corps-absent-'));
        const port = await portLibre();
        base = `http://127.0.0.1:${port}`;
        let erreurs = '';
        serveur = spawn(process.execPath, ['backend/server.js'], {
            cwd: ROOT,
            env: { ...process.env, PORT: String(port), USER_DATA_PATH: donnees, NODE_ENV: 'test' },
            stdio: ['ignore', 'ignore', 'pipe'],
        });
        serveur.stderr.on('data', (d) => { erreurs += d; });
        // Délai large : le démarrage rivalise avec les autres fichiers de la suite.
        const limite = Date.now() + 60000;
        for (;;) {
            if (serveur.exitCode !== null) throw new Error(`backend arrêté (code ${serveur.exitCode}) :\n${erreurs.slice(-1500)}`);
            try { await fetch(`${base}/api/settings`); break; } catch { /* pas encore à l'écoute */ }
            if (Date.now() > limite) throw new Error('backend muet en 60 s (dépassement de délai, pas un échec d\'assertion).');
            await new Promise((r) => setTimeout(r, 250));
        }
        jeton = fs.readFileSync(path.join(donnees, 'api-token'), 'utf8').trim();
    }, 65000);

    afterAll(() => {
        if (serveur && !serveur.killed) serveur.kill();
        try { fs.rmSync(donnees, { recursive: true, force: true }); } catch { /* base encore ouverte */ }
    });

    it('POST sans corps : refus de validation (400), pas une erreur interne', async () => {
        const res = await fetch(`${base}/api/wa/open-chat`, { method: 'POST', headers: { Authorization: `Bearer ${jeton}` } });
        expect(res.status).toBe(400);
    });

    it('POST d\'un autre type que JSON : même refus de validation', async () => {
        const res = await fetch(`${base}/api/wa/open-chat`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'text/plain' },
            body: 'texte brut',
        });
        expect(res.status).toBe(400);
    });

    it('POST JSON : le corps arrive toujours aux routes', async () => {
        const res = await fetch(`${base}/api/wa/open-chat`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ instance_id: 'wa-tab-1', phone: 'abc' }),
        });
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/invalide/i);
    });
});
