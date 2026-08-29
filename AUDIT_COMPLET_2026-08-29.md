# 🔍 Audit complet — WaCopilote (`lunar-nova`) — v1.45.0

> **Date de l'audit :** 2026-08-29
> **Auditeur :** analyse agent (lecture intégrale itérative + vérifications exécutées)
> **Version auditée :** 1.45.0 · commit `609bd08` · branche `arena/01a04f40-lunar-nova` (issue de `New-feature`)
> **Périmètre :** 280 fichiers suivis par Git · ≈ 33 000 lignes applicatives (JS/JSX/CJS) + 2 179 lignes de tests · plugin WordPress PHP (~1 234 lignes) · CLI 873 lignes · Electron 641 lignes
> **Méthode :** analyse par boucles successives (configuration → Git → installation → tests → lint → build → lecture intégrale backend → routes → services → LLM → scrapers → Electron → CLI/MCP → frontend → i18n → plugin PHP → docs), sans survol : chaque fichier source du dépôt a été parcouru, et les vérifications ont été **réellement exécutées**.

---

## 1. Synthèse exécutive

WaCopilote est une **application desktop Electron** (React 19 / Vite 7 / Express 4) qui fusionne l'automatisation de WhatsApp Web, 27 agents IA multi-fournisseurs, un studio photo produit, la prospection B2B (3 sources), un bridge WordPress/WooCommerce HITL et, depuis v1.44–v1.45, un **CLI bidirectionnel et un serveur MCP (~30 outils)**. Produit interne ivoirien (Abidjan) devenu **open source AGPL-3.0** en v1.36.0.

Le dépôt est **sain, remarquablement documenté et cohérent**. L'architecture à quatre environnements (renderer / process principal Electron / backend Express / code injecté WhatsApp) est exemplary, la posture de sécurité locale est d'un niveau rare pour ce type de produit, et le projet applique une discipline d'amélioration continue prouvée par la traçabilité de ses deux audits internes précédents (v1.42.0 → v1.42.12, tous constats traités).

**Le point bloquant de cet audit : la CI Ubuntu échoue actuellement** sur un test de portabilité Windows/Linux introduit avec le bridge CLI (`sanitizeCommandName`, `externalAgentRunner.js`). Le défaut est trivial à corriger, mais il rend le pipeline rouge dès le prochain push.

| Vérification | Résultat |
|---|---|
| Tests unitaires (`npx vitest run`) | ⚠️ **25 fichiers / 221 tests : 219 ✔, 1 ✘ (C1), 1 ignoré volontaire** |
| Lint (`npx eslint . --max-warnings=0`) | ✅ **0 erreur, 0 avertissement** |
| Build production (`npx vite build`) | ✅ **Réussite** (15,9 s ; 24 chunks ; html2pdf 976 kB reste le plus lourd) |
| CLI (`node bin/wacopilote.cjs version / list-agents`) | ✅ **v1.45.0, 27 personas chargés** |
| Serveur MCP (`wacopilote mcp`, JSON-RPC initialize/tools-list/ping) | ✅ **Répond conformément au protocole (2024-11-05)** |
| Hygiène du dépôt (secrets, fichiers temporaires, artefacts) | ✅ **Rien de sensible suivi par Git** (`database.sqlite`, `api-token`, `master-key` ignorés) |

| Domaine | Verdict |
|---|---|
| Architecture & conception | ✅ Très bon |
| Sécurité & secrets | ✅ Très bon (1 XSS indirecte à fermer — C2) |
| Qualité du code (lint, build) | ✅ Très bon |
| Tests | ✅ Bon volume (221) · ⚠️ 1 échec bloque la CI · couverture non mesurée |
| Internationalisation | ✅ 4 langues × 1 189 clés, parité verrouillée par test |
| Maintenabilité | ✅ Bonne (5 pages frontend > 700 lignes restantes) |
| Documentation | ✅ Excellente (2 README, SECURITY, CONTRIBUTING, memory-bank, 2 audits) |
| Documentation racine | ⚠️ Badge version et compte de tests obsolètes (C3) |
| CI / DevOps | ⚠️ Pipeline présent et bien conçu, **actuellement rouge** (C1) · E2E non branché (choix documenté) |

