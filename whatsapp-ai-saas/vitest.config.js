import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: true,
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
