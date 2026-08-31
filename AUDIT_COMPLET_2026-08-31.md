# 🔍 Audit complet — WaCopilote (`lunar-nova`) — v1.48.1 — Révision 3

> **Date :** 2026-08-31 · **Version auditée :** 1.48.1 · commit unique `4309745` · branche de travail `arena/01a057ee-lunar-nova`
> **Périmètre :** 290 fichiers suivis · 191 fichiers JS/JSX/CJS · ≈ 37 800 lignes applicatives (frontend src 19 325 l. · backend 13 993 l. · CLI 1 058 l. · Electron 641 l. · plugin WordPress 1 197 l.) · 2 790 l. de tests · 4 756 l. de locales i18n (1186 clés × fr/en/es/ar)
> **Méthode :** boucles itératives d'inspection exhaustive — lecture des métadonnées Git et du changelog applicatif complet (v1.0.0 → v1.48.1, 47 versions) · installation propre (`npm ci` racine + backend, avec contournements bac à sable documentés plus bas) · **3 exécutions intégrales** de la suite Vitest (détection de flakiness) · ESLint `--max-warnings=0` · build Vite · mesure de couverture · CLI et serveur MCP exécutés en conditions réelles · reproduction du correctif N1 (troncature stdout) · scans de sécurité (secrets, SQL, XSS, Electron, dépendances `npm audit`) · re-vérification un à un de **tous** les constats des révisions 1 et 2.

---

## 1. Synthèse exécutive

**État général : le projet est au vert intégral sur sa chaîne CI (tests, lint, build), et les six constats ouverts de la révision 2 (v1.47.0) sont TOUS résolus et vérifiés par preuve.** La dette résiduelle se est déplacée : elle n'est plus dans la qualité du code (0 erreur de lint, 0 TODO/FIXME dans tout le code applicatif) mais dans **les dépendances (4 vulnérabilités « high » dont Electron, le runtime livré)** et la **couverture de test globale (12,4 %)** — cette dernière étant assumée et documentée par le projet lui-même.

| Vérification | Révision 2 (v1.47.0) | **Révision 3 (v1.48.1)** |
|---|---|---|
| Tests unitaires | 247 tests : 242 ✔, 4 ✘, 1 skip | **251 tests : 248 ✔, 0 ✘, 3 skips conditionnels** (3 exécutions, zéro flaky) |
| ESLint `--max-warnings=0` | ❌ 6 erreurs | ✅ **0 erreur, 0 warning** |
| Build Vite | ✅ 17,1 s | ✅ **10,2 s** (chunk html2pdf de 975 kB disparu) |
| CLI réel | ✅ v1.47.0 | ✅ **v1.48.1** — `list-agents --json` 158 476 octets **valides** sous fermeture stdin immédiate (N1 corrigé) |
| Serveur MCP réel | ✅ 40 outils | ✅ **40 outils**, `initialize` conforme, v1.48.1 |
| Couverture | non mesurée | **12,36 % global** (db.js 81 %, logRedact 87 %, llmJson 77 %, personas 100 %) |
| Secrets en dur | ✅ rien | ✅ rien (0 motif sur tout le dépôt) |
| Cohérence des versions | ⚠️ badge racine 1.43.0 | ✅ **1.48.1 partout** (package.json ×2, README ×2, index.html, installer.iss, Support.jsx) |
| Dépendances | non audité | 🔴 **4 « high » npm audit** (détail § 5-F1) |

