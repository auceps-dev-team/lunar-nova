import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Content-Security-Policy du renderer, injectée au BUILD seulement.
 *
 * En développement, le rechargement à chaud de Vite repose sur des scripts en
 * ligne qu'une politique stricte interdirait : la CSP ne s'applique donc qu'à
 * l'application packagée, chargée en file://, où aucun en-tête HTTP n'existe —
 * d'où la balise <meta>, placée en tête pour couvrir tout ce qui suit.
 *
 * Chaque source autorisée correspond à un usage relevé dans src/ le 1er octobre
 * 2026 ; en ajouter une doit renvoyer à un usage réel :
 *   - backend local              : API_BASE_URL (VITE_API_URL), fetch et SSE
 *   - polices Google             : index.html
 *   - connexion Google           : @react-oauth/google (script, style, iframe),
 *                                  userinfo dans Profile.jsx
 *   - carte Google               : iframe d'intégration dans Prospection.jsx
 *                                  (lu dans le code ; non exercé à la mesure,
 *                                  il faut une clé Google Maps pour l'afficher)
 *   - URL data: en fetch         : ImageEditor.jsx convertit des data: en Blob
 *   - images https:              : visuels générés hébergés par les fournisseurs
 *
 * Mesuré le 1er octobre 2026, application packagée, profil isolé : aucune
 * violation sur les 24 routes ; un script tiers injecté en témoin est bien
 * bloqué et signalé (le détecteur n'est donc pas muet). Les <webview> ne sont
 * PAS régies par cette politique — une webview vers un site absent de la liste
 * se charge quand même. WhatsApp Web n'y figure donc pas : l'y inscrire
 * laisserait croire à une protection qui n'existe pas. Leur isolement repose
 * sur la séparation de processus et `will-attach-webview` (main.cjs).
 *
 * Ce qui est volontairement permis :
 *   - style-src 'unsafe-inline' : le HTML assaini des réponses LLM (AiChat,
 *     AiWriter) garde ses attributs style. Un style ne peut pas exécuter de
 *     script ; c'est script-src qui porte la protection, et il n'autorise ni
 *     'unsafe-inline' ni 'unsafe-eval'.
 */
function contentSecurityPolicy(apiUrl) {
  const api = new URL(apiUrl).origin
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", 'https://accounts.google.com'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'media-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'", api, 'data:', 'blob:', 'https://accounts.google.com', 'https://www.googleapis.com'],
    'frame-src': ['https://accounts.google.com', 'https://www.google.com'],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"]
  }
  return Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ')
}

function cspPlugin(apiUrl) {
  return {
    name: 'wacopilote-csp',
    apply: 'build',
    transformIndexHtml() {
      return [{
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy(apiUrl) },
        injectTo: 'head-prepend'
      }]
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Même valeur de repli que src/config.js : la CSP suit l'URL réellement compilée.
  const apiUrl = env.VITE_API_URL || 'http://127.0.0.1:3000'

  return {
    base: command === 'serve' ? '/' : './',
    plugins: [react(), cspPlugin(apiUrl)],
    server: {
      port: process.env.VITE_DEV_PORT ? parseInt(process.env.VITE_DEV_PORT) : 5173,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
      }
    },
    build: {
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
            ui: ['lucide-react', 'recharts'],
            i18n: ['i18next', 'react-i18next']
          }
        }
      }
    }
  }
})
