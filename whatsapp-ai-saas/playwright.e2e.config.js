// Configuration Playwright dédiée aux tests E2E (P2-4), séparée de Vitest
// (tests unitaires) : `npm run test:e2e`. Un seul worker — l'application
// applique un verrou d'instance unique (requestSingleInstanceLock) et ne peut
// pas être lancée en parallèle.
// Sous Linux sans affichage : xvfb-run -a npm run test:e2e (voir e2e/README.md).
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    outputDir: './e2e/.results',
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: [['list']],
    timeout: 120_000,
    expect: { timeout: 15_000 },
    use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
});
