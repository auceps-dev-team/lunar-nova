# 🔍 Audit complet — WaCopilote (`lunar-nova`) — v1.42.12

> **Date de l'audit :** 2026-08-26
> **Auditeur :** analyse agent (lecture intégrale + vérifications exécutées)
> **Version audité :** 1.42.12 · commit `195c8bd` · branche `arena/01a03da0-lunar-nova`
> **Périmètre :** 242 fichiers suivis par Git · ~30 389 lignes de code (JS/JSX/CJS) dans `src/`, `backend/`, `electron/` · + plugin WordPress PHP (~1 250 lignes)
> **Méthode :** lecture intégrale de chaque fichier (backend, adaptateurs IA, 27 personas, 9 routeurs, 4 scrapers, Electron, plugin WordPress, frontend, configs, docs, `.github`, tests), puis exécution réelle des tests, du lint et du build.

---

## 1. Synthèse exécutive

WaCopilote est une **application desktop Electron** (React 19 / Vite 7 / Express 4) qui fusionne l'automatisation de WhatsApp Web, des agents IA multi-fournisseurs, un studio photo produit, la prospection B2B et un pont WordPress/WooCommerce. C'est un produit interne ivoirien (Abidjan) devenu **open source (AGPL-3.0) en v1.36.0**.

Le dépôt est **sain et cohérent**. L'architecture à trois processus (renderer / process principal Electron / backend Express) est exemplairement délimitée, la posture de sécurité locale est remarquable pour un produit de ce type, et les trois vérifications de santé passent au moment de l'audit :

| Vérification | Résultat |
|---|---|
| Tests unitaires (`npx vitest run`) | ✅ **10 fichiers / 114 tests, 100 % de réussite** |
| Lint (`npx eslint .`) | ✅ **0 erreur, 0 avertissement** |
| Build production (`npx vite build`) | ✅ **Réussite** (19,2 s ; chunks vendor/ui/i18n manuels ; html2pdf 975 kB) |

L'audit précédent (v1.42.0) et son traitement (→ v1.42.12, voir `AUDIT_WACOPILOTE.md` et `TRAITEMENT_AUDIT.md`) ont déjà corrigé l'essentiel des dettes majeures : pages > 800 lignes découpées, 71 → 114 tests, CORS/OAuth/E.164/updater durcis, secrets chiffrés, CI prévu. **Le présent audit confirme ces corrections et relève 14 constats résiduels** — aucun critique, mais deux points moyens méritent attention (CI absent, i18n es/ar incomplet).

| Domaine | Verdict |
|---|---|
| Architecture & conception | ✅ Très bon |
| Sécurité & secrets | ✅ Très bon (1 surface dormante à fermer) |
| Qualité du code (lint, build) | ✅ Très bon |
| Tests | ✅ Bon (114 tests ciblés, couverture globale encore partielle) |
| Internationalisation | ⚠️ fr/en complètes, es/ar à ~32 % |
| Maintenabilité | ✅ Bonne (2 pages > 750 lignes, 1 composant 850 lignes) |
| Documentation | ✅ Excellente (2 README, SECURITY, CONTRIBUTING, memory-bank) |
| Automatisation WhatsApp | ⚠️ Fragile par nature (sélecteurs DOM Meta) mais bien défendue |
| DevOps / CI | ⚠️ **CI annoncé mais absent** |

---

## 2. Identité du projet

| Attribut | Valeur |
|---|---|
| Nom | WaCopilote |
| Dépôt | `auceps-dev-team/lunar-nova` |
| Origine | Abidjan, Côte d'Ivoire — produit interne devenu open source en v1.36.0 |
| Licence | AGPL-3.0 (plugin WordPress : GPL-2.0-or-later) |
| Stack | Electron 40, React 19, Vite 7, Zustand 5, Tailwind 3, Express 4, SQLite (sqlite3/sqlite), Redis, Playwright + Puppeteer-core, i18next |
| Fournisseurs IA | Google Gemini, NVIDIA NIM (~77 modèles), OpenRouter, Together AI, Ollama (local) |
| Public cible | Commerçants/e-commerçants (CI, Sénégal, Cameroun, France…), agences, équipes commerciales |

**Les quatre environnements d'exécution** (force du projet, bien documentée dans `CONTRIBUTING.md`) :

