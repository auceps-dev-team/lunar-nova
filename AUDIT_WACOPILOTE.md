# 🔍 Audit Complet — WaCopilote (dépôt `lunar-nova`)

> **✅ STATUT : TRAITÉ — 2026-08-21.** Tous les points de cet audit ont été
> vérifiés puis corrigés ou documentés, conformément aux règles de versionnage
> du dépôt. Le journal détaillé des modifications (vérification anti faux
> positifs, boucles de contrôle, bumps `+0.0.1` et changements « autres »
> commentés) se trouve dans **[TRAITEMENT_AUDIT.md](TRAITEMENT_AUDIT.md)**.
> Version résultante : **1.42.11** — 100 tests verts, ESLint 0, build OK.

**Version audité :** 1.42.0 — commit `e1bb3ef` (branche `arena/01a023d0-lunar-nova`)
**Date de l'audit :** 2026-08-21
**Périmètre :** 216 fichiers suivis par Git, 129 fichiers de code (JS/JSX/CJS), ~29 575 lignes
**Méthode :** lecture intégrale de chaque fichier (backend, frontend, Electron, plugin WordPress, docs, configs, CI), exécution des tests, du lint et du build de production.

---

## 1. Synthèse exécutive

WaCopilote est une **application desktop Electron** (React 19 / Vite 7 / Express) qui fusionne
automatisation WhatsApp Web, agents IA multi-fournisseurs, studio photo IA, prospection B2B et
pont WordPress/WooCommerce. Le dépôt est sain sur le plan structurel : **l'architecture à 3
processus est claire, la posture de sécurité est remarquablement soignée pour un produit interne
ouvert au public, et les 71 tests passent, le lint est à zéro erreur, le build de production
réussit.**

Les points faibles sont des dettes de maturité assumées et documentées par l'équipe : couverture
de tests très faible (~0,3 %), pages frontend de 800 à 1 021 lignes, quelques incohérences de
version et de configuration, et du code mort non nettoyé. Aucune faille critique n'a été
détectée dans le modèle de menace déclaré (application 100 % locale).

| Domaine | Verdict |
|---|---|
| Architecture & conception | ✅ Très bon |
| Sécurité & secrets | ✅ Très bon (quelques points de vigilance) |
| Qualité du code (lint, build) | ✅ Bon |
| Tests | ⚠️ Faible (71 tests, couverture ~0,3 %) |
| Maintenabilité (taille des pages, duplication) | ⚠️ Dette réelle |
| Documentation | ✅ Bonne, mais quelques incohérences |
| Automatisation WhatsApp | ⚠️ Fragile par nature (sélecteurs DOM de Meta) mais bien défendue |

---

## 2. Identité du projet

| Attribut | Valeur |
|---|---|
| Nom | WaCopilote |
| Dépôt | `auceps-dev-team/lunar-nova` |
| Origine | Abidjan, Côte d'Ivoire — produit interne devenu open source en v1.36.0 |
| Licence | AGPL-3.0 (plugin WordPress : GPL-2.0-or-later) |
| Stack | Electron 40, React 19, Vite 7, Zustand 5, Tailwind 3, Express 4, SQLite (sqlite3/sqlite), Redis, Playwright + Puppeteer-core, i18next |
| Fournisseurs IA | Google Gemini, NVIDIA NIM, OpenRouter, Together AI, Ollama (local) |
| Public cible | Commerçants/e-commerçants (CI, Sénégal, Cameroun, France…), agences, équipes commerciales |

