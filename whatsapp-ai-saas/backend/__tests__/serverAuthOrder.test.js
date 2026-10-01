import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs';
import os from 'os';
import path from 'path';

// L'ordre des middlewares de server.js, éprouvé sur un vrai serveur.
//
// Mesuré le 1er octobre 2026 : l'authentification était placée APRÈS l'analyse
// des corps. Un JSON malformé sans jeton renvoyait 400 — preuve que le corps
// était lu avant le contrôle — et 20 Mo sans jeton étaient analysés avant le
// refus. L'origine `null` étant autorisée, une iframe sandboxée de n'importe
// quel site pouvait le déclencher. Une origine refusée, elle, produisait un 500
// avec trace de pile.
//
// Isolation : port éphémère et dossier de données créé par mkdtemp — jamais le
// port 3000 ni la base de développement.

const ROOT = path.resolve(__dirname, '..', '..');

function freePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => {
            const { port } = srv.address();
            srv.close(() => resolve(port));
        });
    });
}

// Délai de démarrage volontairement large. Mesuré le 1er octobre 2026 : ~3,6 s
// seul, mais plus de 18 s pendant la suite complète, où ce démarrage (chargement
// de tous les modules, migrations) rivalise avec 33 autres fichiers. Attendre
// plus longtemps ne coûte rien quand le serveur répond vite ; un plafond trop
// court, lui, fabriquait un faux échec. Un vrai plantage est détecté à part,
// tout de suite, avec la sortie d'erreur du serveur.
const BOOT_DEADLINE_MS = 60000;

async function waitForServer(base, child, stderr, deadlineMs) {
    const until = Date.now() + deadlineMs;
    while (Date.now() < until) {
        if (child.exitCode !== null) {
            throw new Error(
                `Le serveur s'est arrêté (code ${child.exitCode}) avant de répondre :\n${stderr().slice(-1500)}`
            );
        }
        try {
            await fetch(`${base}/api/settings`);
            return;
        } catch { /* pas encore à l'écoute */ }
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Le serveur n'a pas répondu en ${deadlineMs} ms (dépassement de délai, pas un échec d'assertion).`);
}

describe('server.js — ordre authentification / analyse des corps', () => {
    let child;
    let base;
    let dataDir;

    beforeAll(async () => {
        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wacopilote-authorder-'));
        const port = await freePort();
        base = `http://127.0.0.1:${port}`;
        let errOutput = '';
        child = spawn(process.execPath, ['backend/server.js'], {
            cwd: ROOT,
            env: { ...process.env, PORT: String(port), USER_DATA_PATH: dataDir, NODE_ENV: 'test' },
            stdio: ['ignore', 'ignore', 'pipe']
        });
        child.stderr.on('data', (d) => { errOutput += d; });
        await waitForServer(base, child, () => errOutput, BOOT_DEADLINE_MS);
    }, BOOT_DEADLINE_MS + 5000);

    afterAll(() => {
        if (child && !child.killed) child.kill();
        try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* fichier encore verrouillé */ }
    });

    it('rejette sans jeton AVANT de lire le corps : un JSON malformé donne 401, pas 400', async () => {
        const res = await fetch(`${base}/api/settings`, {
            method: 'POST',
            headers: { Origin: 'null', 'Content-Type': 'application/json' },
            body: '{invalide'
        });
        expect(res.status).toBe(401);
    });

    it('rejette une origine étrangère par un 403 propre, pas par une erreur 500', async () => {
        const res = await fetch(`${base}/api/settings`, {
            method: 'POST',
            headers: { Origin: 'https://exemple-malveillant.test', 'Content-Type': 'application/json' },
            body: '{}'
        });
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: 'Origine non autorisée.' });
    });

    it('laisse passer une requête authentifiée', async () => {
        const token = fs.readFileSync(path.join(dataDir, 'api-token'), 'utf8').trim();
        const res = await fetch(`${base}/api/settings`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ audit_probe: 'ok' })
        });
        expect(res.status).toBe(200);
    });
});