---

## 2. Analyse Git

### 2.1 Historique

Le dépôt public est un **commit unique racine** (`609bd08`, squash) :

```
609bd08 docs: aligner le changelog v1.45.0 sur le perimetre reel du bridge CLI/MCP
```

* Auteur : `auceps-dev-team <dev.team@auceps-digital.agency>` — co-signé `Claude Sonnet 5`.
* Date : 28/08/2026, la veille de l'audit. Arborescence de travail **propre** (aucun fichier modifié non suivi).
* Le message de commit est **exact et vérifiable** : il annonce un changement purement documentaire (README + changelog `Support.jsx` v1.45.0), sans bump de version — conforme au contenu (aucun `.js` métier modifié par rapport au descriptif des versions dans la memory-bank).

### 2.2 Cohérence de version (constat C3)

| Source | Valeur | Statut |
|---|---|---|
| `whatsapp-ai-saas/package.json` + `backend/package.json` | **1.45.0** | ✅ Référence |
| `whatsapp-ai-saas/README.md` (badge + corps) | 1.45.0 | ✅ |
| `index.html` (landing) | 1.45.0 | ✅ |
| `src/pages/Support.jsx` (changelog intégré) | v1.45.0 en tête | ✅ |
| **`README.md` racine (badge)** | **1.43.0** | ❌ Obsolète |
| **`README.md` racine, section Tests** | **« 43 tests »** (réel : 221) | ❌ Obsolète |

Le script `bump_version.sh` met à jour ces emplacements ; la dérive vient du dernier commit documentaire qui a « oublié » le README racine. Faible impact, trivial à corriger.

### 2.3 Fil de versions reconstitué (memory-bank + Support.jsx)

