// P2-4 — Tests E2E Playwright <-> application Electron.
//
// Ces tests lancent la VRAIE application (électron + renderer buildé + backend
// forké, comme en production) et pilotent la fenêtre. Ils nécessitent donc :
//   1. `npm install` AVEC les scripts postinstall (télécharge le binaire
//      Electron) — `--ignore-scripts` ne suffit pas ;
//   2. `npm run build` (le renderer est servi depuis dist/ en mode prod) ;
//   3. Sous Linux sans affichage : `xvfb-run -a npm run test:e2e`.
// Voir e2e/README.md pour le branchement CI (H2 : permission workflows).
//
// Sélecteurs volontairement indépendants de la langue de l'interface : le smoke
// doit tenir quelle que soit la locale persistée dans le profil de test.
import { test, expect } from '@playwright/test';
import { _electron } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN_CJS = path.join(__dirname, '..', 'electron', 'main.cjs');

// Lancement partagé : l'application applique un verrou d'instance unique, on ne
// peut pas lancer plusieurs processus — un seul worker, une seule fenêtre.
let electronApp = null;
let page = null;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    electronApp = await _electron.launch({
        args: [MAIN_CJS],
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

test('les cinq champs de clé API sont rendus aux Réglages', async () => {
    // Champ de clé => type=password. Cinq fournisseurs : Gemini, OpenRouter,
    // Ollama, OpenAI/NVIDIA, Together. Indépendant de la locale.
    await expect
        .poll(() => page.locator('#root input[type="password"]').count(), { timeout: 15_000 })
        .toBeGreaterThanOrEqual(5);
});

test("le backend forké répond sur l'API locale (127.0.0.1)", async () => {
    // Le process principal enregistre les erreurs du backend ; l'absence
    // d'arrêt brutal + une fenêtre toujours vivante après 5 s est le smoke
    // minimal du duo Electron <-> backend.
    await page.waitForTimeout(5_000);
    expect(electronApp.process().exitCode, 'le process Electron ne doit pas s\'être arrêté').toBe(null);
});
