// @vitest-environment node
//
// Sortie du CLI (27/11/2026). Un process.exit() immédiat après un fetch faisait
// planter le CLI sous Windows (assertion libuv src\win\async.c, code
// 3221226505) : mesuré 8 fois sur 8 contre le backend lancé seul, 0 sur 8 en
// sortie naturelle. Le CLI sort désormais naturellement (terminerCommande).
//
// Isolation : dossiers créés par mkdtemp, port éphémère — jamais le port 3000
// ni la base de développement.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BIN = path.join(ROOT, 'bin', 'wacopilote.cjs');
const HELPERS = path.join(ROOT, 'bin', 'lib', 'helpers.cjs');

let dossier;
beforeAll(() => { dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'wacopilote-cli-sortie-')); });
afterAll(() => { try { fs.rmSync(dossier, { recursive: true, force: true }); } catch { /* base encore ouverte */ } });

// Préchargé dans le CLI : consigne tout appel à process.exit.
function preparerEspion() {
    const espion = path.join(dossier, 'espion-exit.cjs');
    fs.writeFileSync(espion, `
const fs = require('fs');
const reel = process.exit;
process.exit = function (code) { fs.appendFileSync(process.env.JOURNAL_EXIT, 'exit(' + code + ')\\n'); return reel.call(process, code); };
`);
    return espion;
}

describe('CLI — sortie naturelle', { timeout: 60000 }, () => {
    it.each([
        [['--version'], 0],
        [['instances', 'list', '--json'], 0],
        [['commande_inconnue_xyz'], 1],
    ])('%j sort avec le code attendu, sans process.exit sur le chemin normal', (args, attendu) => {
        const espion = preparerEspion();
        const journal = path.join(dossier, `exit-${args.join('-')}.log`);
        const r = spawnSync(process.execPath, ['-r', espion, BIN, ...args], {
            env: { ...process.env, USER_DATA_PATH: dossier, JOURNAL_EXIT: journal },
            encoding: 'utf8',
            timeout: 30000,
        });
        expect(r.status).toBe(attendu);
        const appels = fs.existsSync(journal) ? fs.readFileSync(journal, 'utf8') : '';
        // La commande inconnue garde son process.exit(1) explicite ; les autres
        // finissent sans aucun appel.
        if (attendu === 0) expect(appels).toBe('');
    });
});

function portLibre() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
    });
}

describe.skipIf(process.platform !== 'win32')('CLI — fetch vers le backend puis sortie (Windows)', () => {
    let serveur;
    let base;
    let donnees;

    beforeAll(async () => {
        donnees = fs.mkdtempSync(path.join(os.tmpdir(), 'wacopilote-cli-sortie-backend-'));
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
    }, 65000);

    afterAll(() => {
        if (serveur && !serveur.killed) serveur.kill();
        try { fs.rmSync(donnees, { recursive: true, force: true }); } catch { /* base encore ouverte */ }
    });

    it('un fetch suivi de terminerCommande sort avec le code 0, quatre fois sur quatre', () => {
        const jeton = fs.readFileSync(path.join(donnees, 'api-token'), 'utf8').trim();
        const script = `
const { terminerCommande } = require(${JSON.stringify(HELPERS)});
fetch(${JSON.stringify(`${base}/api/wa/selectors`)}, { headers: { Authorization: 'Bearer ' + ${JSON.stringify(jeton)} } })
    .then((r) => r.text().then(() => { process.stdout.write(r.status + '\\n'); terminerCommande(0); }))
    .catch((e) => { console.error(e.message); terminerCommande(1); });
`;
        const codes = [];
        for (let i = 0; i < 4; i++) {
            const r = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 30000 });
            codes.push(`${r.status}/${r.stdout.trim()}`);
        }
        expect(codes).toEqual(['0/200', '0/200', '0/200', '0/200']);
    }, 60000);
});
