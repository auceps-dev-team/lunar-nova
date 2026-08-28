# Project Progress: WaCopilote

## Completed Milestones
- [x] Initial release (v1.35.0) of WaCopilote Electron Desktop App.
- [x] Multi-LLM provider integration (Gemini, NVIDIA NIM, OpenRouter, Ollama, Together AI).
- [x] Integrated SQLite database & Redis caching layer.
- [x] Playwright WhatsApp Web automation listener (`orderListener.js`).
- [x] Virtual Photo Studio & AI Inpainting engine.
- [x] Web Lead Mining (Annuaire CI, GoAfrica, Google Places API).
- [x] Memory Bank Initialization (v1.0).
- [x] **Traitement complet de l'audit (v1.42.11, 2026-08-21)** : 20 constats vérifiés/corrigés.
- [x] **Audit croisé & Correctifs v1.42.13 (2026-08-26)** : Fermeture de la surface d'écriture directe WordPress (HITL strict).
- [x] **Correctifs v1.42.14 & v1.43.0 (2026-08-26)** :
  - CI GitHub Actions (`.github/workflows/ci.yml`) opérationnelle.
  - Endpoint `DELETE /api/settings/:key` + UI bouton 🗑️ pour tous les fournisseurs.
  - Centralisation OpenRouter (`DEFAULT_MODEL`, `OPENROUTER_HTTP_REFERER`) et modèle `gemini-2.5-flash`.
  - Parité intégrale i18n (`fr.json`, `en.json`, `es.json`, `ar.json`) avec test de non-régression `i18nParity.test.js`.
  - Extraction du parsing des scrapers (`annuaireCi.js`, `goAfrica.js`) avec 14 tests unitaires.
  - `initDB()` injectable sans `process.exit`, tests des migrations SQLite.
  - Retrait du dump GoAfrica et exclusion dans `.gitignore`.
  - Squelette E2E Playwright configuré.
- [x] **Correctif Prospection & Store v1.43.1 & Durcissement Sécurité (2026-08-27)** :
  - Fiabilisation du store Zustand (`prospectSearchQuery`, `prospectLeads`), sécurisation de `idbStorage`.
  - Élimination des plantages UI au montage dans `Prospection.jsx`, gestion des erreurs HTTP SSE, nettoyage d'adresses Google Maps.
  - Synchronisation de démarrage multi-ports (`wait-on tcp:5173 tcp:3000`) et ciblage IPv4 `127.0.0.1:3000` (élimination d'ERR_CONNECTION_REFUSED).
  - Assainissement XSS DOMPurify (`AiChat.jsx`, `WpProductModal.jsx`), import manquant `StatusBadge`, confinement IPC (`open-external-url`, `updater.cjs`).
  - 5 tests unitaires prospection validés (157 tests totaux).
- [x] **Architecture CLI Bidirectionnelle & Serveur MCP v1.44.0 (2026-08-27)** :
  - Branche `New-feature` dédiée.
  - Inbound CLI (`bin/wacopilote.cjs`) complet : `list-agents`, `run --agent`, `pipeline run`, `status`, `mcp`, parsing JSON et streaming stdin.
  - Serveur MCP standard `backend/mcp/wacopiloteMcpServer.js` (JSON-RPC 2.0 stdio) pour Claude Code, Cursor, Antigravity.
  - Outbound CLI Runner `backend/services/externalAgentRunner.js` (détection système, liste blanche, spawn sécurisé, timeout).
  - Routes backend `/api/cli` et intégration `provider === 'cli'` dans `aiController.js`.
  - Panneau UI de configuration dans `src/pages/Settings.jsx` via `CliAgentBridgeSettings.jsx`.
  - 22 clés i18n dans `fr.json`, `en.json`, `es.json`, `ar.json`.
  - 4 nouvelles suites de tests (25 tests validés, 182 tests totaux au vert sur 20 fichiers), ESLint 0 warning, Vite build réussi.
- [x] **Extension CLI/MCP : pilotage quasi-total v1.45.0 (2026-08-28)** :
  - Extraction service (`backend/services/{pipelineService,prospectionService,documentsService,invoiceService,wordpressService,waInstancesService}.js`), routes existantes devenues des wrappers fins.
  - Prospection/listes/plannings pilotables en CLI/MCP (remplace le stub `pipeline run` de v1.44.0) ; documents et génération photo ; devis migrés vers le backend avec export PDF autonome (Chromium headless) ; WordPress gouvernance HITL (propose → approve/reject, jamais d'exécution automatique) ; instances WhatsApp (liste + pilotage de l'existant, création QR restant humaine).
  - Correctif transverse : logs de démarrage redirigés vers stderr (corrompaient le flux JSON-RPC du serveur MCP).
  - 4 nouvelles suites de tests, `cliInbound.test.js`/`mcpServer.test.js` étendus : 24 suites au vert (208 tests, 1 skip), ESLint 0 warning, Vite build réussi.

## Current Task
- [x] Audit complet et continu du dépôt.
- [x] Intégration et validation complète des lots P0, P1, P2 (+0.1.0 -> v1.43.0).
- [x] Correctif et fiabilisation de la prospection B2B (+0.0.1 -> v1.43.1).
- [x] Synthèse complète des changements et audit de sécurité 360° validé (`synthese_changements_et_audit_complet.md`).
- [x] Développement, configuration UI et validation intégrale de l'architecture CLI bidirectionnelle & MCP (+0.1.0 -> v1.44.0 sur `New-feature`).
- [x] Extension CLI/MCP au pilotage quasi-total (prospection, documents, photo, devis, WordPress HITL, instances WhatsApp) (+0.1.0 -> v1.45.0 sur `New-feature`).

## Future Roadmap
- [ ] Multi-device WhatsApp API Gateway integration (Baileys / official Cloud API fallback).
- [ ] Enhanced AI Agent Auto-training on custom PDF/DOCX business catalogs.
- [ ] Cloud SaaS deployment option alongside Desktop Electron version.
- [ ] Exécution régulière de la suite E2E Playwright en environnement graphique dédié.