v1.35.0 (release initiale) → v1.36.0 (open source AGPL) → v1.40.2 (logs expurgés) → v1.42.x (traitement audit #1 : 20 constats) → v1.42.13 (audit croisé, HITL strict) → v1.43.0/1.43.1 (CI, suppression de clés, i18n, sécurité store) → **v1.44.0 (CLI bidirectionnel + MCP)** → **v1.45.0 (extension CLI/MCP quasi totale)**. La trajectoire est cohérente, chaque version a un périmètre documenté et testé.

---

## 3. Vérifications exécutées (mesures réelles)

### 3.1 Environnement

* Node v22.22.3 / npm 10.9.8, Linux x64 (bac à sable sans affichage).
* Particularité d'installation rencontrée : le bac à sable bloque les téléchargements hors registre npm (prébuilds `sqlite3`, binaires Electron/Playwright). Contournements utilisés **pour l'audit uniquement** : `ELECTRON_SKIP_BINARY_DOWNLOAD=1` (racine) et `npm ci --ignore-scripts` + `npm rebuild sqlite3 --nodedir=/usr/local` (backend — headers Node présents localement). Sur un poste standard ou dans la CI GitHub, `npm ci` fonctionne tel quel.

### 3.2 Suite de tests — 25 fichiers, 221 tests

| Fichier | Tests | Thème |
|---|---|---|
| `phoneRules.test.js` | 20 | Numérotation 17 pays, fixes/mobiles |
| `llmJson.test.js` | 18 | Extraction JSON des réponses LLM |
| `updateLogic.test.js` | 14 | Comparaison semver, assets multi-OS |
| `scrapersParsers.test.js` | 14 | Parsers Annuaire CI / GoAfrica |
| `phoneFormat.test.js` (front) | 13 | Formatage E164 côté UI |
| `nvidiaModels.test.js` | 13 | Catalogue 53 modèles, résolution de clés |
| `externalAgentRunner.test.js` | 13 | **1 ÉCHEC (C1)** — liste blanche CLI |
| `contactAgent.test.js` | 13 | Validation/déduplication de leads |
| `secretStore.test.js` | 11 | AES-256-GCM aller-retour |
| `openrouterAdapter.test.js` | 10 | Adaptateur OpenRouter |
| `cliInbound.test.js` | 10 | Parsing des commandes CLI |
| `pipelineService.test.js` | 9 | Pipeline de prospection |
| `logRedact.test.js` | 8 | Expurgation PII des logs |
| `mcpServer.test.js` | 6 | Serveur MCP |
| `invoiceService.test.js` | 6 | Devis backend |
| `cliMcpFlow.test.js` | 6 | Bout-en-bout CLI/MCP |
| `prospectionStore.test.js` (front) | 5 | Store Zustand prospection |
| `documentsService.test.js` | 5 | Documents |
| `dbMigrations.test.js` | 5 (1 skip conditionnel) | Migrations SQLite en mémoire |
| `dbLazyInit.test.js` | 5 | Initialisation paresseuse DB |
| `waInstancesService.test.js` | 4 | Instances WhatsApp |
| `cliBridgeRoutes.test.js` | 4 | Routes /api/cli |
| `i18nParity.test.js` | 3 | Parité fr/en/es/ar |
| `openaiServiceHelpers.test.js` | 3 | Sanitization prompts Together |
| `example.test.jsx` | 1 | Smoke Testing Library |

Le test ignoré (`dbMigrations`) est un **skip conditionnel documenté** : il bascule automatiquement sur un test « mode dégradé » quand le binding natif `sqlite3` est absent — conception propre, le résumé reste explicite.

### 3.3 Lint, build, exécution

* **ESLint** : 0 erreur / 0 avertissement avec `--max-warnings=0` (même exigence que la CI).
* **Build Vite** : succès en 15,9 s. Le chunk `html2pdf` pèse 976 kB (281 kB gzip) — chargé en lazy, acceptable, mais candidat au remplacement à terme.
* **CLI réel** : `version` → `WaCopilote v1.45.0` ; `list-agents` → 27 personas chargés. Journaux propres (stdout réservé au protocole, logs sur stderr).
* **Serveur MCP réel** : réponses JSON-RPC 2.0 valides à `initialize`, `tools/list` (~30 outils) et `ping`.
* **Squelette E2E** (`e2e/smoke.spec.js`, Playwright `_electron`) : bien écrit (indépendant de la locale, verrou d'instance unique respecté, 1 worker), **non exécutable dans ce bac à sable** (binaire Electron non téléchargeable) — cohérent avec sa documentation (`e2e/README.md`) qui le réserve au poste local/CI avec affichage.

---

## 4. Cartographie du système vérifiée

### 4.1 Architecture (4 environnements)

1. **Renderer React 19** (`src/`, ~18 900 l.) — Zustand persisté IndexedDB, React Router 7 (HashRouter, 21 routes), i18next 4 langues, Tailwind 3.
2. **Process principal Electron 40** (`electron/`, 641 l.) — fenêtres, webviews WhatsApp (UA Chrome forcé), fork du backend, clé maître `safeStorage`, updater GitHub multi-OS, CDP :8315.
3. **Backend Express** (`backend/`, ~12 700 l. dont orchestrator 2 868 l. et scrapers 1 068 l.) — écoute **uniquement 127.0.0.1:3000**, token obligatoire, rate-limit global (2 000/15 min) + lourd (30/15 min), CORS en liste blanche, SQLite versionnée (7 migrations) + Redis optionnel (fallback silencieux).
4. **Code injecté WhatsApp Web** (`page.evaluate()`) — extraction DOM read-only, défendu et documenté comme fragile par nature.

### 4.2 Backend — 11 routeurs (`backend/routes/`)

`ai` · `settings_and_agents` · `wa` · `catalog` · `prospection` · `pipeline` · `wordpress` · `documents` · `invoices` · `cliBridge` · `authGoogle` — tous paramétrés ($1..$n, zéro concaténation utilisateur relevée), tous derrière `requireApiToken` (2 exceptions justifiées : callback OAuth, token SSE en query pour `EventSource`).

### 4.3 Moteur IA

* 27 personas (orchestrator singleton, overrides DB provider/model).
* 4 services fournisseurs : `geminiService` (quotas images mensuels, reset le 5), `openaiService` (NVIDIA NIM 53 modèles + Together AI, auto-bascule vision, fallback Gemini si audio), `openrouterService`, `ollamaService` (100 % local). Résolution de clés NVIDIA à 3 niveaux (modèle → global → `.env`).
* `llmJson.js` : extraction JSON tolérante (blocs de code, texte autour, accolades dans chaînes) — 18 tests.

### 4.4 CLI / MCP (v1.44–v1.45)

* `bin/wacopilote.cjs` (873 l.) : 12 familles de commandes (agents, prospection, pipeline, documents, photo, WordPress HITL, devis + PDF autonome, instances, status, mcp), stdin chainable, `--json` propre.
* `backend/mcp/wacopiloteMcpServer.js` : JSON-RPC 2.0 stdio, ~30 tools, garde-fous HITL (`wordpress_approve_action` exige une invocation humaine explicite).
* `backend/services/externalAgentRunner.js` : liste blanche (12 CLIs), cross-spawn **sans shell**, timeout, plafond mémoire 10 Mo, `skipAllowanceCheck` réservé au diagnostic — bonne conception (défaut C1 ci-dessous).

### 4.5 Frontend

* 21 pages + composants métier (Kanban, éditeur d'images, facturier, WordPress, photo).
* **XSS** : AiChat et WpProductModal assainis via DOMPurify ✅ ; **AiWriter injecte du HTML non assaini** dans `contenteditable` (C2).
* Store Zustand : adaptateur IndexedDB avec dégradation gracieuse ✅ (testé).
* i18n : 4 × 1 189 clés, placeholders alignés, test de parité ✅.

### 4.6 Plugin WordPress (`wacopilote-bridge`, PHP 1 234 l. + ZIP v2.0.0)

REST derrière Application Passwords (auth native WP) + `current_user_can` par route, sanitization systématique (`sanitize_text_field`, `wp_kses` sur les contenus riches), actions en `pending_review` (jamais d'écriture directe — le pont n'expose **aucune** route d'exécution sans approbation), désinstallation propre (multisite compris). L'architecture coïncide avec le PDF de conception (`docs/architecture-pont-wordpress-securise.pdf`).

### 4.7 Inventaire des fichiers du dépôt

| Zone | Fichiers | Contenu |
|---|---|---|
| Racine | 20 | README, 4 docs d'audit/suivi, landing `index.html`, cartes mentales v1.43, CI GitHub (workflow + templates d'issues/PR + FUNDING), `bump_version.sh` |
| `whatsapp-ai-saas` racine | 15 | package.json (+build NSIS), 2 lockfiles, configs Vite/Vitest/ESLint/Tailwind/PostCSS/Playwright, e2e (3), memory-bank (5), docs (4) |
| `backend` | 56 | server, db, 6 services LLM, orchestrator + 27 personas, 11 routes, 8 services, 3 scrapers + 2 parsers + phoneRules, MCP, CLI-bridge, secretStore, apiAuth, logRedact, llmJson, orderListener, redisClient, nvidiaModels, script utilitaire, .env.example, 2 lockfiles |
| `backend/__tests__` | 23 | Suites Vitest backend |
| `src` | ~105 | App, store, 21 pages + 6 WhatsApp, ~40 composants, 4 locales, i18n, hooks (2), services (2), constantes (3), styles, 3 tests |
| `electron` | 4 | main, preload, updater, updateLogic |
| `bin` | 1 | CLI `wacopilote.cjs` |
| `wordpress-plugin` | 3 | PHP, uninstall, ZIP v2.0.0 |
| `public/assets` | 36 | Logo (ico/png/svg), 12 fonds, 11 mannequins, 12 poses, vite.svg |

---

## 5. Constats détaillés

> Gravités : 🔴 Élevé (bloque la CI / risque réel) · 🟠 Moyen (faille défendable mais réelle) · 🟡 Faible (dérive documentaire / durcissement) · ⚪ Info (dette technique assumée).

### 🔴 C1 — `sanitizeCommandName` : test rouge sous Linux → **CI cassée**

* **Fichier :** `backend/services/externalAgentRunner.js:33-41` + `backend/__tests__/externalAgentRunner.test.js:24-27`.
* **Fait observé :** le test attend `sanitizeCommandName('C:\\Program Files\\nodejs\\node.exe') === 'node'`. Sous Linux, `path.basename` ne découpe pas les anti-slashes → renvoie `c:\program files\nodejs\node` → **1 échec** (`npx vitest run` → code ≠ 0 → job CI « 🧪 Tests, Lint & Build » en échec).
* **Impact :** tout push/PR sur `main` ou `arena/**` échouera à l'étape tests, indépendamment de la qualité du changement. Ce n'est **pas** une faille : sous Linux, un nom contenant `\` est de toute façon rejeté par la liste blanche (échec « sûr ») ; le défaut est de portabilité/test.
* **Recommandation :** normaliser les séparateurs avant extraction :
  ```js
  const baseName = path.basename(trimmed.replace(/\\/g, '/')).replace(/\.(exe|cmd|bat|sh)$/i, '');
  ```
  Effort : 1 ligne + relance de la suite. À corriger **avant tout autre commit** pour redevenir vert.

### 🟠 C2 — AiWriter : HTML de sortie IA injecté sans DOMPurify

* **Fichiers :** `src/pages/AiWriter.jsx:89` (`innerHTML = data.data.content` au chargement d'un document), `:151` (`innerHTML = text` après génération IA), `:524` (`onInput` relit le HTML brut) — et export PDF/`print-to-pdf` du même contenu.
* **Scénario :** une injection de prompt (contenu web récupéré par un agent, document partagé, réponse LLM dévoyée) peut faire produire à l'IA du HTML actif (`<img onerror=…>`). Le renderer est confiné (contextIsolation ✓) mais **l'API `window.electronAPI.getApiToken` est exposée par le preload** : un script injecté peut récupérer le token et parler au backend local (contacts, WordPress, exécution CLI en liste blanche). C'est exactement la classe de défaut que la v1.42 a corrigée ailleurs (AiChat, WpProductModal passent par DOMPurify) — AiWriter a été manqué.
* **Recommandation :** appliquer `DOMPurify.sanitize` (même configuration ALLOWED_TAGS que `AiChat.jsx:36`) aux trois points d'entrée, et envisager de retirer `getApiToken` du bridge au profit d'un token injecté en closure dans `apiAuth.js` (le renderer n'a pas besoin d'y accéder directement). Effort : ~10 lignes.

### 🟡 C3 — README racine obsolète (badge 1.43.0, « 43 tests »)

* **Fichier :** `README.md:10` (badge `version-1.43.0`) et `README.md:281` (« **43 tests** couvrent aujourd'hui… » alors que la suite en compte 221, et l'énumération qui suit est incomplète : secretStore, llmJson, phoneRules, i18n, migrations, CLI/MCP, scrapers, updater…).
* **Impact :** première impression des visiteurs GitHub faussée ; contredit le README interne (à jour, lui) et le commit documentaire v1.45.0.
* **Recommandation :** `./bump_version.sh patch` ne convient pas (pas de release) — corriger à la main badge + paragraphe Tests (221 tests, 25 fichiers, 1 skip conditionnel). Effort : 5 min.

### 🟡 C4 — Callback OAuth : HTML interpolé non échappé

* **Fichier :** `backend/routes/authGoogle.js:73` — `res.send(\`<p>${JSON.stringify(tokenData)}</p>\`)` en cas d'erreur de token Google.
* **Impact :** contenu aujourd'hui contrôlé par Google uniquement (réponse d'erreur OAuth), donc non exploitable en l'état ; mais c'est un motif XSS par interpolation dans une route publique, et cela expose le détail de la réponse d'erreur (fuite d'information mineure).
* **Recommandation :** renvoyer un message générique + journaliser le détail côté serveur (`console.error` déjà présent) ; ou échapper via une fonction `escapeHtml`. Effort : 3 lignes.

### ⚪ C5 — Dette technique connue et assumée

* **5 pages frontend > 700 lignes** : `Prospection.jsx` 798, `AiChat.jsx` 784, `PhotoShoot.jsx` 759, `Contacts.jsx` 753, `InvoiceBuilder.jsx` 753 (l'audit précédent en avait découpé 6 ; le seuil « > 800 » n'est plus atteint, mais la tendance repart).
* **Couverture non mesurée** : aucune config `--coverage` ni seuil ; les zones non testées restent les mêmes que l'audit précédent (routes Express hors cliBridge, `orderListener`, `geminiService`, `openaiService`, `wordpressService`, `catalog`, `main.cjs`, plugin PHP). Les 221 tests couvrent bien les **algorithmes à risque** (parsing, sécurité, numérotation, migrations, i18n), pas les couches d'intégration.
* **E2E non branché en CI** : choix documenté (`e2e/README.md`, permissions workflows), `e2e/ci-snippet.yml` prêt à l'emploi.
* **Dépendances doublons** : `puppeteer-core` + `playwright` côté backend, `jsdom` en prod backend (utile aux scrapers/parsers ? à vérifier), `sqlite` + `sqlite3` (driver + wrapper). `pdf-parse` chargé deux fois dans `aiController.js:114` (inoffensif, cache de modules).
* **Bundle** : `html2pdf` 976 kB — envisager l'API `print-to-pdf` d'Electron déjà câblée (`printToPDF` IPC) pour s'en affranchir.

---

## 6. Points forts vérifiés (à préserver)

1. **Sécurité locale exemplaire** : token API 256 bits comparé en temps constant (`apiAuth.js`), secrets chiffrés AES-256-GCM au repos avec clé maître scellée `safeStorage` (DPAPI/Trousseau/libsecret) (`secretStore.js`), secrets jamais renvoyés par le GET (`settings_and_agents.js`), suppression dédiée des clés, logs expurgés par défaut avec option de débogage (`logRedact.js`), serveur bindé explicitement sur 127.0.0.1, CORS en liste blanche avec justification écrite de `Origin: null`, rate-limiting à deux étages, upload média borné (multer mémoire 50 Mo).
2. **Discipline de migrations** : compteur `schema_version`, application conditionnelle, cas bénin « colonne existe déjà » géré, échec = arrêt du démarrage, idempotence prouvée par test en mémoire.
3. **Robustesse LLM** : extraction JSON tolérante centralisée, sanitization des prompts pour Together, fallback vision automatique, fallback audio vers Gemini, quotas images, résolution de clés à 3 niveaux.
4. **HITL WordPress réel** : aucune écriture directe ; `propose → approve/reject` côté plugin, les tools MCP le reflètent (« aucune approbation automatique »).
5. **Hygiène de protocole** : stdout réservé au JSON (CLI/MCP), logs sur stderr — rare et vital pour l'interopérabilité IDE agentiques.
6. **Validation des entrées sensibles** : numéros de téléphone validés (8–15 chiffres) avant injection dans les URLs `web.whatsapp.com`, upsert avec index partiel unique, UPDATE par suffixe borné à une ligne (régression v1.43 corrigée proprement).
7. **Qualité documentaire** : commentaires en français expliquant le *pourquoi* des choix (y compris les compromis assumés), memory-bank à jour, deux audits précédents avec traitement intégralement tracé.
8. **Anti-fragilité UI** : ErrorBoundary, SkeletonLoader, i18n verrouillé par test, store persisté avec dégradation gracieuse.

---

## 7. Recommandations prioritaires

| Priorité | Action | Constat | Effort |
|---|---|---|---|
| **P0** | Corriger `sanitizeCommandName` (normalisation `\` → `/`) et repasser la suite au vert | C1 | 1 ligne |
| **P0** | DOMPurify sur les 3 injections HTML d'AiWriter (+ retirer `getApiToken` du preload si possible) | C2 | ~10 l. |
| **P1** | Mettre à jour README racine (badge, compte de tests, énumération des suites) | C3 | 5 min |
| **P1** | Échapper/génériser l'erreur HTML du callback OAuth | C4 | 3 l. |
| **P1** | Ajouter `npx vitest run --coverage` (v8) en CI sans seuil bloquant, pour objectiver la carte de couverture | C5 | 30 min |
| **P2** | Découper `Prospection.jsx` / `AiChat.jsx` (798/784 l.) comme les 6 pages de v1.42 | C5 | moyen |
| **P2** | Brancher le smoke E2E via `e2e/ci-snippet.yml` (runner avec xvfb) quand les permissions le permettront | C5 | faible |
| **P2** | Remplacer `html2pdf.js` par l'IPC `printToPDF` existant (−976 kB) | C5 | moyen |

---

## 8. Méthodologie et limites

* **Boucles d'analyse** : 14 itérations (config → git → install → tests → lint/build → backend core → routes → CLI/MCP → services → IA → Electron → frontend → i18n → plugin PHP → inventaire final), avec vérifications croisées systématiques (aucun constat rapporté sans preuve de fichier/ligne ou exécution).
* **Exécutions réelles** : `npm ci` (×2), `vitest run` (×3 dont 2 ciblés), `eslint --max-warnings=0`, `vite build`, CLI (`version`, `list-agents`), serveur MCP (initialize/tools-list/ping), greps de sécurité (secrets littéraux, SQL interpolé, `eval`/`new Function`, `dangerouslySetInnerHTML`, `innerHTML`, URLs en dur).
* **Non exécutable dans ce bac à sable** : tests E2E Playwright (binaire Electron indisponible hors registre), appels réels aux fournisseurs LLM (aucune clé), scraping live, app Electron graphique. Ces zones ont été couvertes par lecture intégrale + tests unitaires associés.
* **Hors périmètre** : audit des dépendances (npm audit / renovate), audit du ZIP du plugin (le source PHP a été lu, pas le binaire zip), performance runtime.

---

## 9. Verdict final

**Le projet est en très bonne santé** — architecture claire, sécurité locale au-dessus du standard, documentation rare pour un projet de cette taille, trajectoire d'amélioration continue prouvée. La version 1.45.0 (CLI/MCP) est bien conçue et bien testée ; le défaut qui l'accompagne (C1) est un accident de portabilité banal mais **bloquant pour la CI**, et le seul risque sécurité identifié (C2) ferme la dernière brèche d'une politique DOMPurify par ailleurs appliquée partout.

**Prochaine action recommandée : corriger C1 puis C2, repasser la suite au vert (attendu : 220/221 + 1 skip), et mettre à jour le README racine (C3).** Le dépôt retrouvera alors un état entièrement vert, prêt pour une release v1.45.1.

---

*Audit généré le 2026-08-29 · accompagné de la carte mentale graphique `carte-mentale-wacopilote-v1.45.png` (et `.svg`) à la racine du dépôt.*
