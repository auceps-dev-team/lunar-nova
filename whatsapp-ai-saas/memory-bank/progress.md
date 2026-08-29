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
- [x] **Extension CLI/MCP : pilotage quasi-total v1.45.0 (2026-08-28/29)** :
  - Extraction service (`backend/services/{pipelineService,prospectionService,documentsService,invoiceService,wordpressService,waInstancesService}.js`), routes existantes devenues des wrappers fins.
  - Prospection/listes/plannings pilotables en CLI/MCP ; documents et génération photo ; devis migrés vers SQLite avec export PDF autonome (Chromium headless) ; WordPress gouvernance HITL ; instances WhatsApp.
  - 25 fichiers de tests unitaires/intégration au vert (**220 tests réussis**, 1 skip, 0 échec), build Vite réussi.
- [x] **Audit complet 360° et Carte Mentale Graphique v1.45.0 (2026-08-29)** :
  - Analyse approfondie des derniers commits Git, exécution intégrale des tests.
  - Mise à jour de `docs/PROJECT_MENTAL_MAP.md` avec diagrammes Mermaid.
  - Génération de l'artefact d'audit complet.

- [x] **Lot P1 & P2 — Raccordement Pipeline Segments, Doublons & Outils CRM MCP/CLI v1.46.0 (2026-08-29)** :
  - Pipeline raccordé aux segments nommés ou par ID (`saveContactsStage`, `createSegment`, `runAuto`).
  - Réaffectation automatique des contacts doublons avec rafraîchissement d'adresses et de métadonnées.
  - 9 outils CRM atomiques MCP + sous-commandes CLI `contacts` et `segments`.
  - 26 suites de tests au vert (**237 tests réussis**, 1 skip, 0 échec).

- [x] **Traitement audit révision 2 — Lot 2 (sécurité & robustesse) v1.47.2 (2026-08-29)** :
  - C2 — AiWriter : DOMPurify (`SANITIZE_EDITOR`, allowlist éditeur riche) sur les deux points d'entrée externe du HTML — chargement d'un document et génération IA ; `onInput` volontairement non ré-assaini (détruirait le curseur) car le DOM n'est peuplé que par ces chemins assainis ou l'édition locale.
  - C4 — Callback OAuth Google : message d'erreur générique côté page publique, détail de la réponse Google relégué au journal serveur (surface XSS par interpolation supprimée).
  - N4 — Le helper de déchiffrement safeStorage est écrit dans `os.tmpdir()` : le canal de déchiffrement CLI/MCP redevient fonctionnel en build packagé (app.asar en lecture seule).
  - N5 — Isolation DB des tests : `USER_DATA_PATH` temporaire global via `vitest.config.js` (tests in-process) + dossier dédié par fichier pour les spawns CLI/MCP (`cliInbound`, `cliMcpFlow`) ; `crmService.test.js` sur `:memory:`. La base de développement n'est plus jamais modifiée par une exécution de tests (mtime stable vérifié sur 2 runs).
  - Suite : 27 fichiers, 244 tests réussis, 0 échec, 3 skip ; ESLint 0 ; build Vite OK ; base de dev nettoyée (données de test supprimées).

- [x] **Traitement audit révision 2 — Lot 1 (correctifs bloquants CI) v1.47.1 (2026-08-29)** :
  - C1 — Portabilité `sanitizeCommandName` : normalisation des séparateurs Windows avant extraction du nom de base (le test chemin Windows passe désormais sous Linux), et durcissement : `executeExternalCli` exécute toujours le nom assaini résolu via le PATH, jamais le chemin brut (fermeture de l'évasion de binaire sous Windows).
  - N1 — CLI : suppression de la troncature non déterministe des sorties JSON volumineuses (`process.exit()` coupat le tampon stdout) — attente du drain effectif avant sortie ; vérifié sur `list-agents --json` (158 Ko, JSON valide).
  - N2 — Les 2 tests de cascade à appels API réels (`agentFallback.test.js`) s'ignorent proprement sans clé Gemini (patron `it.runIf`, homogène avec `dbMigrations.test.js`).
  - N3 — 6 variables/imports morts supprimés : ESLint à nouveau 0 erreur / 0 warning.
  - Suite : **27 fichiers, 244 tests réussis, 0 échec, 3 skip conditionnels** ; ESLint 0 ; build Vite OK.
  - Documentation : README racine à jour (badge, 247 tests décrits), règles de versionnage/journal formalisées (README + CONTRIBUTING), Support.jsx v1.47.1.

- [x] **Routage Agentique Intelligent & Auto-Fallback Multi-Canal v1.47.0 (2026-08-29)** :
  - Moteur de résilience `backend/services/agentFallbackRouter.js` avec cascade de secours multi-canal (Gemini API Cloud -> Google Gemini CLI local v0.57.0 -> Claude Code CLI v2.1.250 -> OpenRouter -> Ollama).
  - Élimination absolue des erreurs bloquantes "API key not configured" dans Chat IA (ex: Jarvis configuré avec NVIDIA/Llama sans clé NVIDIA).
  - Sélection de stratégie d'appel LLM dans les Réglages (Auto-Fallback, API Cloud Direct, CLI Machine Local, Protocole MCP).
  - Surveillance d'état temps réel avec endpoint REST `GET /api/settings/channels-status` et badges interactifs.
  - 27 suites de tests au vert (**247 tests réussis**, 1 skip, 0 échec).

- [x] **Correctif Découplage Console de Test & Détection Google CLI v1.46.1 (2026-08-29)** :
  - Découplage complet de la console de test Bridge CLI/MCP des routes d'API cloud génériques via `POST /api/cli/test-bridge`.
  - Support de 3 modes de test autonomes : CLI WaCopilote (`wacopilote run`), Serveur MCP (`tools/call`), et Délégation Machine (`claude`, `python`, `node`, `git`, `gemini`).
  - Détection enrichie des outils Google Cloud (`gcloud`) et `google-genai` dans `externalAgentRunner.js` avec résolution des chemins système standards sous Windows.
  - 26 suites de tests au vert (**240 tests réussis**, 1 skip, 0 échec).

- [x] **Lot P1 & P2 — Raccordement Pipeline / Segments & Outils CRM Atomiques MCP v1.46.0 (2026-08-29)** :
  - Support complet des segments et listes dans le pipeline (`save_pipeline_contacts`, `run_pipeline`, `pipeline run --auto`).
  - Réaffectation et enrichissement automatique des contacts doublons lors de la prospection.
  - Service CRM modulaire `backend/services/crmService.js` (list, create, get, update, delete, assignation en lot).
  - 9 outils atomiques MCP (`list_segments`, `create_segment`, `delete_segment`, `list_contacts`, `get_contact`, `create_contact`, `update_contact`, `delete_contact`, `assign_contacts_to_segment`).
  - Commandes CLI `contacts` et `segments` et optimisation de sortie instantanée.
  - 26 fichiers de tests unitaires/intégration au vert (**237 tests réussis**, 0 échec).

## Current Task
- [x] Lot P0 complété et validé (v1.45.1).
- [x] Lot P1 complété et validé (v1.46.0).
- [x] Lot P2 complété et validé (v1.46.0).
- [ ] Commit & synchronisation sur la branche `New-feature`.

## Future Roadmap
- [ ] Multi-device WhatsApp API Gateway integration (Baileys / official Cloud API fallback).
- [ ] Enhanced AI Agent Auto-training on custom PDF/DOCX business catalogs.
- [ ] Cloud SaaS deployment option alongside Desktop Electron version.
- [ ] Exécution régulière de la suite E2E Playwright en environnement graphique dédié.
