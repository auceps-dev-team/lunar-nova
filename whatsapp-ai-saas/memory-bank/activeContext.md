# Active Context: WaCopilote

## Current Implementation State
- **v1.42.11** — traitement complet de l'audit (voir `TRAITEMENT_AUDIT.md`).
- Stable Desktop & Backend core with support for Gemini 1.5/2.0, NVIDIA NIM, OpenRouter, and Ollama.
- E2E WhatsApp Web automation via Playwright (`orderListener.js`).
- Complete catalog creation, image generation & virtual photo shoot module.
- Business directory lead scraper (GoAfrica, Annuaire CI, Google Maps).
- Real-time token usage, latency, and cost tracking dashboard.

## Active Focus
- Audit du dépôt terminé : 20 constats vérifiés (aucun faux positif) puis corrigés.
- Version synchronisée partout : 1.42.11 (`package.json` ×2, README, index.html, installer.iss).
- 100 tests unitaires verts, ESLint 0 erreur, build Vite OK, CI GitHub Actions ajoutée.
- 7 pages découpées (< 800 lignes) : WordPressBridge, PhotoShoot, Contacts,
  AdvancedAnalytics, InvoiceBuilder, AgentsHub, AiChat — 16 nouveaux composants.
- Sécurité : CORS `Origin: null`, TTL sessions OAuth, validation E.164 des numéros,
  garde compte WhatsApp Business réactivée, clé maître safeStorage inchangée.

## Key Decisions & Context
- Logo integrated via `public/assets/WaCopilot%20Logo.png`.
- Replaced irrevelant emojis (🦣) with project-specific emojis (🤖, 💬, 📱, ⚡, 🚀, 📷, 🔍, 📊).
- Exhaustive README structured with 21 key sections in French covering setup, architecture, AI gateway, WhatsApp automation, Photo Studio, lead scrapers, WordPress bridge, security, and tests.
- **Règles de versionnage appliquées** : `+0.0.1` pour chaque correctif (10 bumps
  cumulés), refactors/tests/CI sans bump ; `bump_version.sh` synchronise toutes
  les sources de version.
- **Choix produit maintenus** : `disable_safety_checker` par défaut `true` sur
  Together/Qwen (shootings fashion) ; dédup des numéros sans rapprochement
  indicatif/national (défensif, testé et documenté).