1. **Renderer** (`src/`) — React 19 dans une fenêtre Electron ; navigateur pur.
2. **Process principal Electron** (`electron/`) — CommonJS ; lance le backend en production, gère fenêtres, clé maître `safeStorage`, mises à jour.
3. **Backend Express** (`backend/`) — CommonJS, écoute **uniquement** sur `127.0.0.1:3000` ; parle aux LLM, à SQLite, à Redis, pilote WhatsApp Web via CDP (port 8315).
4. **Code injecté** dans la page WhatsApp via `page.evaluate()` (sélecteurs DOM de WhatsApp Web) — ni `require`, ni accès aux variables du fichier parent.

---

## 3. Vérifications exécutées (mesures réelles, pas des promesses)

| Vérification | Commande | Résultat constaté |
|---|---|---|
| Tests unitaires | `npx vitest run` | ✅ **10 fichiers / 114 tests verts** (llmJson 18, phoneRules 20, updateLogic 14, contactAgent 13, nvidiaModels 13, phoneFormat 13, secretStore 11, logRedact 8, openaiServiceHelpers 3, example 1) |
| Lint | `npx eslint .` | ✅ **0 erreur, 0 avertissement** (config flat par environnement, 6 blocs) |
| Build production | `npx vite build` | ✅ **Réussite** — 28 chunks, `chunkSizeWarningLimit: 3000`, `manualChunks` vendor/ui/i18n |
| Secrets en dur | grep patterns (sk-, AIza, nvapi-, PRIVATE KEY…) | ✅ **Aucun secret codé en dur** trouvé |
| URLs en dur | grep `localhost:3000` dans `src/` | ✅ **2 occurrences, toutes intentionnelles** (`config.js` défaut + `apiAuth.js` whitelist) |
| Données personnelles | grep `tel:`/`mailto:`/`@` sur les dumps | ✅ Aucune donnée de contact dans les fichiers traqués |

> **Caveat environnement (non imputable au projet) :** le binding natif `sqlite3@6.0.1` ne peut pas être compilé/téléchargé dans ce bac à sable (restriction TLS sur les prébuilds). Avec `npm install --ignore-scripts`, les **114 tests passent quand même** ; Vitest signale un `process.exit(1)` intercepté, déclenché par `db.js` qui appelle `initDB()` au chargement du module (cf. constat N14). En environnement complet (sqlite3 présent), la suite s'exécute sans cet avertissement.

---

## 4. Audit détaillé par module

### 4.1 Backend Express — `server.js`, `apiAuth.js`

**Points forts confirmés :**
- Écoute explicite sur `127.0.0.1` (`HOST = '127.0.0.1'`), avec le commentaire expliquant pourquoi (sinon Node écoute sur `0.0.0.0` et expose clés LLM + contacts au réseau local).
- **Token Bearer sur toutes les routes** (`requireApiToken`) : comparaison SHA-256 + `timingSafeEqual`, fichier `api-token` en `0600`, création exclusive `wx` (convergence sans verrou entre Electron et backend démarrés en parallèle).
- CORS : `allowedOrigins = ['http://localhost:5173', 'null']` (correction v1.42.6 — le renderer `file://` envoie `Origin: null`).
- Rate-limiting à 3 niveaux (global 2000/15 min, lourd 30/15 min sur scraping/catalogue, IA 100/15 min), `express.json({limit:'50mb'})` justifié par les images base64.
- SSE correctement conçus (token en query uniquement sur les chemins SSE, heartbeat, nettoyage à la déconnexion).
- Chemins publics limités au strict nécessaire : `/api/auth/google/callback` (flux loopback, protégé par `state` + code à usage unique).

### 4.2 Persistance — `db.js`

