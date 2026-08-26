/**
 * Smoke test E2E (P2-4) — NON exécuté par `vitest run`.
 *
 * Lancer via : `xvfb-run -a npx playwright test e2e/smoke.playwright.js`
 * (nécessite `npx playwright install --with-deps chromium`).
 *
 * Ce fichier sert de squelette : il vérifie le démarrage de l'app et la présence
 * de la webview WhatsApp, point de départ des tests d'interaction Playwright <-> webview
 * décrits dans le plan P2-4. Il n'est pas ramassé par Vitest (extension
 * `.playwright.js`).
 */
const { test, expect } = require('@playwright/test');

test.describe('WaCopilote — smoke', () => {
    test('la fenêtre principale se charge', async ({ page }) => {
        // `baseURL` est fourni par la config Playwright (ex. l'URL de la webview
        // ou `file://` de l'app packagée).
        await page.goto(process.env.E2E_BASE_URL || 'http://localhost:5173');
        await expect(page).toHaveTitle(/WaCopilote/i);
    });
});