**Rôles des trois processus** (bien délimités, c'est la force du projet) :

1. **Renderer** (`src/`) — React 19 dans une fenêtre Electron ; environnement navigateur pur.
2. **Process principal Electron** (`electron/`) — CommonJS ; lance le backend en production, gère
   fenêtres, clé maître `safeStorage`, mise à jour.
3. **Backend Express** (`backend/`) — CommonJS, écoute sur `127.0.0.1:3000` uniquement ; parle aux
   fournisseurs d'IA, à SQLite, à Redis, et pilote WhatsApp Web via CDP (port 8315).
   + **4e environnement** : le code injecté dans la page WhatsApp via `page.evaluate()`
   (sélecteurs DOM de WhatsApp Web).

---

## 3. Vérifications exécutées (état constaté, pas des promesses)

| Vérification | Commande | Résultat |
|---|---|---|
| Tests unitaires | `npx vitest run` | ✅ **6 fichiers / 71 tests, 100 % réussite** (llmJson 18, phoneRules 20, secretStore 11, logRedact 8, phoneFormat 13, example 1) |
| Lint | `npx eslint .` | ✅ **0 erreur, 0 avertissement** (config ESLint 9 par environnement, bien conçue) |
| Build production | `npx vite build` | ✅ **Réussite** (11,5 s ; chunks manuels vendor/ui/i18n ; html2pdf 975 kB gzip 281 kB) |
| Install backend | `npm install` | ⚠️ `sqlite3@6.0.1` échoue à compiler dans le bac à sable (réseau prébuild) — limitation du bac à sable, pas du projet |
| Secrets en Git | `git ls-files` | ✅ Aucun `api-token`, `master-key`, `database.sqlite`, `.env` ni dump de scraping traqué |
| Historique | `git log` | 1 commit squashe ; `SECURITY.md` documente honnêtement 2 fichiers de données retirés en v1.38.1 |

---

## 4. Audit détaillé par module

### 4.1 Backend Express — `backend/server.js` + routes

**Ce qui est bien fait :**
- Écoute sur **127.0.0.1** explicite (`HOST = '127.0.0.1'`), avec commentaire expliquant pourquoi
  (sans cela, Node écoute sur 0.0.0.0 et expose clés LLM + contacts au réseau local).
- **Token d'API sur toutes les routes** (`requireApiToken`), comparaison à temps constant via
  SHA-256 + `timingSafeEqual`, fichier `api-token` en mode `0600`, création exclusive `'wx'`
  (convergence sans verrou entre Electron et backend au démarrage parallèle).
- CORS restreint ; rate-limiting à 3 niveaux (global 2000/15 min, lourd 30/15 min, IA 100/15 min) ;
  `express.json({ limit: '50mb' })` justifié par les images base64.
- Routes SSE correctement conçues : token en query uniquement sur les chemins SSE (EventSource ne
  peut pas poser d'en-tête), heartbeat, nettoyage à la déconnexion.
- Montage des routers corrigé (documenté : 4 routers étaient montés sur `/` avec préfixe en
  double — `/api/documents/api/documents`). Le doublon a été éliminé.

**Points de vigilance :**
- `allowedOrigins = ['http://localhost:5173', 'file://']` : pour une page chargée en `file://`,
  le navigateur envoie souvent `Origin: null` — la chaîne `'file://'` peut ne jamais matcher.
  En pratique le renderer Electron est filtré par le token ; à surveiller si un jour l'app est
  servie depuis `http://localhost` en production.
- Gestion d'erreur `server.on('error')` propre (EADDRINUSE → `process.exit(1)`) ; cohérente avec
  le mécanisme de redémarrage d'Electron.

### 4.2 Persistance — `backend/db.js`

**Conception notable :** un **shim PostgreSQL → SQLite** (`pool.query`) qui traduit `$1…$n` en `?`
et `SERIAL PRIMARY KEY`/`JSONB` en dialecte SQLite. Cela a permis de développer contre une
interface « Postgres » sans réécrire le code — choix pragmatique, mais qui crée une couche de
traduction fragile (toute requête SQL doit rester dans le sous-ensemble commun).

- **Migrations versionnées** (6 migrations) avec enregistrement de version **uniquement en cas de
  succès** — l'ancien comportement avalait les erreurs et marquait la migration comme appliquée
  (corrigé, avec commentaire détaillé).
- **Chiffrement des secrets au repos** : `encryptLegacySecrets()` rend la migration idempotente ;
  `getSetting`/`setSetting` chiffrent tout champ finissant par `_api_key` ; mots de passe
  d'application WordPress également chiffrés.
- Le démarrage attend désormais `ready = initDB()` avant de répondre (corrige une course où une
  requête IA partait sans clé ni persona).

### 4.3 Sécurité & secrets — `apiAuth.js`, `secretStore.js`, `logRedact.js`, `electron/main.cjs`

C'est le point le plus soigné du dépôt. **Points forts :**
- **AES-256-GCM** au repos, IV aléatoire (deux chiffrements du même secret diffèrent — testé),
  préfixe `enc:v1:`, valeur altérée → échec de déchiffrement au lieu de données corrompues
  (testé), chaîne vide comme sentinelle « secret absent ».
- **Clé maître scellée par `safeStorage`** (DPAPI/Trousseau/libsecret) en production, jamais dans
  la base ; repli documenté sur fichier clair si le keyring système est indisponible ; migration
  d'une clé claire existante vers la clé scellée sans casser les secrets.
- **Masquage des logs** : `logRedact.js` remplace le contenu des messages WhatsApp par leur
  longueur et les noms de contacts par une initiale + astérisques, sauf
  `WACOPILOTE_LOG_MESSAGES=1` pour le diagnostic. Les tests vérifient que ni numéros ni noms
  n'apparaissent. C'est une vraie amélioration de vie privée (les logs sont joints aux issues).
- Secrets **jamais renvoyés par le GET /api/settings** : champ vide + indicateur `secretsSet`
  (l'UI affiche « configurée » sans exposer la clé).
- Electron : `contextIsolation: true`, `nodeIntegration: false`, IPC restreint (preload),
  token via IPC uniquement.
- WordPress : Basic Auth via **Application Passwords** (pas de clé API maison), décryptage
  centralisé dans `loadConnection()` — un seul point de déchiffrement.

**Points de vigilance :**
- **Sécurité du scanner de numéros** : `verify-contact` navigue le webview WhatsApp vers
  `web.whatsapp.com/send/?phone=…` et analyse la modale — le numéro est traité comme entrée de
  requête non validée côté backend (il est nettoyé par regex). Risque faible (boucle locale +
  token), mais aucune validation stricte (ex. `E.164`) en entrée de route.
- **Gouvernance HITL WordPress côté client** : le backend proxy appelle `/execute/:actionId`
  sans vérifier qu'une action est bien `pending_review` — la vérification est côté plugin PHP
  (capabilité + statut). Acceptable, mais la confiance repose sur le plugin.
- `openaiService.js` : `disable_safety_checker: true` sur Together AI/Qwen (assumé et commenté —
  « nécessaire pour les prompts fashion/editorial »). C'est un risque de conformité ToS du
  fournisseur plus que de sécurité applicative.

### 4.4 Passerelle IA multi-fournisseurs — `aiController.js` + 5 adaptateurs + `nvidiaModels.js`

- **`aiController.js`** centralise le routage par provider (gemini / openrouter / ollama / openai)
  avec **résolution de clé à 4 niveaux** (clé modèle en DB → clé globale `openai_api_key` → clé
  système `.env` → `NVIDIA_DEFAULT_API_KEY`). Détection d'image → bascule auto vers un modèle
  vision ; audio → bascule forcée Gemini.
- **`geminiService.js`** : quota « free tier » de 40 images/mois avec remise à zéro au 5 du mois
  (logique de reset sur mois précédent incluse), liste blanche de modèles sur clé gratuite,
  fallbacks manuels de catalogue d'images (Nano Banana 2/Pro, Imagen 4/Ultra), templates de
  prompts produit/fashion avec consignes de modestie explicites.
- **`nvidiaModels.js`** : catalogue de ~80 modèles avec paramètres de génération déclarés
  (maxTokens, temperature, reasoning_effort/budget, chat_template_kwargs) consommés par
  `buildGenerationParams()` — élimine les `if (model === …)` éparpillés. Très bien conçu.
- **`openaiService.js`** : sanitisation de prompt pour Together (`sanitizePromptForTogether`),
  gestion des modèles reasoning (`reasoning_content`), endpoints NVIDIA `/vision/` avec tentative
  alternative point/underscore en 404.
- **`openrouterService.js` / `ollamaService.js`** : cohérents, sync des catalogues en cache SQLite.

**Points de vigilance :**
- `geminiService.generateProposals` a encore un **défaut `gemini-1.5-pro`** comme modèle par
  défaut alors que le reste de l'app est passé à 2.5 Flash (ligne 149). Incohérence mineure.
- `getGeminiClient` relit la clé en DB à chaque appel : correct pour le runtime, mais pas de
  cache — coût DB négligeable.
- Le « `_apiKey` » d'Ollama sert de clé cloud (https://ollama.com) ; sans clé, mode local
  127.0.0.1:11434. OK.

### 4.5 Agents & personas — `agents/orchestrator.js` + 27 personas

- Orchestrateur singleton qui charge dynamiquement les fichiers `personas/*.js` (Map par `id`).
- **27 personas** (conforme au README) : `copywriter` (Jarvis SDR), `creative` (Clarisse DA,
  JSON structuré pour product uplifting), `ella` (assistante vie privée, actions JSON
  ADD/UPDATE/DELETE_TASK), `order_radar` (classifieur d'intention, seuil de confiance),
  `prospecting_agent` (brief → params structurés JSON), `pipeline_organizer`, `brand_guardian`,
  `sales_coach` (273 lignes), `outbound_strategist` (207 lignes), `legal_compliance`, etc.
- Chaque persona déclare `inputTypes`, `outputFormat`, `requiresVisionModel` — le frontend et les
  services s'appuient dessus (`requiresJsonFormat`).

**Vigilance :** la plupart des personas sont des **prompts statiques** (jusqu'à 328 lignes pour
`brand_guardian`) — pas de versioning ni de tests sur les prompts. `pipeline_organizer` note
explicitement « No LLM call in v1 ». La cohérence entre le `id` du persona et les noms utilisés
dans les routes (ex. `copywriter`, `outbound_strategist`) est vérifiée mais fragile.

### 4.6 Automatisation WhatsApp — `orderListener.js`, `routes/wa.js`, `routes/catalog.js`

- **`orderListener.js`** : moteur de détection de commandes (IOL). Triple stratégie DOM
  (data-testid stables → classes legacy → `data-id` `true_/false_` + heuristique d'alignement),
  déduplication à **fenêtre glissante bornée (500)** — corrige un Set infini dans l'onglet,
  poller 3 s + MutationObserver, pipeline « message → mots-clés → classif IA → seuil de
  confiance 0,5 → DB + événement SSE ». Redaction des logs appliquée partout.
- **`routes/wa.js`** : CRUD contacts/listes/segments, import bulk transactionnel avec index
  unique partiel sur `phone`, template de message dynamique (`[Nom]`, `[Email]`, `[Adresse]`),
  **mutex global** autour de l'accès CDP, `verify-contact` avec course VALIDE/INVALIDE/TIMEOUT
  (18 s) et correction d'un UPDATE trop large (LIMIT 1).
- **`routes/catalog.js`** : injection **image seule** dans le formulaire du catalogue WhatsApp
  Business (le nom/prix/description restent à coller par l'humain) — choix explicite pour
  réduire le risque de restriction de compte ; délais « humains » 1,5–5 s ; nettoyage du fichier
  tempore dans le `finally`.

**Vigilance :**
- `attachObserver()` : si aucune page WhatsApp n'est trouvée, la route `/api/orders/listen/start`
  répond **quand même `success`** (le `return` anticipé ne signale pas d'erreur) → l'UI affiche
  « écoute active » alors que rien n'est branché. À corriger (retour d'erreur).
- `catalog.js` : la garde « SECURITY BLOCK » pour compte non-Business est **commentée** — le
  code journalise un warning et continue. Choix assumé ? Le commentaire dit « Proceeding with
  caution », mais le `throw` est neutralisé.
- Duplication : commentaires `// Nodemon trigger` en double (routes/wa.js lignes 610-612).
- WhatsApp Web reste une cible mouvante : les sélecteurs sont régulièrement refondus par Meta ;
  le code est bien défendu mais intrinsèquement fragile (documenté par l'équipe).

### 4.7 Scrapers de prospection — `annuaireCiScraper`, `goAfricaScraper`, `googleMapScraper`, `phoneRules`

- **`phoneRules.js` est le point fort** : tables de préfixes fixes par pays, retrait de
  l'indicatif **avant** comparaison (corrige le bug des prospects togolais/camerounais écartés —
  l'indicatif 228/237 commençait par son propre préfixe fixe 22/23 — c'est le fix du commit),
  liste noire volontaire (conserver un douteux coûte un appel, en écarter un bon coûte un
  client), 20 tests dédiés.
- Les trois scrapers délèguent maintenant à `phoneRules` (retraits de cascades de conditions en
  dur) et émettent des événements de progression pour le SSE.
- `googleMapScraper` : cache de session LRU (10 sessions, TTL 1 h), **garde anti-concurrence**
  `_isRunning` (une seule recherche Google Maps à la fois, message clair), scrolling infini du
  feed avec détection de fin.
- `scripts/fetchGoAfricaStructure.js` : génération de la structure depuis un HTML local (plus
  d'`exec('node …')` qui cassait l'app packagée).

**Vigilance :**
- `backend/googlePlacesService.js` est **du code mort** (aucun import trouvé) et contient un
  **bug de regex** : `/^\+225[01|05|07]/` — dans une classe de caractères `[...]`, `01|05|07`
  signifie l'ensemble {0,1,|,5,7} ; des mobiles ivoiriens 02/03/04/06/08/09 seraient donc
  classés « fixes » et filtrés, et l'opérateur `|` est littéral. À corriger ou supprimer.
- `goafricaScraper` retire l'indicatif du pays **avant** `isLandline` (double retrait ensuite
  dans `toNationalNumber` — inoffensif car la garde de longueur empêche l'amputation, mais à
  nettoyer).

### 4.8 Pont WordPress — `routes/wordpress.js` + plugin `wacopilote-bridge` v2.0.0

- Routeur proxy complet : connexions (CRUD + test), stats, posts, pages, produits (avec filtres
  paginés), commandes, SEO meta, analytics (dates), actions **HITL** (`propose` → `pending_review`
  → `execute`/rejet par un admin), upload média multipart (multer mémoire, forward FormData),
  logs.
- Plugin PHP (1 253 lignes) : CPT `wa_ai_action` avec statuts personnalisés
  `pending_review`/`wa_approved`/`wa_rejected`, rôle `wacopilote_agent_role` **propose-only**
  (capabilité `wacopilote_propose`, aucune écriture directe), table d'audit `wacopilote_logs`,
  interface admin de revue, alerte admin quand des propositions attendent, `uninstall.php`
  propre (options + multisite). Architecture HITL réellement implémentée des deux côtés.
- Archive `wacopilote-bridge-v2.0.0.zip` fournie ; docs de conception très détaillées (PDF 419 Ko
  + 49 Ko de texte).
- Licence du plugin : GPL-2.0-or-later (exception documentée dans le README) — correct pour
  l'écosystème WP.

**Vigilance :** `wpFetch` ne vérifie pas le **certificat SSL** de manière explicite (fetch standard
— vérifie par défaut, OK) ; le proxy n'expose pas les erreurs réseau de façon détaillée (message
générique + statut). Rien de bloquant.

### 4.9 Electron — `main.cjs`, `preload.cjs`, `updater.cjs`, `whatsapp-manager.cjs`

- **`main.cjs`** : démarrage du backend en production via `utilityProcess.fork` avec
  `USER_DATA_PATH`, clé maître `safeStorage`, **supervision avec redémarrage borné (3 × 2 s)**
  puis dialogue d'erreur explicite (port 3000 occupé, échec d'init DB) ; création du token en
  dev comme en prod alignée sur `apiAuth.js` ; export PDF (fenêtre cachée → `printToPDF` →
  dialogue d'enregistrement) ; `webviewTag: true` avec `contextIsolation` et
  `nodeIntegration: false` ; User-Agent Chrome 120 forcé (contourne l'erreur « navigateur non
  supporté » de WhatsApp).
- **`updater.cjs`** : mise à jour auto maison (pas d'`electron-updater` utilisé) — check GitHub
  Releases (`wacopilote-releases`), téléchargement streamé avec progression throttlée, install
  silencieuse NSIS détachée (`/S --force-run`), garde `getMainWindow()` (corrige un bug où la
  fenêtre était capturée avant sa création).

**Vigilance :**
- Mise à jour **Windows uniquement** (`exe` recherché dans les assets ; `spawn` d'un `.exe`) ;
  macOS/Linux n'ont pas de chemin d'auto-update fonctionnel (échec silencieux → `hasUpdate:
  false` sur erreur, ou téléchargement impossible). `electron-updater` est en dépendance mais
  inutilisé.
- `whatsapp-manager.cjs` (26 lignes) semble **inutilisé** (aucun import dans main.cjs) — code
  mort.

### 4.10 Frontend React — `src/` (129 fichiers côté global)

- **Store Zustand** (`store.js`) : persistance **IndexedDB** (via `idb-keyval`) au lieu de
  localStorage, `partialize` exclut `waAnalysis`/`updateAvailable`/`backendSettings`/
  `availableModels` (pas de bannière de mise à jour périmée), actions bien découpées
  (IOL, quota, modèles globaux, tâches, factures).
- **Authentification API élégante** (`services/apiAuth.js`) : patch de `fetch` et `EventSource`
  au démarrage pour injecter le token — évite de modifier la centaine d'appels ; hors Electron,
  repli sur `VITE_API_TOKEN`.
- **App.jsx** : 348 lignes propres, lazy-loading de toutes les pages, bannière de mise à jour
  avec comparaison sémantique de versions, modale post-mise-à-jour, bandeau de quota d'images,
  WorkArea **toujours monté mais masqué par CSS** (préserve la mémoire/DOM des webviews) —
  astuce Electron documentée comme CRITICAL.
- **i18n** : 4 locales (fr 58 Ko, en 52 Ko, es 17 Ko, ar 21 Ko), direction RTL pour l'arabe,
  langue par défaut `fr`.
- **Composants réutilisables** : CustomSelect, ErrorBoundary, SkeletonLoader, Kanban (dnd-kit),
  éditeur d'images (850 lignes), builder de factures (templates HTML + export PDF via IPC),
  JarvisChat pour WordPress.

**Vigilance :**
- **56 références codées en dur à `http://localhost:3000`** dans `src/` au lieu d'utiliser
  `API_BASE_URL` (16 fichiers : WorkArea, JarvisChat, hooks, 10+ pages). Fonctionne grâce au
  patch de `apiFetch`, mais tout changement de port/VITE_API_URL casserait silencieusement
  certaines pages.
- Pages > 800 lignes : WordPressBridge (1 021), PhotoShoot (940), Contacts (896),
  AdvancedAnalytics (865), InvoiceBuilder (829), AgentsHub (815), AiChat (798) — dette assumée
  dans le README, mais l'effort de découpage reste à faire.
- **Hack assumé** dans App.jsx (ligne 239) : fermer le bandeau de quota réécrit l'état
  `aiQuota` en `imageLimit: 99999, hasCustomKey: true` « pour la session » — contournement
  temporaire qui désactive l'avertissement ; à remplacer par un vrai « ne plus afficher ».
- `WorkArea.jsx` (683 lignes) : gros composant mêlant styles inline et scripts d'extraction
  stringifiés ; priorité de refactoring.

### 4.11 Tests & qualité

- 6 fichiers de tests, 71 tests, tous verts. Couverture concentrée sur les zones qui « cassent
  vraiment » : parsing JSON LLM, redaction de logs, règles téléphoniques (avec régression
  Togo/Cameroun), chiffrement des secrets, format de numéros. **Choix ciblé et pertinent**.
- ESLint 9 avec 5 blocs d'environnements (renderer, backend/electron, code injecté page
  WhatsApp, configs, tests) — config exemplaire, commentaires pédagogiques.
- `vite.config.js` : `manualChunks` vendor/ui/i18n, `chunkSizeWarningLimit: 3000`.
- **Limite :** ~0,3 % de couverture sur ~29 575 lignes ; pas de tests pour les routes Express,
  les adaptateurs LLM (mock), l'orderListener, les scrapers (hors phoneRules) ni les
  migrations. C'est exactement ce que la feuille de route Q3 2026 annonce.

### 4.12 Documentation & DevOps

- README (31 Ko) exhaustif et **honnête** (section « Sur l'état du projet ») ; CONTRIBUTING
  précis (4 environnements d'exécution, conventions de commit) ; SECURITY avec modèle de menace
  clair et transparence sur les données dans l'historique Git.
- `.github` : templates d'issues (bug/feature) de bonne qualité, config.yml (issues vierges
  désactivées, contacts dédiés), PULL_REQUEST_TEMPLATE.
- Memory-bank (5 fichiers) : utile, mais **`techContext.md` est périmé** (« Express.js 5 » alors
  que le projet est en Express 4.21.2 ; mentionne un store `src/store/` inexistant).
- `docs/` : carte mentale du projet + template d'impact + conception WordPress très détaillée.

---

## 5. Constats vérifiés — inventaire complet

| # | Sévérité | Constat | Fichier(s) |
|---|---|---|---|
| C1 | 🟢 Info | `build/installer.iss` annonce la version **1.39.2** (stale) | `build/installer.iss` |
| C2 | 🟢 Info | `memory-bank/techContext.md` mentionne Express 5 et `src/store/` — périmé | `memory-bank/techContext.md` |
| C3 | 🟢 Info | Placeholder de version « 1.39.1 » dans le gabarit de bug | `.github/ISSUE_TEMPLATE/bug_report.yml` |
| C4 | 🟢 Info | `FUNDING.yml` est le template vide par défaut (tout commenté) | `.github/FUNDING.yml` |
| C5 | 🟢 Info | Commentaires « Nodemon trigger » en double | `backend/routes/wa.js:610-612` |
| C6 | 🟡 Moyen | **56 URL `localhost:3000` en dur** dans le frontend (16 fichiers) | `src/**` |
| C7 | 🟡 Moyen | **Code mort :** `googlePlacesService.js` (non importé) avec **bug de regex** `[01|05|07]` ; `whatsapp-manager.cjs` (non importé) | `backend/googlePlacesService.js`, `electron/whatsapp-manager.cjs` |
| C8 | 🟡 Moyen | `/api/orders/listen/start` répond `success` même si aucune page WhatsApp n'est trouvée | `backend/orderListener.js` (attachObserver) |
| C9 | 🟡 Moyen | Garde « compte non-Business » **commentée** dans l'automatisation catalogue | `backend/routes/catalog.js` |
| C10 | 🟡 Moyen | Hack « masquer le bandeau de quota » : réécrit `imageLimit: 99999` pour la session | `src/App.jsx:239` |
| C11 | 🟡 Moyen | Auto-update **Windows uniquement** (asset `.exe`) ; `electron-updater` en dépendance mais inutilisé | `electron/updater.cjs` |
| C12 | 🟡 Moyen | Défaut de modèle `gemini-1.5-pro` restant dans `generateProposals` (incohérent avec le reste en 2.5 Flash) | `backend/geminiService.js:149` |
| C13 | 🟠 Élevé (dette) | 7 pages frontend > 800 lignes (jusqu'à 1 021) | `src/pages/*` |
| C14 | 🟠 Élevé (dette) | Couverture de tests ~0,3 % — aucune route, adaptateur ou scraper testé | global |
| C15 | 🟢 Info | Double retrait d'indicatif dans goAfrica (sans effet grâce à la garde de longueur) | `backend/scrapers/goAfricaScraper.js` |
| C16 | 🟢 Info | Sessions OAuth en mémoire sans TTL (nettoyées à la lecture uniquement) | `backend/routes/authGoogle.js` |
| C17 | 🟢 Info | CORS `'file://'` probablement inefficace (Origin vaut souvent `null`) — compensé par le token | `backend/server.js` |
| C18 | 🟢 Info | `disable_safety_checker: true` sur Together/Qwen (assumé, risque ToS fournisseur) | `backend/openaiService.js` |

---

## 6. Matrice de risques

| Risque | Probabilité | Impact | Atténuation existante |
|---|---|---|---|
| Restriction de compte WhatsApp (automatisation) | Élevée | Critique pour l'usage | Délais humains, injection image seule (pas de saisie auto), avertissements dans README/SECURITY |
| Fragilité des sélecteurs DOM WhatsApp | Élevée | Moyen | Multi-stratégies (testid → classes → data-id → heuristique), logs de diagnostic masqués |
| Coût IA non maîtrisé | Moyenne | Moyen | Rate-limit, cache Redis 60 s, quota 40 images/mois, liste blanche free-tier |
| Porte 3000 occupée / backend mort | Moyenne | Moyen | `EADDRINUSE` → exit 1, supervision + redémarrage borné + dialogue utilisateur |
| Perte de secrets (vol de fichier DB) | Faible | Élevé | AES-256-GCM + clé maître safeStorage ; testée |
| Exfiltration réseau | Très faible | Critique | 127.0.0.1, token, CORS, contextIsolation, IPC restreint |
| Données personnelles de prospects (RGPD) | Moyenne | Élevé (légal) | Documenté dans SECURITY.md ; le logiciel n'« acquitte pas les obligations » (assumé) |

---

## 7. Recommandations priorisées

### Priorité 1 — Correctifs rapides (½ journée)
1. **C8** — `orderListener.attachObserver()` : renvoyer une erreur si aucune page WhatsApp n'est
   trouvée (l'UI ment actuellement).
2. **C6** — Remplacer les 56 `http://localhost:3000` par `API_BASE_URL` (mécanique, low risk).
3. **C7** — Supprimer `googlePlacesService.js` (mort + bug) et `whatsapp-manager.cjs`, ou les
   corriger et brancher `phoneRules`.
4. **C1/C2/C3** — Aligner versions (installer.iss, memory-bank, placeholder bug report).

### Priorité 2 — Dette de maintenabilité (courts sprints)
5. **C13** — Découper les 3 plus grosses pages (WordPressBridge, PhotoShoot, Contacts) : extraire
   les composants locaux (> 300 lignes) dans `src/components/…`.
6. **C12** — Uniformiser les modèles par défaut sur Gemini 2.5 Flash.
7. **C10** — Remplacer le hack du bandeau de quota par un vrai réglage « ne plus afficher »
   (persisté dans `appSettings`).
8. **C14** — Étendre les tests dans l'ordre préconisé par le README : parseurs de scraping
   (extraire la logique de `page.evaluate()`), adaptateurs LLM (mocks fetch), migrations de
   schéma. Cible : +3 fichiers de tests.
9. **C11** — Documenter l'absence d'auto-update macOS/Linux ou implémenter un canal multi-OS.

### Priorité 3 — Améliorations produit
10. **C9** — Trancher la garde « compte non-Business » : soit réactiver le blocage, soit
    l'officialiser en mode « assistance guidée ».
11. **C16** — TTL sur les sessions OAuth (ex. 10 min) pour éviter la croissance mémoire.
12. **C17** — Tester le CORS en production (`file://` vs `null`) et ajuster la liste blanche.
13. **CI** — Ajouter un workflow GitHub Actions : `npm ci` + `vitest run` + `eslint` + `vite
    build` (aucun CI n'existe aujourd'hui).
14. **Sécurité** — Validation E.164 en entrée de `verify-contact`/`open-chat` ; revue du
    `disable_safety_checker`.

---

## 8. Conclusion

WaCopilote est un projet **fonctionnel, cohérent et honnêtement documenté**, avec une
architecture de sécurité locale exemplaire (token, 127.0.0.1, chiffrement au repos, masquage des
logs, HITL WordPress) et une séparation des environnements d'exécution maîtrisée. Les 71 tests,
le lint et le build passent sans erreur au moment de l'audit.

Les axes d'amélioration sont **la dette de maturité assumée** (tests, taille des pages, code
mort, incohérences de version) — aucune faille critique n'a été identifiée dans le modèle de
menace déclaré. La feuille de route 2026 (tests des scrapers/adaptateurs, WhatsApp Cloud API,
assistant vocal) est cohérente avec les constats de cet audit.

**Note :** l'installation des dépendances natives (`sqlite3`) a échoué dans le bac à sable pour
une raison de réseau (prébuild non téléchargeable) — non imputable au projet ; tous les tests ont
été exécutés avec les dépendances JS installées et passent.