- **Shim PostgreSQL → SQLite** (`pool.query`) : traduit `$1…$n` en `?`, `SERIAL PRIMARY KEY` et `JSONB` en dialecte SQLite. Choix pragmatique (développement contre une interface « Postgres » sans réécriture), mais couche de traduction fragile — toute requête doit rester dans le sous-ensemble commun.
- **6 migrations versionnées**, enregistrement de version **uniquement en cas de succès** (l'ancien comportement avalait les erreurs). Cas bénin « colonne existe déjà » seul ignoré.
- **Chiffrement des secrets au repos** : `encryptLegacySecrets()` idempotent ; `getSetting`/`setSetting` chiffrent tout champ `*_api_key` ; mots de passe d'application WordPress chiffrés aussi.
- **Initialisation retenue** (`ready = initDB()` attendu par les accesseurs) : corrige une course où une requête IA partait sans clé ni persona.

### 4.3 Sécurité & secrets — `secretStore.js`, `logRedact.js`, `electron/main.cjs`

C'est le point le plus soigné du dépôt :
- **AES-256-GCM** au repos, IV aléatoire, préfixe `enc:v1:`, valeur altérée → échec de déchiffrement (testé), chaîne vide = sentinelle « secret absent ».
- **Clé maître scellée par `safeStorage`** (DPAPI/Trousseau/libsecret) en production, jamais dans la base ; repli documenté sur fichier clair ; migration d'une clé claire existante sans casser les secrets.
- **Masquage des logs** (`logRedact.js`) : contenu des messages → longueur seule ; noms → initiale + `*` ; réactivé par `WACOPILOTE_LOG_MESSAGES=1`.
- Secrets **jamais renvoyés** par `GET /api/settings` : champ vide + indicateur `secretsSet` (l'UI affiche « configurée » sans exposer la clé).
- Electron : `contextIsolation: true`, `nodeIntegration: false`, IPC restreint via preload.
- WordPress : Basic Auth via **Application Passwords** ; déchiffrement centralisé dans `loadConnection()`.

### 4.4 Passerelle IA — `aiController.js` + 5 adaptateurs + `nvidiaModels.js`

- **`aiController.js`** centralise le routage (gemini/openrouter/ollama/openai) avec **résolution de clé à 4 niveaux** (clé modèle DB → clé globale `openai_api_key` → clé système `.env` → `NVIDIA_DEFAULT_API_KEY`). Détection d'image → bascule auto vers un modèle vision ; audio → bascule forcée Gemini.
- **`geminiService.js`** : quota free-tier 40 images/mois (reset au 5 du mois), liste blanche de modèles sur clé gratuite, fallbacks manuels de catalogue, double chemin image (Nano Banana `generateContent` / Imagen `generateImages`).
- **`nvidiaModels.js`** (785 lignes) : catalogue centralisé ~77 modèles (text/vision/image/moderation), paramètres de génération déclaratifs (`buildGenerationParams`), résolution de clé par modèle, `getModelDef` avec variantes `.`/`_`.
- **`openaiService.js`** : routage Together AI (Qwen Image) vs NVIDIA, `sanitizePromptForTogether`, `disable_safety_checker` désormais **respecté** (défaut `true` documenté, cf. v1.42.11).
- **`openrouterService.js` / `ollamaService.js`** : mêmes signatures (parsing JSON via `llmJson.js` centralisé), mode cloud/local Ollama.

### 4.5 Agents — `orchestrator.js` + 27 personas

- Orchestrateur **singleton** qui charge dynamiquement les personas depuis `agents/personas/`.
- **27 personas** identifiés, 6 au format **JSON** : `creative` (Clarisse DA), `photoshoot` (Guy), `ella`, `order_radar`, `prospecting_agent`, `wordpress_agent`. Les autres en texte libre.
- `pipeline_organizer` (Clarisse chef de projet) est documenté comme **non branché** en v1 (bookkeeping déterministe sans LLM).
- Prompts de qualité, en français, avec garde-fous explicites (pudeur des shootings, anti-hallucination du prospecting_agent, classification stricte de l'order_radar).

### 4.6 Routes Express (9 routeurs)

- `ai.js` : validation **Zod** des entrées agent, cache Redis 60 s sur `/ai/copilot` (empreinte MD5 des 3 derniers messages), route Qwen supprimée en v1.39.1.
- `wa.js` (671 lignes) : CRUD contacts/listes/segments, **validation E.164 8–15 chiffres** sur `open-chat`/`verify-contact` (v1.42.7), mutex global pour l'accès concurrent à WhatsApp, `markContactStatus` borné à une ligne (anti-réécriture massive).
- `catalog.js` : **garde « compte Business » réactivée** (v1.42.8) avec contournement si l'utilisateur est déjà sur le formulaire ; injection d'image seule (jamais de saisie auto — protection anti-restriction).
- `pipeline.js` : assistant en 4 étapes (prospect → save-contacts → generate-messages → organize), transaction + index unique sur téléphone.
- `wordpress.js` : proxy REST complet + **routes HITL** (`/propose`, `/execute/:id`), déchiffrement centralisé.
- `prospection.js` : SSE en streaming avec événements de progression, `/google` rétro-compatible, régénération de structure GoAfrica en process (plus de `exec('node …')`).
- `authGoogle.js` : sessions OAuth **à TTL 10 min** + purge paresseuse (v1.42.5).
- `settings_and_agents.js` : masquage des secrets, quota, CRUD agents.
- `documents.js` : CRUD documents AI Writer.

### 4.7 Scrapers & contact

- `phoneRules.js` : **règles de numérotation unifiées** pour les 3 scrapers (correction du bug Togo/Cameroun où l'indicatif commençait par le préfixe fixe local et écartait tous les prospects).
- `googleMapScraper.js` : cache de session LRU (TTL 1 h, 10 sessions max), progression SSE, déduction du pays par indicatif.
- `annuaireCiScraper.js` / `goAfricaScraper.js` : extraction JSON-LD + fallbacks DOM, dédup par téléphone, délégation à `phoneRules`.
- `contactAgent.js` : `validateAndDedupeLeads` **pool injectable** (testable sans binding natif), dédup sans rapprochement d'indicatif (comportement défensif assumé et testé).

### 4.8 `orderListener.js` (moteur de commandes)

- `attachObserver` **lève une erreur** si aucune page WhatsApp (v1.42.3) — l'UI ne ment plus.
- Déduplication par **fenêtre glissante bornée** (500 empreintes) au lieu d'un `Set` non borné.
- Détachement propre : le poller est **aussi** arrêté (anciennement il survivait à l'arrêt).
- Keywords FR/EN/Nouchi + classification IA (`order_radar`) avec seuil de confiance 0.5.

### 4.9 Electron — `main.cjs`, `preload.cjs`, `updater.cjs`, `updateLogic.cjs`

- Backend lancé en production via `utilityProcess.fork`, **supervision bornée** (3 relances espacées puis dialogue utilisateur).
- `print-to-pdf` : fenêtre cachée → `printToPDF` → boîte de dialogue de sauvegarde.
- **Updater multi-plateforme** (v1.42.10/1.42.12) : `compareVersions`/`parseReleaseTag`/`pickAssetForPlatform` extraits dans `updateLogic.cjs` (**testable**), timeout 10 s/5 min, **vérification d'intégrité** du téléchargement (octets vs content-length), codes d'erreur `RATE_LIMIT`/`REPO_NOT_FOUND`/`NETWORK`, cas `release_behind_current` exposé à l'UI.

### 4.10 Frontend — `src/`

- `App.jsx` (354 lignes, propre) : **HashRouter** (adapté à `file://`), lazy-loading de toutes les pages, bannière de mise à jour, **bandeau de quota avec réglage persisté `dismissQuotaBanner`** (l'ancien hack `imageLimit:99999` a été retiré, v1.42.9), `WorkArea` **toujours monté mais masqué par CSS** (préserve la mémoire/DOM des webviews).
- `store.js` : Zustand persisté en **IndexedDB**, `partialize` exclut l'état transitoire (`waAnalysis`, `updateAvailable`, `backendSettings`, `availableModels`).
- `services/apiAuth.js` : patch de `fetch` et `EventSource` au démarrage pour injecter le token — évite de modifier la centaine d'appels ; repli `VITE_API_TOKEN` hors Electron.
- `WorkArea.jsx` (684 lignes) : webviews + panneau copilote + extraction de contexte multi-stratégies (`data-id` → classes legacy → ARIA row → heuristique d'alignement).
- **28 routes** React : dashboard, analytics, agents, pipeline, chat, writer, documents, tâches, factures, outils, réglages, profil, support, studio photo (photoshoot/edit/génération), 8 pages WhatsApp, WordPress.

### 4.11 WordPress — plugin PHP + composants React

- Plugin `WaCopilote Bridge` v2.0.0 (GPL-2.0-or-later) : **HITL complet** — l'agent propose (`/propose`, statut `pending_review` sur un CPT privé), l'admin approuve/rejette (`/execute/:id`), audit log en table dédiée, rôle `wacopilote_agent_role` (cap `wacopilote_propose` uniquement), statuts custom, nonces + vérification `manage_options` sur l'UI d'approbation.
- **Application Passwords** (WP 5.6+) pour l'authentification — pas de clé maison.
- Composants React (`WpTab*.jsx`, `JarvisChat.jsx`, `WPUI.jsx`) : le chat naturel (`wordpress_agent`, format JSON) ne fait que **proposer** ; l'exécution exige une approbation.

### 4.12 Tests, lint, build, docs

- **114 tests** concentrés sur les zones qui cassent réellement : parsing JSON LLM, règles téléphoniques (régression Togo/Cameroun), redaction des logs, chiffrement, format des numéros, comparaison de versions, dédup des contacts.
- ESLint 9 **flat** à 6 blocs d'environnement (renderer, backend/electron, code injecté WhatsApp, configs, tests) — configuration exemplaire et commentée.
- `vite.config.js` : `manualChunks` vendor/ui/i18n, `base:'./'` en build (compat `file://`).
- Documentation : README racine exhaustif et honnête (« Sur l'état du projet »), SECURITY avec modèle de menace, CONTRIBUTING (4 environnements), memory-bank à jour, gabarits d'issues de qualité, `config.yml` (issues vierges désactivées).

---

## 5. Constats — inventaire complet

### 5.1 Constats résiduels relevés par le présent audit (état v1.42.12)

| # | Sévérité | Constat | Localisation |
|---|---|---|---|
| N1 | 🟢 Info | **Version périmée dans le README imbriqué et les lockfiles** : badge `1.42.0` dans `whatsapp-ai-saas/README.md` et `"version": "1.42.0"` dans les deux `package-lock.json`, alors que le code est en `1.42.12`. `bump_version.sh` ne synchronise que le README racine — ni le README imbriqué, ni les lockfiles. | `whatsapp-ai-saas/README.md:10`, `package-lock.json` ×2 |
| N2 | 🟢 Info | **Placeholder de version `1.42.0`** dans le gabarit de bug (stale). | `.github/ISSUE_TEMPLATE/bug_report.yml:42` |
| N3 | 🟡 Moyen | **CI annoncé mais absent** : aucun `.github/workflows/ci.yml` ni sur le disque ni dans Git, alors que `TRAITEMENT_AUDIT.md` le dit « conservé sur le disque ». | `.github/` |
| N4 | 🟡 Moyen | **i18n espagnol/arabe incomplet** : fr/en = 1 117 clés, es/ar = **360 clés (~32 %)**. Un utilisateur es/ar voit l'UI retomber en anglais sur ~68 % des chaînes. | `src/locales/es.json`, `ar.json` |
| N5 | 🟢 Info | **`goafrica-tg-annuaire.html` (116 Ko) toujours traqué** : snapshot HTML d'une page GoAfrica (Togo) utilisé hors-ligne par `fetchGoAfricaStructure.js`. Aucune donnée personnelle (0 `tel:`, 0 email), mais contenu tiers volumineux non couvert par le motif `*_dump.html` du `.gitignore`. | `backend/goafrica-tg-annuaire.html` |
| N6 | 🟢 Info | **Handler IPC `ping` mort** : `preload.cjs` expose `ping()` mais aucun `ipcMain.handle('ping')` dans `main.cjs`. | `electron/preload.cjs:5` |
| N7 | 🟢 Info | **Changelog in-app périmé** : la dernière entrée de `Support.jsx` est `v1.40.0` (manque 1.41.x, 1.42.x). | `src/pages/Support.jsx` |
| N8 | 🟢 Info | **Résidus de modèle déprécié `gemini-1.5-pro`** : défauts dans la clé de cache (`ai.js:74,95`) et dans `db.js:335` (`logCopilotInteraction`). Inoffensifs (cache-key/journalisation) mais résiduels. | `backend/routes/ai.js`, `backend/db.js` |
| N9 | 🟢 Info | **Typo « unistall »** dans l'URL de feedback de désinstallation (l'URL pointe vers `/unistall-wacopilote/`). | `build/installer.iss:66`, `build/installer.nsh:15` |
| N10 | 🟢 Info | **Pas de fichier `LICENSE` à la racine** du dépôt (seulement `whatsapp-ai-saas/LICENSE`) — GitHub n'affichera pas la licence automatiquement. | racine |
| N11 | 🟢 Info | **`NVIDIA_KEY_GEMMA` dans `.env.example` sans modèle correspondant** dans le catalogue (`gemma-4-31b-it` a `dbKey/envKey = null`). | `backend/.env.example` |
| N12 | 🟡 Moyen | **Surface d'écriture directe WordPress dormante** : le proxy expose `POST /api/wp/:id/posts` et `POST /api/wp/:id/products` qui ciblent les endpoints *legacy* du plugin (écriture directe si l'utilisateur connecté a `publish_posts`/`publish_products`). Le frontend ne les appelle pas (il passe par `/propose`, HITL), mais un compte admin connecté selon les instructions du plugin disposerait d'un contournement du HITL. | `backend/routes/wordpress.js:231,243` |
| N13 | 🟢 Info | **Défaut OpenRouter figé sur `anthropic/claude-3.5-sonnet`** (3 occurrences) + `HTTP-Referer: http://localhost:3000` en dur (requis pour l'attribution OpenRouter). | `backend/openrouterService.js` |
| N14 | 🟢 Info | **`initDB()` au chargement du module + `process.exit(1)`** : comportement « fail fast » voulu en production, mais il déclenche un `process.exit` intercepté sous Vitest quand le binding natif `sqlite3` est absent — friction de testabilité pour les modules qui importent `db.js`. | `backend/db.js:333,315` |

### 5.2 Constats de l'audit précédent — état vérifié (tous corrigés ou documentés)

| # | Constat (v1.42.0) | État vérifié en v1.42.12 |
|---|---|---|
| C1 | installer.iss `1.39.2` | ✅ `1.42.12` |
| C2 | techContext Express 5 / `src/store/` | ✅ Express 4 + store.js réel |
| C3 | bug_report placeholder | ✅ mis à jour `1.42.0` (mais cf. N2 — resté à 1.42.0) |
| C4 | FUNDING template vide | ✅ documenté (custom → auceps.com) |
| C5 | « Nodemon trigger » en double | ✅ supprimé |
| C6 | 56 URL `localhost:3000` en dur | ✅ 2 restantes, toutes intentionnelles |
| C7 | Code mort (googlePlacesService, whatsapp-manager) | ✅ supprimé |
| C8 | `/listen/start` répond success sans page | ✅ erreur levée (v1.42.3) |
| C9 | Garde non-Business commentée | ✅ réactivée (v1.42.8) |
| C10 | Hack bandeau quota | ✅ réglage persisté `dismissQuotaBanner` (v1.42.9) |
| C11 | Updater Windows-only | ✅ multi-plateforme (v1.42.10) |
| C12 | `gemini-1.5-pro` résiduel | ✅ remplacé par 2.5-flash (résidus inoffensifs cf. N8) |
| C13 | 7 pages > 800 lignes | ✅ découpées (plus aucune page > 800 ; `ImageEditor.jsx` composant = 850) |
| C14 | Couverture ~0,3 % | ✅ 71 → 114 tests |
| C15 | Double retrait d'indicatif goAfrica | ✅ délégué à phoneRules (gardes de longueur) |
| C16 | OAuth sans TTL | ✅ TTL 10 min (v1.42.5) |
| C17 | CORS `'file://'` | ✅ `null` (v1.42.6) |
| C18 | `disable_safety_checker` forcé | ✅ option respectée (v1.42.11) |
| R1 | CI absent | ⚠️ **toujours absent** (cf. N3) |
| R2 | Pas de validation E.164 | ✅ 8–15 chiffres (v1.42.7) |

---

## 6. Matrice de risques

| Risque | Probabilité | Impact | Atténuation existante |
|---|---|---|---|
| Restriction de compte WhatsApp (automatisation) | Élevée | Critique pour l'usage | Injection d'image seule (pas de saisie auto), délais « humains », avertissements README/SECURITY |
| Fragilité des sélecteurs DOM WhatsApp | Élevée | Moyen | Multi-stratégies (testid → classes → data-id → heuristique), logs masqués |
| Coût IA non maîtrisé | Moyenne | Moyen | Rate-limit, cache Redis 60 s, quota 40 images/mois, liste blanche free-tier |
| Contournement HITL WordPress (N12) | Faible | Moyen | Endpoints legacy non appelés par le frontend ; rôle dédié sans cap d'écriture |
| Port 3000 occupé / backend mort | Moyenne | Moyen | `EADDRINUSE` → exit 1, supervision bornée + dialogue utilisateur |
| Perte de secrets (vol de fichier DB) | Faible | Élevé | AES-256-GCM + clé maître safeStorage (testé) |
| Exfiltration réseau | Très faible | Critique | 127.0.0.1, token, CORS, contextIsolation, IPC restreint |
| Données personnelles de prospects (RGPD) | Moyenne | Élevé (légal) | Documenté dans SECURITY.md ; obligations non déléguées (assumé) |
| Mises à jour jamais proposées | Moyenne | Moyen | Updater corrigé ; **bloqué par l'absence de release ≥ 1.42.12 côté éditeur** (condition sine qua non) |

---

## 7. Recommandations priorisées

### Priorité 1 — Correctifs rapides (½ journée)
1. **N3** — Livrer réellement le workflow CI (`.github/workflows/ci.yml` : checkout, Node 20, `npm ci` racine + backend, `vitest run`, `eslint .`, `vite build`) — il était annoncé comme fait mais n'est ni sur le disque ni dans Git.
2. **N1/N2/N7/N10** — Synchroniser les versions résiduelles (README imbriqué, placeholder bug report, `package-lock.json` ×2) ; étendre `bump_version.sh` pour couvrir `whatsapp-ai-saas/README.md` et les lockfiles ; ajouter un `LICENSE` à la racine ; mettre à jour le changelog de `Support.jsx`.
3. **N12** — Supprimer (ou protéger derrière un flag explicite) les routes de proxy d'écriture directe `POST /:id/posts` et `POST /:id/products` non utilisées par le frontend.

### Priorité 2 — Dette légère (courts sprints)
4. **N4** — Compléter `es.json` et `ar.json` (objectif : parité avec fr/en) ou, a minima, documenter clairement le niveau de couverture.
5. **N5** — Retirer `goafrica-tg-annuaire.html` du suivi Git (régénérer la structure via un fetch réseau documenté) ou l'exclure explicitement ; c'est un snapshot tiers de 116 Ko.
6. **N8/N11/N13** — Nettoyer les résidus `gemini-1.5-pro`, aligner `.env.example` sur le catalogue réel, centraliser les défauts de modèle OpenRouter.
7. **N6/N9/N14** — Supprimer le handler `ping` mort, corriger la typo « unistall », évaluer une initialisation DB moins intrusive pour les tests (ex. option d'export `initDB` séparée du chargement de module).

### Priorité 3 — Améliorations produit
8. **Mises à jour** — Publier une release ≥ 1.42.12 dans `wacopilote-releases` (condition sine qua non pour activer l'updater).
9. **Tests** — Étendre aux parseurs de scraping (extraire la logique de `page.evaluate()`), aux adaptateurs LLM (mocks fetch) et aux migrations de schéma, conformément à la feuille de route Q3 2026.
10. **Feuille de route 2027** — WhatsApp Cloud API / Baileys, assistant vocal, version SaaS synchronisée : cohérente avec les constats.

---

## 8. Conclusion

WaCopilote est un projet **fonctionnel, cohérent et honnêtement documenté**. L'audit confirme l'excellence de sa sécurité locale (token + 127.0.0.1 + AES-256-GCM + safeStorage + masquage des logs + HITL WordPress) et la qualité de ses vérifications (114 tests verts, ESLint 0, build OK). Les 20 constats de l'audit précédent ont été traités ; **14 constats résiduels** subsistent, tous mineurs sauf deux points moyens : **l'absence réelle du CI** (annoncé comme livré) et **l'i18n es/ar incomplète**. Aucune faille critique n'a été identifiée dans le modèle de menace déclaré (application 100 % locale).

**Livrables associés :** `carte-mentale-lunar-nova.svg` / `.png` (carte mentale graphique), à côté des artefacts historiques `AUDIT_WACOPILOTE.md`, `TRAITEMENT_AUDIT.md` et `carte-mentale-wacopilote.svg/.png`.
