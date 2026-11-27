// P2-4 — Tests E2E Playwright <-> application Electron.
//
// Ces tests lancent la VRAIE application (électron + renderer buildé + backend
// forké, comme en production) et pilotent la fenêtre. Ils nécessitent donc :
//   1. le binaire Electron : depuis Electron 42, `npm install` ne le télécharge
//      plus — lancer `npx install-electron` après l'installation ;
//   2. `npm run build` (le renderer est servi depuis dist/ en mode prod) ;
//   3. Sous Linux sans affichage : `xvfb-run -a npm run test:e2e`.
// Voir e2e/README.md pour le branchement CI (H2 : permission workflows).
//
// Sélecteurs volontairement indépendants de la langue de l'interface : le smoke
// doit tenir quelle que soit la locale persistée dans le profil de test.
import { test, expect } from '@playwright/test';
import { _electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN_CJS = path.join(__dirname, '..', 'electron', 'main.cjs');

// Lancement partagé : l'application applique un verrou d'instance unique, on ne
// peut pas lancer plusieurs processus — un seul worker, une seule fenêtre.
let electronApp = null;
let page = null;
let userDataDir = null;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    // Dossier de données jetable. Sans lui, le test ouvrait le profil de
    // l'application installée (%APPDATA%/WaCopilote) : base, clé maître et
    // profil Chromium réels, qu'une version plus récente d'Electron peut
    // migrer de façon irréversible pour la version installée.
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wacopilote-e2e-'));
    electronApp = await _electron.launch({
        args: [`--user-data-dir=${userDataDir}`, MAIN_CJS],
        // NODE_ENV absent => mode production : loadFile(dist/index.html) et le
        // backend est forké par main.cjs, exactement comme chez l'utilisateur.
        env: { ...process.env, NODE_ENV: '' },
    });
    page = await electronApp.firstWindow();
    page.on('crash', () => { throw new Error('Le processus renderer a planté'); });
    await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
    if (electronApp) await electronApp.close();
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
});

test("l'application utilise le dossier de données du test", async () => {
    const actual = await electronApp.evaluate(({ app }) => app.getPath('userData'));
    expect(path.resolve(actual)).toBe(path.resolve(userDataDir));
});

test("l'application démarre et monte le renderer React", async () => {
    // Le <title> du gabarit est vide : on ancre sur le montage de React.
    await expect
        .poll(() => page.evaluate(() => document.querySelector('#root')?.children.length || 0), { timeout: 30_000 })
        .toBeGreaterThan(0);
});

test("la navigation interne (HashRouter) mène à la page Réglages", async () => {
    await page.evaluate(() => { window.location.hash = '#/settings'; });
    // Un titre de page apparaît (h1/h2 du panneau Réglages), quelle que soit la langue.
    await expect
        .poll(() => page.evaluate(() => document.querySelectorAll('#root h1, #root h2').length), { timeout: 15_000 })
        .toBeGreaterThan(0);
});

test('le champ de clé API du fournisseur sélectionné est rendu aux Réglages', async () => {
    // Champ de clé => type=password, indépendant de la locale. La page n'affiche
    // que le champ du fournisseur sélectionné (Gemini sur un profil neuf) :
    // l'attente initiale de cinq champs simultanés ne correspondait pas à
    // l'interface, qui les rend conditionnellement depuis mars 2026.
    await expect
        .poll(() => page.locator('#root input[type="password"]').count(), { timeout: 15_000 })
        .toBeGreaterThanOrEqual(1);
});

test("le backend forké répond sur l'API locale (127.0.0.1)", async () => {
    // Requête réelle depuis le renderer (qui ajoute le jeton API) : prouve que
    // le backend lancé par utilityProcess a démarré, ouvert la base SQLite —
    // binding natif chargé dans le Node embarqué par Electron — et authentifie
    // les appels. Vérifier seulement que la fenêtre restait ouverte ne
    // détectait pas un backend mort.
    await expect
        .poll(() => page.evaluate(async () => {
            try {
                const res = await fetch('http://127.0.0.1:3000/api/settings');
                return res.status;
            } catch {
                return 0;
            }
        }), { timeout: 30_000 })
        .toBe(200);
    expect(electronApp.process().exitCode, 'le process Electron ne doit pas s\'être arrêté').toBe(null);
});

// Contenu tiers hors des fenêtres de l'application (electron/main.cjs). Le
// navigateur du système est remplacé par un enregistreur : le test n'ouvre
// jamais de vrai navigateur, et l'adresse en .invalid ne se résout pas.
const EXTERNAL = 'http://wacopilote-e2e.invalid/';

async function interceptOpenExternal() {
    await electronApp.evaluate(({ shell }) => {
        globalThis.__e2eOpened = [];
        shell.openExternal = async (url) => { globalThis.__e2eOpened.push(url); };
    });
}

test('un lien target="_blank" part dans le navigateur du système, pas dans une fenêtre Electron', async () => {
    await interceptOpenExternal();
    const windowsBefore = electronApp.windows().length;
    await page.evaluate((url) => {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }, `${EXTERNAL}lien`);
    await expect
        .poll(() => electronApp.evaluate(() => globalThis.__e2eOpened), { timeout: 10_000 })
        .toContain(`${EXTERNAL}lien`);
    expect(electronApp.windows().length).toBe(windowsBefore);
});

test('la fenêtre principale ne quitte pas la page de l\'application', async () => {
    // Elle porte le preload, donc le jeton de l'API locale : un site tiers
    // chargé ici l'obtiendrait.
    await interceptOpenExternal();
    await page.evaluate((url) => { window.location.href = url; }, `${EXTERNAL}navigation`);
    await expect
        .poll(() => electronApp.evaluate(() => globalThis.__e2eOpened), { timeout: 10_000 })
        .toContain(`${EXTERNAL}navigation`);
    expect(page.url()).toMatch(/^file:.*index\.html/);
});
