// Un processus qui a seulement DÉTECTÉ le dossier de l'application installée
// (CLI, serveur MCP, backend de développement lancés sans USER_DATA_PATH) ne
// doit jamais y écrire de clé maître. Mesuré le 26/11/2026 : un simple
// `wacopilote help` y créait `master-key` en clair.
//
// Le module est chargé dans un processus séparé : resolveUserDataDir() se
// décide à partir de l'environnement au chargement, et Vitest fixe
// NODE_ENV=test et USER_DATA_PATH, qui court-circuitent justement ce cas.
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempDirs = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

// Copie du module hors du projet. Sinon, chez tout développeur qui a lancé le
// backend en local, le `master-key` de développement à la racine du projet
// (créé par ce lancement, ignoré par git, documenté dans CONTRIBUTING) est
// trouvé avant la génération en mémoire, et le test échoue sans défaut du
// code. Relevé le 27/11/2026 : vert sur un clone propre et en CI, rouge sur un
// poste de développement. Le module ne dépend que de modules Node intégrés
// (`electron` n'est chargé que si un master-key.enc existe, jamais ici).
function isolatedSecretStore() {
    const projet = fs.mkdtempSync(path.join(os.tmpdir(), 'wacopilote-secretstore-'));
    tempDirs.push(projet);
    fs.mkdirSync(path.join(projet, 'backend'));
    const copie = path.join(projet, 'backend', 'secretStore.js');
    fs.copyFileSync(path.resolve(__dirname, '..', 'secretStore.js'), copie);
    return copie;
}

function fakeInstalledApp() {
    const appData = fs.mkdtempSync(path.join(os.tmpdir(), 'wacopilote-appdata-'));
    tempDirs.push(appData);
    const appDir = path.join(appData, 'WaCopilote');
    fs.mkdirSync(appDir);
    fs.writeFileSync(path.join(appDir, 'database.sqlite'), '');
    return { appData, appDir };
}

function loadSecretStore(appData) {
    const env = { ...process.env, APPDATA: appData, XDG_CONFIG_HOME: appData, NODE_ENV: 'production' };
    for (const key of ['USER_DATA_PATH', 'WACOPILOTE_MASTER_KEY', 'WACOPILOTE_LOCAL_DB', 'VITEST', 'VITEST_POOL_ID', 'VITEST_WORKER_ID']) {
        delete env[key];
    }
    const script = `const s = require(${JSON.stringify(isolatedSecretStore())});
const v = s.decrypt(s.encrypt('secret'));
process.stdout.write(JSON.stringify({ roundTrip: v, status: s.getDecryptionStatus() }));`;
    const result = spawnSync(process.execPath, ['-e', script], { env, encoding: 'utf8', timeout: 20000 });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout);
}

describe('secretStore — dossier de l\'application installée détecté automatiquement', () => {
    it('ne crée aucune clé maître dans ce dossier, et chiffre avec une clé en mémoire', () => {
        const { appData, appDir } = fakeInstalledApp();

        const { roundTrip, status } = loadSecretStore(appData);

        expect(fs.existsSync(path.join(appDir, 'master-key'))).toBe(false);
        expect(fs.readdirSync(appDir)).toEqual(['database.sqlite']);
        expect(roundTrip).toBe('secret');
        expect(status.generatedReason).toMatch(/rien n'est écrit dans ce dossier/);
    });
});
