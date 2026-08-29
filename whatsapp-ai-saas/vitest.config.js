import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Toute base SQLite ouverte IN-PROCESS par les tests backend vit dans ce
// répertoire temporaire : la base de développement du projet n'est jamais
// touchée par une exécution de tests (constat N5 de l'audit). Les suites CLI
// (spawns) posent leur propre USER_DATA_PATH isolé par fichier — même
// mécanisme, périmètre plus étroit.
const testUserDataDir = path.join(os.tmpdir(), 'wacopilote-vitest-userdata');
fs.mkdirSync(testUserDataDir, { recursive: true });

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: true,
    pool: 'threads',
    env: {
      USER_DATA_PATH: testUserDataDir,
    },
    // Les specs E2E (e2e/*.spec.js) tournent sous Playwright avec l'application
    // Electron réelle (`npm run test:e2e`) — elles ne sont pas exécutables sous
    // Vitest (pas de binaire Electron, pas d'affichage). Les autres motifs
    // reprennent les exclusions par défaut de Vitest, sinon le scan traverse
    // les node_modules imbriqués.
    exclude: [
      'e2e/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/.{idea,git,cache,output,temp,tmp}/**',
    ],
    // Les modules CommonJS du backend (db, services, routes…) doivent être
    // transformés par Vite pour que vi.mock() s'applique à leurs `require`
    // internes — sinon le module system natif de Node les charge tels quels
    // (et tente par exemple de charger le binding natif de sqlite3).
    server: {
      deps: {
        inline: [/backend\//, 'sqlite', 'sqlite3'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
