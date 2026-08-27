# Active Context: WaCopilote

- **v1.43.1** — Correctif critique et fiabilisation de la Prospection B2B (+0.0.1) :
  - **Store Zustand (`src/store.js`)** : Définition robuste des états `prospectSearchQuery` et `prospectLeads` (setters avec fallbacks et support des mises à jour fonctionnelles), sécurisation de l'adaptateur `idbStorage` sans `indexedDB`.
  - **UI (`src/pages/whatsapp/Prospection.jsx`)** : Élimination des crashes au montage (`trim`/`length` sur `undefined`), vérification `if (!res.ok)` avec remontée d'erreurs HTTP sur le flux SSE, rafraîchissement automatique des métadonnées GoAfrica.
  - **Scrapers (`backend/scrapers/googleMapScraper.js`)** : Nettoyage automatique des icônes de repères Unicode (`\uE0C8`) et retours chariots parasites dans les adresses.
  - **Tests** : 16 suites Vitest (157 tests unitaires / intégration validés), 0 warning ESLint, build Vite vérifié.
- **v1.43.0** — Intégration complète des lots P0, P1 et P2 de l'audit complet :
  - **P0** : Surface d'écriture directe WordPress fermée (HITL strict), CI GitHub Actions opérationnelle (`.github/workflows/ci.yml`).
  - **P1** : `DELETE /api/settings/:key` + bouton UI (🗑️), centralisation OpenRouter/Gemini 2.5 Flash, nettoyage des résidus et variables orphelines, internationalisation de `Prospection.jsx`.
  - **P2** : Parité i18n intégrale fr/en/es/ar (testée), initialisation DB injectable sans `process.exit`, extraction des parsers de scrapers (`annuaireCi.js`, `goAfrica.js`) avec 14 tests dédiés, suite de tests d'adaptateurs et migrations SQLite, squelette E2E Playwright, exclusion et suppression du dump GoAfrica.
- Stable Desktop & Backend core with support for Gemini Flash/Pro, NVIDIA NIM, OpenRouter, and Ollama.
- E2E WhatsApp Web automation via Playwright (`orderListener.js`).
- Complete catalog creation, image generation & virtual photo shoot module.
- Business directory lead scraper (GoAfrica, Annuaire CI, Google Maps).
- Real-time token usage, latency, and cost tracking dashboard.

## Active Focus
- **v1.43.1** stabilisée et validée : 16 fichiers de tests unitaires/intégration (157 tests verts), ESLint 0 warning, Vite build réussi.
- Suivi du cycle de release et monitoring des pipelines CI.

## Key Decisions & Context
- Logo integrated via `public/assets/WaCopilot%20Logo.png`.
- Replaced irrevelant emojis with project-specific emojis (🤖, 💬, 📱, ⚡, 🚀, 📷, 🔍, 📊).
- Exhaustive README structured with 21 key sections in French.
- **Règles de versionnage appliquées** : `+0.1.0` (changement majeur/important ou nouvelle surface/architecture), `+0.0.1` (mineur/bug fix), sans bump (CI, docs, refactoring).
- **Choix produit maintenus** : `disable_safety_checker` par défaut `true` sur Together/Qwen (shootings fashion) ; dédup des numéros sans rapprochement indicatif/national (défensif, testé et documenté).
- **URL feedback désinstallation** : Maintenue à `/unistall-wacopilote/` (vérifiée HTTP 200 sur le serveur live).
