# Active Context: WaCopilote

## Current Implementation State
- **v1.42.14** — Traitement des constats des audits croisés (sécurité WordPress HITL strict, CI GitHub Actions, endpoint DELETE settings, centralisation OpenRouter, modèle Gemini 2.5 Flash).
- Stable Desktop & Backend core with support for Gemini Flash/Pro, NVIDIA NIM, OpenRouter, and Ollama.
- E2E WhatsApp Web automation via Playwright (`orderListener.js`).
- Complete catalog creation, image generation & virtual photo shoot module.
- Business directory lead scraper (GoAfrica, Annuaire CI, Google Maps).
- Real-time token usage, latency, and cost tracking dashboard.

## Active Focus
- **v1.42.13** : Sécurité WordPress — suppression de l'écriture directe (`POST /:id/posts`, `POST /:id/products` et callbacks PHP morts). Passage exclusif par le flux HITL `/propose` -> `/execute/:actionId`.
- **v1.42.14** : Implémentation du `DELETE /api/settings/:key` + bouton UI (🗑️) pour effacer les clés API stockées.
- **CI / Infra** : Ajout du workflow GitHub Actions `.github/workflows/ci.yml` (tests vitest, eslint, vite build).
- **Nettoyage & Refactor** : Centralisation `DEFAULT_MODEL` et `OPENROUTER_HTTP_REFERER` dans `openrouterService.js`, suppression résidus `gemini-1.5-pro` et variables orphelines, exclusion de `goafrica-tg-annuaire.html` dans `.gitignore`.

## Key Decisions & Context
- Logo integrated via `public/assets/WaCopilot%20Logo.png`.
- Replaced irrevelant emojis with project-specific emojis (🤖, 💬, 📱, ⚡, 🚀, 📷, 🔍, 📊).
- Exhaustive README structured with 21 key sections in French.
- **Règles de versionnage appliquées** : `+0.1.0` (majeur/important), `+0.0.1` (mineur/bug fix), sans bump (CI, docs, refactoring).
- **Choix produit maintenus** : `disable_safety_checker` par défaut `true` sur Together/Qwen (shootings fashion) ; dédup des numéros sans rapprochement indicatif/national (défensif, testé et documenté).
