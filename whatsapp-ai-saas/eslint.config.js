import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// Le dépôt mélange trois environnements d'exécution. Les traiter tous comme du
// navigateur — ce que faisait la configuration précédente — signalait `require`,
// `module`, `process` et `__dirname` comme non définis dans tout le backend, et
// appliquait les règles React à des fichiers qui n'en contiennent pas.
export default defineConfig([
  globalIgnores(['dist', 'dist-electron', 'node_modules', 'backend/node_modules']),

  // --- Renderer React (navigateur) ---
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },

  // --- Backend Express et processus Electron (Node, CommonJS) ---
  {
    files: ['backend/**/*.{js,cjs}', 'electron/**/*.{js,cjs}', '*.cjs', 'tmp/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      // Les blocs catch vides sont un idiome assumé du code d'automatisation
      // WhatsApp : le DOM change sous les pieds du scraper et l'échec d'un
      // sélecteur ne doit pas interrompre la boucle.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // --- Code injecté dans la page WhatsApp via page.evaluate() ---
  // Il s'exécute dans le navigateur distant, pas dans Node.
  {
    files: [
      'backend/orderListener.js',
      'backend/scrapers/**/*.js',
      'backend/routes/catalog.js',
      'backend/routes/wa.js',
      'backend/server.js',
      'backend/extract_goafrica.js',
      'backend/fetch_card_website.js',
      'backend/test_gmaps.js',
      'test-*.cjs',
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },

  // --- Fichiers de configuration outillage (Node, ESM) ---
  {
    files: ['*.config.js', 'vite.config.js', 'vitest.config.js', 'postcss.config.js', 'tailwind.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.node },
      sourceType: 'module',
    },
  },

  // --- Tests (Vitest) ---
  // Déclaré en dernier pour l'emporter sur le bloc backend : les tests sont
  // écrits en ESM même lorsqu'ils portent sur des modules CommonJS, que Vite
  // expose via interopérabilité.
  {
    files: ['**/*.{test,spec}.{js,jsx}', 'src/setupTests.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
  },
])