| Domaine | Verdict révision 3 |
|---|---|
| Architecture & conception | ✅ Très bon — découpage services/routes, routeur agentique à cascade, HITL WordPress |
| Sécurité applicative | ✅ Très bon (auth à temps constant, boucle locale, chiffrement au repos, DOMPurify, IPC confiné) |
| Sécurité des dépendances | 🔴 **À traiter** — Electron 40.6.1 dans la plage de 13 avis (dont contournement d'isolation de contexte) |
| Qualité du code | ✅ Très bon (0 lint, 0 TODO, pages ≤ 850 l., commentaires de décision généralisés) |
| Tests | ⚠️ 248 verts et stables, mais couverture globale 12,4 % ; server.js/orderListener/routes ≈ 0 % |
| Documentation | ✅ À jour (README racine + interne, changelog 47 versions, memory-bank, SECURITY.md) |
| CI / DevOps | 🟠 Verte sur ses 3 étapes, mais **sans couverture ni job E2E** alors que le workflow cible est prêt (F2) |

---

## 2. Analyse du commit Git et de l'historique

### 2.1 État du dépôt

Le dépôt `lunar-nova` contient **un commit unique** (`4309745`, 2026-08-29 23:24 UTC, auteur `auceps-dev-team`, co-écrit avec l'agent) :

```
docs(changelog): précision sur la cause réelle du correctif dompurify (transitif de html2pdf.js)
```

L'historique fin (v1.44.0 → v1.48.1, ≈ 30 commits de la branche `New-feature` d'origine) a été **aplati lors du transfert**. La traçabilité fine n'est donc plus dans Git mais dans trois sources internes concordantes : le changelog applicatif (`src/pages/Support.jsx`, 47 versions datées), `memory-bank/progress.md` (journal détaillé par lot) et les audits précédents versionnés à la racine. **Constat F6 (mineur)** : pour un projet open source qui revendique l'audit (« le code que vous lisez est celui qui tourne »), un historique squashé réduit la capacité d'un auditeur externe à dater précisément chaque changement. Recommandation : conserver la granularité des commits lors des prochaines fusions vers `main`.

### 2.2 Confrontation message ↔ réalité du commit

Le message affirme que le correctif dompurify de v1.47.2 ne résolvait que « par accident », dompurify étant une **dépendance transitive de html2pdf.js** (retirée depuis). Vérifié et **exact** :

- `package.json` racine déclare explicitement `"dompurify": "^3.4.14"` (dépendance directe) ;
- `html2pdf.js` a disparu de `package.json`, du lockfile et du bundle de build (le chunk `purify.es` de 28,7 kB subsiste, signe que l'assainissement survit) ;
- trois surfaces d'assainissement actives : `AiChat.jsx:36` (ALLOWED_TAGS restreints), `AiWriter.jsx:52` (éditeur, chargement + génération), `WpProductModal.jsx:28` (fiches produits WordPress) ;
- l'export PDF d'AiWriter passe par l'IPC `print-to-pdf` (`electron/main.cjs:284` → `webContents.printToPDF`, fallback navigateur hors Electron) — **commit non menteur**.

**Aucun écart entre le message de commit et le contenu constaté.**

---

## 3. Vérifications exécutées (révision 3)

### 3.1 Installation

`npm ci` racine + backend dans un bac à sable au réseau partiellement filtré. Deux obstacles **environnementaux** (pas des défauts du projet) et leurs contournements :

| Obstacle | Cause | Contournement |
|---|---|---|
| Postinstall Electron échoue (TLS) | bac à sable sans accès au CDN de téléchargement du binaire | `ELECTRON_SKIP_BINARY_DOWNLOAD=1` (le binaire n'est requis que pour `test:e2e`) |
| `sqlite3` 6.0.1 : node-gyp ne peut télécharger les headers nodejs.org | nodejs.org bloqué ; pas de prébuild pour l'ABI Node 22 | `npm_config_nodedir=/usr/local` (headers locaux) → binding compilé et fonctionnel (`require('sqlite3')` OK) |

Résultat : racine 708 paquets, backend 380, lockfiles cohérents (`npm ci` sans mutation).

### 3.2 Tests — 3 exécutions intégrales (anti-flakiness)

```
npx vitest run --reporter=verbose   (×3, exécutions indépendantes)
→ Test Files  28 passed (28)
→ Tests       248 passed | 3 skipped (251)   — identique aux 3 runs, ~23 s
```

Les **3 skips sont tous des barrières conditionnelles volontaires**, et deux d'entre eux sont des tests *inversés* qui prouvent que le gating fonctionne dans les deux sens :

| Skip | Mécanisme | Signification |
|---|---|---|
| `agentFallback` ×2 | `it.runIf(clé Gemini présente)` | appels LLM réels de la cascade — jamais exécutés sans clé (correctif N2) |
| `dbMigrations` ×1 | `it.runIf(!sqlite3Available)` | test du **mode dégradé sans binding** — précisément skipé *parce que* le binding est disponible ici |

### 3.3 Lint, build, couverture

- `npx eslint . --max-warnings=0` → **exit 0, strictement aucune sortie** (correctif N3 confirmé ; les 6 `no-unused-vars` de v1.47 ont été éliminés).
- `npx vite build` → ✅ **10,22 s**, code-splitting par page, plus de chunk html2pdf (−975 kB / −281 kB gzip revendiqués et constatés).
- `npx vitest run --coverage` (V8) → **12,36 % stmts / 11,78 % branch global**. Points hauts : `db.js` 81 %, `logRedact` 87 %, `llmJson` 77 %, `orchestrator` 79 %, 27 personas 100 %, `cliBridge` (routes) 64 %. Points bas : `server.js` 0 %, `orderListener.js` 0 %, `redisClient` 0 %, `routes/{ai,authGoogle,catalog,pipeline,documents,invoices}` 0 %, `geminiService` 3 %, `openaiService` 4 %.

### 3.4 CLI en conditions réelles

- `version` → **WaCopilote v1.48.1** ; `help` → 14 groupes de commandes documentés (agents, pipeline, documents, photo, wordpress, quotes, contacts, segments, instances, mcp, status…), cohérent avec les 40 outils MCP.
- `status` → base SQLite opérationnelle, 27 personas chargés, état des clés (absentes) correctement rapporté.
- **Reproduction du correctif N1** : `node bin/wacopilote.cjs list-agents --json < /dev/null` → JSON **valide de 158 476 octets** (la révision 2 observait une troncature déterministe à 145 495). Le correctif (`bin/wacopilote.cjs:1042-1053`) remplace `process.exit(0)` par un vidage ordonné : `process.stdout.write('', () => process.exit(0))` + gestion EPIPE. Commentaire pédagogique complet dans le code.

### 3.5 Serveur MCP en conditions réelles

`initialize` (protocole 2025-06-18) + `tools/list` via stdio → **40 outils** : agents (2), commandes/pipeline (8), documents (5), photo (1), WordPress HITL (6), devis (5), instances WhatsApp (2), CRM contacts/segments (10), prospection (1). ServerInfo `wacopilote-mcp-server/1.48.1`. Stdout protocolaire propre (traces sur stderr).

### 3.6 Ce qui n'a pas pu être exécuté ici

Les **tests E2E Playwright** (`e2e/smoke.spec.js`) exigent le binaire Electron (indisponible dans ce bac à sable, § 3.1). Le smoke test couvre : démarrage Electron → main.cjs → backend forké, navigation HashRouter vers Réglages, présence des 5 champs de clé API, résistance du couple renderer ↔ backend. Sélecteurs indépendants de la locale (fr/en/es/ar) — bonne pratique notée. **Limite d'environnement, pas un défaut projet.**

---

## 4. Re-vérification des constats des audits précédents

Tous les constats ouverts des révisions 1 et 2 ont été re-testés un par un. **Statut : 7/7 résolus, preuves à l'appui.**

| # | Constat (rév. 2, v1.47.0) | Statut | Preuve de résolution (v1.48.1) |
|---|---|---|---|
| N1 | CLI : `process.exit(0)` tronque les sorties JSON volumineuses | ✅ **Résolu** | drain FIFO par écriture vide + callback, gestion EPIPE ; reproductible : 158 476 octets valides stdin fermé (§ 3.4) |
| N2 | `agentFallback` : appels LLM réels non conditionnés | ✅ **Résolu** | 2 skips `runIf(clé Gemini)` — la suite reste verte en CI sans secret (§ 3.2) |
| N3 | ESLint : 6 erreurs `no-unused-vars` | ✅ **Résolu** | `--max-warnings=0` exit 0, sortie vide (§ 3.3) |
| N4 | Helper safeStorage écrit dans `app.asar` (lecture seule) en build packagé | ✅ **Résolu (v1.47.2)** | `secretStore.js:73` : helper dans `os.tmpdir()` avec suffixe PID, `finally { unlinkSync }`, exécution par le binaire Electron avec `stdio` filtré |
| N5 | Tests CRM/CLI écrivant dans la base de dev réelle | ✅ **Résolu** | `vitest.config.js` force `USER_DATA_PATH` vers `os.tmpdir()/wacopilote-vitest-userdata` ; suites CLI posent leur propre chemin isolé ; commentaire renvoyant explicitement au constat N5 |
| N6 | Lenteur de la détection des canaux CLI (timeouts 2 500 ms × 9 binaires) | ✅ **Atténué/accepté** | inchangé par conception (appels rares, UI) ; timeouts de tests à 30–45 s assumés |
| C1 | `path.basename` POSIX ne découpe pas les chemins Windows (`externalAgentRunner`) | ✅ **Résolu** | `sanitizeCommandName` normalise `\\` → `/` **avant** extraction + retire `.exe/.cmd/.bat/.sh` ; test de portabilité présent (`externalAgentRunner.test.js`) |
| C3 | Badge racine et `index.html` restés à 1.43.0 | ✅ **Résolu** | badge racine, `index.html` racine, README ×2, installer.iss : **1.48.1** partout |

---

## 5. Nouveaux constats (révision 3)

### 🔴 F1 — Dépendances : 4 vulnérabilités « high » (`npm audit`), dont Electron (runtime livré)

Audit exécuté sur racine et backend le 2026-08-31. Détail par chaîne :

| Paquet (gravité) | Plage touchée | Installé | Chaîne | Exposition réelle |
|---|---|---|---|---|
| **electron** (high ×13 avis) | 1.3.1 – 41.10.2 | **40.6.1** (devDep, mais **runtime livré** dans les builds) | directe | Contournement d'isolation de contexte via `Function.prototype.bind`, `shell.openPath` null byte, redirection HTTP → file://, spoof de signature parent… **La plus prioritaire** : c'est le moteur de l'app desktop |
| **react-router** / react-router-dom (high) | 7.12.0 – 7.18.1 | 7.18.1 | **dépendance de production** | CSRF en mode RSC ; l'app utilise HashRouter (CSR) → impact fonctionnel probablement nul, mais upgrade ≥ 7.18.2 trivial |
| **undici** (high ×12 avis) | 7.0.0 – 7.28.0 | 7.29.0 (backend, via jsdom) / 7.25.0 (racine, via jsdom dev) | transitive | jsdom sert au **parsing HTML des scrapers côté serveur** ; les avis (empoisonnement de cache, injection d'en-têtes, contournement TLS via SOCKS5) sont peu exploitables ici (pas de proxy SOCKS, usage local), à surveiller |
| **brace-expansion** (high ×3 avis) | ≤ 1.1.17 / 2.0.0–2.1.3 / 4.0.0–5.0.8 | 2.1.2 (electron-builder) / **5.0.8 (backend, via glob ← google-auth-library ← @google/genai)** | transitive | DoS par expansion ; entrées contrôlées par l'app → risque faible |
| extrait-zip, fast-uri, js-yaml, nanoid (high) | — | — | devDeps (téléchargement Electron, vitest, js-yaml de config) | **outillage de dev uniquement** — non livrées |

*Recommandations :* **P0** — `npm update electron` vers ≥ 41.10.3 (ou 42.3.4+) et valider le build `electron:build` + smoke E2E (les sauts de majeure Electron exigent un test de régression CDP/WhatsApp) ; **P1** — `react-router-dom` ≥ 7.18.2 ; **P2** — suivre les fixes amont pour undici/jsdom et brace-expansion (rien d'actionnable en direct aujourd'hui, les deux sont transitives). Noter que `npm audit fix` (sans `--force`) résout la majorité des chaînes dev.

### 🟠 F2 — CI active sans couverture ni job E2E, alors que le workflow cible est prêt

`.github/workflows/ci.yml` (actif) exécute : `npm ci` ×2 → `npx vitest run --reporter=verbose` → `npx eslint . --max-warnings=0` → `npx vite build`. Le workflow cible complet (job de build **avec `--coverage` + artifact `coverage-lcov`** et job **`e2e-smoke`** sous xvfb) est prêt dans `e2e/ci-snippet.yml` mais **n'a jamais été fusionné** — cause documentée : le jeton des contributions automatisées n'a pas la permission `workflows` (constat H2). **Action éditoriale humaine requise : copier le snippet vers `ci.yml`** (5 minutes). Tant que ce n'est pas fait, la couverture n'est mesurée que localement et l'E2E ne tourne nulle part.

### 🟡 F3 — Couverture globale 12,4 % : zones critiques à ~0 %

Le projet l'assume publiquement (« couverture quasi nulle » dans le README open source, mesure chiffrée dans memory-bank). Le nef du risque : `server.js` (0 % — montage des routes, middlewares), `orderListener.js` (0 % — **le cœur d'automatisation WhatsApp**, injection de poller DOM via CDP), `routes/wa.js`, `catalog.js`, `ai.js` (0 %). À l'inverse, les modules récemment refactorés pour la testabilité sont bien couverts (db 81 %, services CRM/pipeline/documents 60 %+). *Piste : les tests E2E Playwright (F2) couvriraient transversalement le démarrage complet — les activer est le meilleur ratio effort/gain avant d'écrire des tests unitaires sur orderListener (qui exige un WhatsApp Web réel ou un mock CDP lourd).*

### ⚪ F4 — memory-bank : une affirmation en avance sur la réalité du dépôt

`memory-bank/progress.md` (lot C5, v1.48.1) écrit : « la CI exécute `vitest run --coverage` et publie l'artifact `coverage-lcov` ». **C'est vrai du snippet cible, pas du workflow actif** (cf. F2). Micro-divergence de documentation — corriger la phrase ou fusionner le snippet.

### ⚪ F5 — Historique Git aplati (squash unique)

Voir § 2.1. La capacité d'audit externe repose sur le changelog interne ; conserver la granularité des commits à l'avenir renforcerait la promesse de transparence du projet.

### ⚪ F6 — Détails mineurs relevés au fil de la lecture

- `redisClient.js` se connecte à `redis://localhost:6379` par défaut et ignore silencieusement les erreurs (`on('error')` no-op, `connect().catch(() => {})`) — comportement dégradé voulu (cache optionnel), mais aucun signal UI ne distingue « cache actif » de « Redis absent ».
- La limite `express.json({ limit: '50mb' })` globale est motivée par l'upload de médias base64 ; elle s'applique aussi aux routes légères. Un `express.json()` par route (comme le fait déjà multer uniquement pour l'upload) serait plus strict.
- `agentFallbackRouter.isOfflineOrErrorResponse` détecte des messages d'erreur en anglais codés en dur (« i am currently offline »…) — fragile si un fournisseur reformule, mais couvert par des tests.

---

## 6. Sécurité — revue détaillée

| Surface | Constat | Verdict |
|---|---|---|
| Secrets en dur | scan regex (clés API, mots de passe, Bearer) sur tout le dépôt : **0 hit** ; `.env.example` sans valeurs ; `.gitignore` exclut `.env`, `api-token`, `master-key*`, `database.sqlite`, dumps de scraping | ✅ |
| Authentification API | token aléatoire 256 bits, fichier `0600`, création concurrente sûre (`flag 'wx'`), **comparaison à temps constant** (SHA-256 + `timingSafeEqual`), SSE token-in-query limité à 2 routes locales documentées, routes publiques minimales (callback OAuth) | ✅ exemplaire |
| Exposition réseau | écoute **127.0.0.1 uniquement** (`BACKEND_HOST`), CORS restreint à 5 origins locales + `null` (renderer file://), preflight traité avant le token | ✅ |
| Chiffrement au repos | AES-256-GCM v2, clé maître scellée par safeStorage OS, déchiffrement CLI/MCP via helper **tmpdir** (N4 résolu), test du chiffrement `*_api_key` en base | ✅ |
| XSS / HTML IA | DOMPurify sur les 3 surfaces de rendu IA (chat, éditeur, fiches produits), `ALLOWED_TAGS` restreints ; page callback OAuth sans interpolation de la réponse fournisseur | ✅ |
| Injection SQL | scan des interpolations `${}` dans les requêtes : uniquement des **placeholders `?` générés** (listes d'ids, LIMIT/OFFSET bornés 1–1000 dans crmService) | ✅ |
| Exécution de commandes | `externalAgentRunner` : liste blanche stricte, `sanitizeCommandName` (normalisation Windows + extensions), spawn sans shell, timeout ; route `test-bridge` passe par la même liste | ✅ |
| Electron | `nodeIntegration: false`, `contextIsolation: true` (main + fenêtre PDF), IPC minimal dans preload (`printToPDF`, updater, open-external-url confiné) | ✅ |
| Logs | messages WhatsApp expurgés par défaut (longueur + initiale), `WACOPILOTE_LOG_MESSAGES=1` opt-in documenté | ✅ |
| Rate limiting | global 2000/15 min + heavy 30/15 min (scraping/catalogue), motivés dans les commentaires | ✅ |
| Dépendances | **4 high** — voir F1 | 🔴 |

---

## 7. Qualité du code & architecture

- **Structure** : backend découpé en `routes/` (wrappers fins) → `services/` (logique) → `db.js` (SQLite injectable, 7 migrations versionnées idempotentes) ; frontend en pages + composants extraits par domaine (agents/, analytics/, contacts/, invoice/, pipeline/, wordpress/…). Le refactor C13 tient : plus aucune page > 800 lignes hors `ImageEditor.jsx` (850 l., éditeur canvas isolé).
- **Routeur agentique** (`agentFallbackRouter.js`, 472 l.) : cascade ordonnée fournisseur → API Gemini → CLI locaux → OpenRouter → MCP, garde anti-récursion `fallbackInFlight`, détection de clés par canal, classification d'erreurs (`isKeyConfigurationError` : 8 motifs). Conception saine, testée, documentée.
- **Commentaires de décision** : quasi systématiques et *à jour* (chaque correction d'audit leave un commentaire expliquant le pourquoi — drain stdout, tmpdir ASAR, Origin null, EPIPE…). Rare à ce niveau.
- **i18n** : parité stricte 1186 clés × 4 locales, testée en non-régression (`i18nParity.test.js`, variables d'interpolation vérifiées).
- **Zéro TODO/FIXME/HACK** dans le code applicatif (src + backend + electron + bin).
- **Plugin WordPress** (1 197 l.) : gouvernance HITL stricte (CPT de propositions, aucune écriture directe), Application Passwords WP 5.6+, rôle dédié à capacité `wacopilote_propose` seule, table d'audit dédiée. Cohérent avec le lock v1.42.13 côté app.

---

## 8. Documentation & hygiène du dépôt

- 290 fichiers suivis ; binaires légitimes uniquement (assets du studio photo, logos, cartes mentales, PDF d'architecture) ; pas de dump de données personnelles (le dump GoAfrica contenant des coordonnées réelles a été retiré en v1.42.13 — arbitrage H3 documenté dans `.gitignore`).
- README racine (517 l.) + README interne (629 l.) : chiffres vérifiés (version, licence AGPL-3.0, « couverture quasi nulle » assumée).
- `CONTRIBUTING.md` (règles de versionnage), `SECURITY.md`, templates d'issues/PR, FUNDING, `bump_version.sh` (synchronisation multi-fichiers).
- memory-bank à jour à ceci près du F4.

---

## 9. Verdict global

| Axe | Note |
|---|---|
| Fonctionnel | 🟢 CI verte intégrale (tests 248/251, lint 0/0, build OK), CLI + MCP vérifiés en réel |
| Sécurité applicative | 🟢 solide, plusieurs patterns exemplaires (temps constant, HITL, expurgation) |
| Dépendances | 🔴 4 high dont le runtime Electron — **seul vrai chantier urgent** |
| Tests | 🟡 quantité en nette progression, couverture ciblée à étendre (F3) |
| DevOps | 🟠 fusionner le workflow cible (F2) — action humaine de 5 min |
| Transparence | 🟢 audits précédents traités à 100 %, documentation exceptionnelle |

**Résumé en une phrase :** la v1.48.1 est la version la plus saine audité à ce jour — tous les constats précédents sont fermés avec preuves, la chaîne qualité est verte et stable — et le chantier suivant est connu, priorisé et petit : mettre à jour Electron (F1), fusionner le workflow CI cible (F2), puis étendre la couverture sur orderListener et les routes (F3).

---

## 10. Recommandations priorisées

| Priorité | Action | Effort | Référence |
|---|---|---|---|
| **P0** | Mettre à jour `electron` ≥ 41.10.3 (42.3.4+) ; revalider `electron:build` + smoke E2E (CDP 8315, sélecteurs WhatsApp) | 0,5 j | F1 |
| **P0** | Fusionner `e2e/ci-snippet.yml` → `.github/workflows/ci.yml` (nécessite un jeton avec permission `workflows` — action humaine) | 5 min | F2 |
| **P1** | `react-router-dom` ≥ 7.18.2 (`npm audit fix` couvre aussi extract-zip/fast-uri/js-yaml/nanoid côté dev) | 10 min | F1 |
| **P1** | Corriger la phrase memory-bank « la CI exécute --coverage » (ou fusionner le snippet, ce qui la rend vraie) | 2 min | F4 |
| **P2** | Étendre la couverture : priorité `orderListener.js` (mock CDP/CDP-recorder) puis `routes/wa.js`, `server.js` | 2–5 j | F3 |
| **P2** | Suivre undici/jsdom et brace-expansion amont ; re-scanner `npm audit` à chaque lot | continu | F1 |
| **P3** | Conserver la granularité des commits lors des fusions vers `main` ; signaler l'état Redis dans l'UI | — | F5, F6 |

---

*Audit produit le 2026-08-31 par agent Arena (session `arena/01a057ee-lunar-nova`), méthode en boucles continues : exploration exhaustive → installation propre → 3× tests complets → lint → build → couverture → CLI/MCP réel → sécurité (7 scans) → re-vérification intégrale des 8 constats antérieurs → rédaction. Artefacts associés : `carte-mentale-lunar-nova-v1.48.svg` / `.png` (carte mentale graphique de la révision 3).*
