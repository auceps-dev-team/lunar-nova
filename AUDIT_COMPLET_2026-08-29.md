# 🔍 Audit complet — WaCopilote (`lunar-nova`) — v1.47.0

> **Révision 2** — mise à jour du précédent audit (v1.45.0, commit `609bd08`, plus bas dans l'historique de ce fichier)
> **Date :** 2026-08-29 · **Version auditée :** 1.47.0 · commit `5252dcc` · branche `New-feature`, fusionnée dans `arena/01a04f40-lunar-nova`
> **Périmètre :** ~300 fichiers suivis · ≈ 34 400 lignes applicatives (JS/JSX/CJS, backend passé de 12 713 à 13 875 l.) · 2 453 l. de tests · CLI porté de 873 à 1 050 l. · serveur MCP porté de ~780 à 998 l.
> **Méthode :** mêmes boucles itératives que la révision 1 (fetch → analyse des 7 nouveaux commits → diff fichier par fichier → réinstallation → suite complète → lint → build → lecture intégrale des nouveaux modules → CLI/MCP en conditions réelles → re-vérification de chaque constat précédent), plus un travail de **diagnostic causal** sur chaque nouvel échec de test (reproductibilité isolée, réplique hors Vitest, instrumentation).

---

## 1. Synthèse exécutive de la mise à jour

Entre la révision 1 et la présente révision, la branche `New-feature` a progressé de **7 commits couvrant v1.45.1 → v1.47.0** (+2 627 / −398 lignes) :

| Commit | Version | Contenu vérifié |
|---|---|---|
| `a00d18f` | v1.45.1 | Résolution base applicative `userData`, déchiffrement safeStorage, assainissement stdio |
| `cb1e184` | v1.46.0 | **CRM** : `crmService.js` (259 l.), raccordement pipeline segments, réaffectation doublons, 10 outils MCP/CLI |
| `766e909` | v1.46.1 | Découplage console du bridge de test, endpoint autonome `POST /api/cli/test-bridge`, détection `gcloud`/`google-genai` |
| `6f520c4` | — | Ajustement des timeouts de détection système CLI (800 ms → 2 500 ms, chemins de secours Windows) |
| `64e3117` | v1.47.0 | **Routage agentique** : `agentFallbackRouter.js` (372 l.) — stratégies API/CLI/MCP, auto-fallback résilient |
| `2ee2e8a` | — | Suppression du bruit console (SecretStore, traces Gemini → stderr) |
| `5252dcc` | docs | Changelog `Support.jsx` v1.47.0, README interne, memory-bank, PROJECT_MENTAL_MAP |

**Malheureusement, l'état CI s'est dégradé : 4 tests échouent (contre 1) et ESLint comporte 6 erreurs (contre 0).** Le pipeline GitHub Actions serait rouge sur les trois étapes possibles. À cela s'ajoute un **défaut fonctionnel réel découvert par diagnostic** : le CLI v1.47 peut **tronquer ses sorties JSON volumineuses** (`process.exit(0)` avant vidage du tampon stdout) — le symptôme visible en test n'est que la pointe de l'iceberg, ce sont les scripts et IDE agentiques qui en pâtiront en production.

| Vérification | Révision 1 (v1.45.0) | **Révision 2 (v1.47.0)** |
|---|---|---|
| Tests unitaires | 221 tests : 219 ✔, 1 ✘, 1 skip | **247 tests : 242 ✔, 4 ✘, 1 skip** |
| ESLint `--max-warnings=0` | ✅ 0 erreur | ❌ **6 erreurs (variables inutilisées)** |
| Build Vite | ✅ 15,9 s | ✅ 17,1 s |
| CLI | ✅ v1.45.0, 27 personas | ✅ v1.47.0, 27 personas + CRM fonctionnel |
| Serveur MCP | ✅ ~30 outils | ✅ **40 outils** (10 CRM) |
| Secrets en dur / hygiène dépôt | ✅ rien | ✅ rien |

| Domaine | Verdict |
|---|---|
| Architecture & conception | ✅ Très bon (le routage à cascade est une vraie valeur ajoutée) |
| Sécurité & secrets | ✅ Très bon (1 réserve ASAR sur le déchiffrement safeStorage — N4) |
| Qualité du code | ⚠️ **ESLint rouge (6 erreurs triviales)** |
| Tests | ⚠️ **4 échecs : 1 portabilité (C1), 2 tests « réels » non conditionnés (N2), 1 troncature stdout (N1)** |
| Documentation interne | ✅ À jour (README, Support.jsx, memory-bank, mental map) |
| Documentation racine | ⚠️ C3 **étendue** : badge racine ET `index.html` restés à 1.43.0 |
| CI / DevOps | 🔴 **Rouge sur les trois étapes (tests, lint)** |

---

## 2. Analyse des nouveaux commits

Les 7 messages de commit ont été confrontés au contenu réel des diffs — **tous exacts** (pas de « commit menteur ») :

* **v1.46.0 (CRM)** : `crmService.js` — SQL entièrement paramétré, `LIMIT/OFFSET` bornés (1–1000), création de segment idempotente par nom, suppression avec dissociation des contacts, `assignContactsToSegment` atomique. Les commandes CLI `contacts`/`segments` et 10 tools MCP (`list_segments`, `create_segment`, `delete_segment`, `list_contacts`, `get_contact`, `create_contact`, `update_contact`, `delete_contact`, `assign_contacts_to_segment`, + `save_pipeline_contacts` relié) sont câblés et fonctionnels (testés). Note de syntaxe : la commande est `wacopilote segments …` (premier niveau), pas `crm segments` — le `help` est à jour.
* **v1.47.0 (routage agentique)** : `agentFallbackRouter.js` implémente une cascade ordonnée (fournisseur configuré → Gemini API → Gemini CLI → Claude CLI → OpenRouter) pilotée par `ai_execution_strategy` et `auto_fallback_enabled`, avec détection de clés par canal, `isKeyConfigurationError` (8 motifs) et `isOfflineOrErrorResponse`. `aiController.chatWithAgent` délègue désormais à ce routeur ; `generateProposals`/`classifyOrderIntent` gagnent une garde « clé absente » + repli Gemini. Conception saine ; le canal CLI réutilise la liste blanche existante (pas de contournement).
* **v1.46.1 (test-bridge)** : `POST /api/cli/test-bridge` (3 modes : cli / mcp / external). Le mode `external` passe par `sanitizeCommandName` + `executeExternalCli` → **liste blanche respectée**, pas d'escalade.
* **v1.45.1 (userData + safeStorage)** : `resolveUserDataDir()` unifié (USER_DATA_PATH → appData/WaCopilote si base existante → dossier projet), partage DB entre process. Voir N4 pour la réserve sur le helper safeStorage.
* **Hygiène stdio** : les derniers `console.log` parasites (db.js, SecretStore, stack traces Gemini) basculés sur stderr — vérifié : `list-agents --json` et `mcp` produisent un stdout protocolaire propre.

---

## 3. Vérifications exécutées (révision 2)

* **Réinstallation** : `npm ci` racine + backend OK (lockfiles cohérents avec les renommages `wacopilote-backend` 1.47.0) ; binding `sqlite3` recompilé (contournement bac à sable, sans effet sur un poste standard).
* **Suite complète** : `npx vitest run` → **27 fichiers, 247 tests : 242 ✔, 4 ✘, 1 skip conditionnel**. Deux nouvelles suites (`agentFallback.test.js` 6 tests, `crmService.test.js` 6 tests) et enrichissements (cliBridgeRoutes, cliInbound, cliMcpFlow, mcpServer, pipelineService, externalAgentRunner).
* **ESLint** : ❌ **6 erreurs** `no-unused-vars` — `agentFallback.test.js:1` (`vi`), `secretStore.js:97` (`e`), `agentFallbackRouter.js:74` (`ollamaKey`), `crmService.js:2` (`contactAgent`), `CliAgentBridgeSettings.jsx:13` (`isLoading`), `Settings.jsx:41` (`channelsStatus`). Toutes triviales (< 10 min) mais **bloquantes pour la CI**.
* **Build Vite** : ✅ 17,1 s.
* **CLI réel** : `version` (1.47.0), `list-agents --json` (27 personas), `segments list --json` (13 segments retournés), `help` à jour (contacts/segments CRM documentés).
* **Serveur MCP réel** : `initialize` + `tools/list` → **40 outils** conformes.
* **Re-vérification des constats de la révision 1** : voir § 5.

### 3.1 Diagnostic causal des 4 échecs de tests (travail d'investigation)

| # | Test en échec | Cause racine démontrée | Verdict |
|---|---|---|---|
| 1 | `cliInbound > list-agents --json` — `Unterminated string in JSON at position 145495` | **N1 — troncature stdout.** Réplique hors Vitest : avec `stdin.end()` immédiat, la sortie s'arrête *exactement* à 145 495 octets (coupe en plein milieu d'une description « …### Viral Con ») au lieu de 158 476. Cause : `main().then(() => process.exit(0))` dans `bin/wacopilote.cjs:1046` coupe le processus avant que Node n'ait vidé le tampon du pipe pour cette écriture volumineuse. Le déclenchement dépend du timing (passe à la main, échoue sous Vitest, échouera aussi chez des consommateurs de pipes). | **Défaut produit réel** |
| 2 | `agentFallback > secourt un appel OpenAI/NVIDIA sans clé via Gemini` | **N2 — test d'intégration non conditionné.** La cascade OpenAI→Gemini exige une clé Gemini (DB ou `GEMINI_API_KEY`) ou un CLI Gemini installé. Sans aucune clé (CI), la dernière tentative échoue et l'erreur est propagée. | Test dépendant de l'environnement |
| 3 | `agentFallback > appel direct standard Gemini` | Idem : **appel Gemini réel** (`getGeminiClient` → « API key not valid »). Aucun mock. | Test dépendant de l'environnement |
| 4 | `externalAgentRunner > sanitizeCommandName > chemin fourni` | **C1 inchangé** — `path.basename` POSIX ne découpe pas `C:\Program Files\...`. | Régression toujours ouverte |

> La suite contient pourtant déjà le bon patron pour N2 : `dbMigrations.test.js` conditionne ses tests à la disponibilité du binding (`it.runIf(sqlite3Available)`). Il suffit d'appliquer le même gating sur la présence d'une clé Gemini.

---

## 4. Nouveaux constats (révision 2)

### 🔴 N1 — CLI : `process.exit(0)` tronque les sorties JSON volumineuses

* **Fichier :** `bin/wacopilote.cjs:1046-1050` (`main().then(() => { if (process.argv[2] !== 'mcp') process.exit(0); })`) combiné aux gros `console.log(JSON.stringify(..., null, 2))` (ex. `list-agents` : 158 Ko).
* **Preuve :** reproduction déterministe hors Vitest — `stdin` fermé immédiatement ⇒ sortie coupée à 145 495/158 476 octets, JSON invalide, code de sortie pourtant 0.
* **Impact :** tout consommateur programmatique du CLI (scripts Unix, `spawn` sans attendre, IDE agentiques via le bridge) peut recevoir un JSON invalide. Le test `cliInbound` en est la victime visible ; la CI et les utilisateurs MCP en subiront les effets de façon intermittente.
* **Recommandation :** remplacer `process.exit(0)` par `process.exitCode = 0` (sortie naturelle après vidage des flux), ou attendre le drain : `process.stdout.write(s, () => process.exit(0))`. Effort : 2 lignes. **À traiter en P0 avec C1/N2/N3.**

### 🔴 N2 — Tests `agentFallback` : appels LLM réels non conditionnés

* **Fichier :** `backend/__tests__/agentFallback.test.js:68-93` — les deux tests de la cascade appellent les vraies API (aucun mock, aucun gating sur la présence de clés).
* **Impact :** échec garanti en CI (aucun secret configuré) et chez tout contributeur sans clé. C'est le seul fichier de la suite qui casse ce principe (les 25 autres suites sont hermétiques).
* **Recommandation :** soit `it.runIf(await hasGeminiKey())` sur le modèle `dbMigrations`, soit moquer `geminiService.chatWithAgent`. Effort : ~10 lignes.

### 🟠 N3 — ESLint : 6 erreurs `no-unused-vars` (imports/mort-code v1.46–v1.47)

* `agentFallback.test.js:1` (`vi`), `secretStore.js:97` (`e`), `agentFallbackRouter.js:74` (`ollamaKey`), `crmService.js:2` (`contactAgent`), `CliAgentBridgeSettings.jsx:13` (`isLoading`), `Settings.jsx:41` (`channelsStatus`).
* **Impact :** l'étape « 🔍 ESLint (zero warnings) » de la CI échoue.
* **Recommandation :** supprimer les 6 identifiants morts (règle du projet : zéro warning). Effort : 5 min.

### 🟠 N4 — `secretStore` : le déchiffrement safeStorage par sous-processus Electron écrira dans ASAR en build packagé

* **Fichier :** `backend/secretStore.js:63-99` — en cas de `master-key.enc`, le backend écrit un helper `.temp_electron_key.cjs` dans `__dirname` (le dossier du backend) puis lance le binaire Electron pour déchiffrer.
* **Risque :** en production, `backend/**` est empaqueté dans `app.asar` (lecture seule, `asarUnpack` non configuré) → `writeFileSync` échoue → repli gracieux, mais le canal de déchiffrement CLI/MCP sera inopérant : les clés chiffrées via safeStorage apparaîtront vides dans le CLI/MCP packagé (comportement dégradé silencieux, par conception du `decrypt`).
* **Recommandation :** écrire le helper dans `os.tmpdir()` (et Documenter le flux), ou faire passer la clé déchiffrée par le process principal via `UPDATE_ENV` au lancement du CLI. Effort : faible. À valider sur un vrai build `electron:build`.

### 🟡 N5 — Les tests CRM/CLI écrivent dans la base de développement réelle

* **Fichiers :** `crmService.test.js` (`db.initDB()` sans `__setDbFileForTests(':memory:')`), `cliInbound.test.js` et `cliMcpFlow.test.js` (spawn du CLI qui résout la même base). Sous Vitest (`NODE_ENV=test`), `resolveUserDataDir()` pointe le dossier projet → `whatsapp-ai-saas/database.sqlite` accumule les données de test (constaté : 13 segments créés par nos exécutions).
* **Impact :** pollution de la base de dev locale (gitignorée, donc pas de fuite Git), risques de faux positifs/négatifs entre runs, croisement avec les vraies données d'un développeur.
* **Recommandation :** dans ces suites, rediriger la base vers un fichier temporaire (`__setDbFileForTests(path.join(os.tmpdir(), ...))` ou `:memory:` quand le spawn ne l'exclut pas). Effort : faible.

### ⚪ N6 — Lenteur de la détection des canaux CLI

* `getExecutionChannelsStatus()` → `detectInstalledClis()` sonde 9+ binaires avec un timeout passé de 800 ms à 2 500 ms chacun (v1.46.1), séquentiellement en cas d'échec `which`. Le pire cas approche 20 s — d'où les timeouts de test portés à 30–45 s. Acceptable côté UI (appel rare), à surveiller si la route `/channels-status` est sondée fréquemment par le renderer.

---

## 5. Ré-capitulatif des constats de la révision 1 (v1.45.0)

| # | Constat v1.45 | Statut en v1.47.0 | Détail |
|---|---|---|---|
| C1 | `sanitizeCommandName` : chemins Windows non parsés sous Linux → test rouge | ❌ **Non corrigé** — toujours en échec | Le diff v1.46.1 touche les timeouts et la détection Windows, pas le parsing du nom |
| C2 | `AiWriter.jsx` : `innerHTML` sans DOMPurify (sortie IA) | ❌ **Non corrigé** — fichier non touché par les 7 commits | Recommandation inchangée (~10 l.) |
| C3 | README racine : badge 1.43.0 + « 43 tests » | ❌ **Non corrigé et étendu** : `index.html:216` badge « Version 1.43.0 » également | README interne, installer.iss, Support.jsx : OK à 1.47.0 |
| C4 | Callback OAuth : HTML interpolé non échappé | ❌ **Non corrigé** — `routes/authGoogle.js` non touché | Recommandation inchangée (3 l.) |
| C5 | Dette technique (pages > 700 l., couverture non mesurée, html2pdf 976 kB, E2E non branché) | ➖ Inchangée | `vitest.config.js` retouché (exclusions) sans couverture |

**Bilan de la boucle d'amélioration :** les 7 commits corrigent des points internes solides mais aucun des 5 constats de la révision 1 n'a été traité, et la santé CI s'est dégradée (1 → 4 tests en échec, 0 → 6 erreurs de lint). La valeur fonctionnelle livrée (CRM, routage agentique, MCP élargi) est réelle et bien conçue — c'est la « route vers le vert » qui doit maintenant passer en priorité.

---

## 6. Points forts nouveaux ou confirmés (vérifiés)

1. **Cascade de fallback bien pensée** : stratégie configurable (`auto`/`api`/`cli`/`mcp`), ordre de repli cohérent, détection d'erreurs de clé sur 8 motifs, garde anti-boucle (`autoFallback` coupable d'arrêt), logs de bascule sur stderr.
2. **CRM propre** : SQL paramétré partout, bornes sur LIMIT/OFFSET, idempotence des segments, dissociation propre à la suppression, réaffectation des doublons téléphone dans le pipeline.
3. **10 nouveaux outils MCP** alignés 1:1 avec le service (testés : `tools/list` → 40 outils, `segments list` CLI OK).
4. **Hygiène stdio achevée** : les derniers logs parasites passés sur stderr (db.js, SecretStore, Gemini) — le flux JSON CLI/MCP est propre.
5. **Endpoint `test-bridge`** sécurisé par la même liste blanche que le run externe (pas de contournement).
6. **Lockfiles et versions internes alignés** (package racine/backend 1.47.0, installer.iss 1.47.0).
7. **Tous les constats « sécurité » de la révision 1 restent valables en positif** : token à temps constant, AES-256-GCM, CORS, rate-limiting, HITL WordPress, logs expurgés, masquage des secrets.

---

## 7. Plan d'action consolidé (révision 2)

| Priorité | Action | Constat | Effort |
|---|---|---|---|
| **P0** | Corriger la troncature stdout du CLI (`process.exitCode` ou callback de drain) | N1 | 2 l. |
| **P0** | Normaliser `\` → `/` dans `sanitizeCommandName` | C1 | 1 l. |
| **P0** | Gater/moquer les 2 tests `agentFallback` dépendants de clés | N2 | ~10 l. |
| **P0** | Supprimer les 6 variables/imports inutilisés | N3 | 5 min |
| **P1** | DOMPurify sur les 3 injections HTML d'AiWriter (+ revoir l'exposition de `getApiToken`) | C2 | ~10 l. |
| **P1** | README racine + `index.html` : badge/versions/compte de tests à jour (221→247 etc.) | C3 | 10 min |
| **P1** | Échapper/génériser l'erreur HTML du callback OAuth | C4 | 3 l. |
| **P1** | Helper safeStorage dans `os.tmpdir()` + test sur build packagé | N4 | faible |
| **P2** | Isoler la DB de tests (tmpdir/`:memory:`) dans crmService/cliInbound/cliMcpFlow | N5 | faible |
| **P2** | `vitest --coverage` en CI sans seuil ; brancher le smoke E2E (`e2e/ci-snippet.yml`) ; remplacer html2pdf par l'IPC `printToPDF` | C5 | moyen |

**État attendu après P0 : 247/247 tests verts (hors skip), ESLint 0 erreur, CI entièrement verte.**

---

## 8. Verdict final de la révision 2

La livraison v1.45.1 → v1.47.0 apporte **deux briques fonctionnelles majeures réellement bien conçues** (CRM unifié, routage agentique à cascade) et poursuit l'hygiène technique (stdio, chemins applicatifs). Mais la **dette de vérification s'accumule** : aucun des 5 constats de la révision 1 n'a été traité, trois nouveaux défauts bloquants pour la CI sont introduits (dont un défaut produit réel de troncature stdout) et six erreurs de lint subsistent. **La priorité n'est pas d'ajouter des fonctionnalités mais de passer une itération entièrement dédiée à la remise au vert (plan P0, effort total estimé < une demi-journée).**

## 9. Annexe — Conformité du plan d'implémentation v1.47.0 (vérification plan ↔ code)

> À la demande de l'auteur, le plan d'implémentation (« Système de Routage Agentique Intelligent & Auto-Fallback Multi-Canal ») a été confronté **engagement par engagement** au code réellement livré. Chaque verdict s'appuie sur une preuve de fichier/ligne ou une exécution.

### 9.1 Matrice de conformité

| # | Engagement du plan | Réalité mesurée | Verdict |
|---|---|---|---|
| 1 | `agentFallbackRouter.js` : analyse temps réel des canaux **API** (Gemini DB/env, OpenRouter DB, NVIDIA/OpenAI DB/env, Ollama) | `getExecutionChannelsStatus()` — détection clé par clé, garde anti-placeholder | ✅ Conforme |
| 2 | Analyse des canaux **CLI** (`gemini`, `claude`, `ollama`, `node`, `python`) | Via `detectInstalledClis()` + chemins de secours Windows (v1.46.1) | ✅ Conforme |
| 3 | Analyse du canal **MCP** | **Aucun flag MCP** dans l'objet `channels` ; seule mention = commentaire (ligne 58) | ❌ **Absent** |
| 4 | Stratégie **`MCP`** exécutable (« Priorité au protocole MCP stdio ») | Pas de branche `provider === 'mcp'` dans `invokeSingleProvider` ; `executeAgentWithFallback` ne traite que `strategy === 'cli'` → **sélectionner MCP dans l'UI exécute silencieusement le fournisseur API par défaut (Gemini)** | ❌ **Absent + piège UX** (→ **N7**) |
| 5 | Cascade « intelligente » `executeWithSmartFallback` | Cascade réelle et bien conçue, mais nommée `executeAgentWithFallback` | ⚠️ Conforme (nom différent) |
| 6 | `aiController` : raccord de `chatWithAgent`, `generateProposals`, `classifyOrderIntent` **au routeur** | Seul `chatWithAgent` passe par le routeur (ligne 154) ; `generateProposals` et `classifyOrderIntent` ont un simple try/catch avec repli Gemini **inline** (pas de cascade CLI, pas d'évaluation de canaux) | ⚠️ Partiel (1/3) |
| 7 | Réglages `ai_execution_strategy` / `default_cli_agent` / `auto_fallback_enabled` | Lis/écrits via le KV générique, valeurs par défaut côté UI, consommés par le routeur | ✅ Conforme |
| 8 | Routes settings : endpoint de statut des canaux | `GET /api/settings/channels-status` présent et testé (fichier réel `settings_and_agents.js`, le plan disait `settings.js`) | ✅ Conforme |
| 9 | `Settings.jsx` : sélecteur Auto / API / CLI / MCP | 4 options conformes au plan + sélecteur CLI par défaut conditionnel | ✅ Conforme |
| 10 | `Settings.jsx` : « **Badges visuels en temps réel** indiquant les canaux prêts à l'emploi » | **Badges codés en dur** (toujours 🟢 Gemini API, 🟢 Gemini CLI v0.57.0, 🟢 Claude v2.1.250, ⚡ MCP) : `channelsStatus` est bien récupéré (`setChannelsStatus`, ligne 84) mais **jamais rendu** (variable inutilisée → erreur ESLint N3). Les badges affichent « disponible » même sans aucune clé ni binaire | ❌ **Trompeur** (→ **N8**) |
| 11 | `CliAgentBridgeSettings.jsx` : « Affichage de la stratégie globale sélectionnée et synchronisation directe » | **Aucune référence** à `ai_execution_strategy` dans ce composant (seul un `isLoading` inutilisé, ligne 13) | ❌ **Absent** |
| 12 | Tests : T1 NVIDIA sans clé → repli Gemini sans erreur | Présent — mais sans mock : exige une vraie clé Gemini → **échoue en CI** (cf. N2) | ⚠️ Partiel |
| 13 | Tests : T2 mode CLI + `gemini` → exécution via binaire local | **Absent** (aucun test de la stratégie CLI) | ❌ **Absent** |
| 14 | Tests : T3 mode CLI + binaire inexistant → repli API | **Absent** | ❌ **Absent** |
| 15 | Tests : T4 respect de la stratégie imposée | **Absent** (la stratégie est lue, jamais testée comportementalement) | ❌ **Absent** |
| 16 | Validation : « `npx vitest run` 100 % au vert » | **4 échecs mesurés** (N1, N2 ×2, C1) — critère non tenu | ❌ Non atteint |
| 17 | Versionnage v1.47.0 propagé (packages, installer.iss, Support.jsx, README, memory-bank) | Tout à 1.47.0 **sauf** README racine et `index.html` (badge 1.43.0, cf. C3) | ⚠️ Presque complet |

**Bilan de conformité : 6 ✅ · 3 ⚠️ · 7 ❌ — soit ≈ 60 % des engagements du plan réellement livrés.** Le cœur de valeur (cascade de repli API↔CLI, détection de canaux, réglages, sélecteur UI) est bien là ; ce sont les périphéries promises (MCP, badges dynamiques, 3 tests sur 4, synchronisation du composant bridge) qui manquent.

### 9.2 Nouveaux constats dérivés de cette vérification

#### 🔴 N7 — Le sélecteur « ⚡ Protocole MCP stdio » est un no-op silencieux
* **Preuve :** `Settings.jsx:283` propose l'option `mcp` ; `agentFallbackRouter.js` ne contient aucun traitement de cette valeur (ni canal, ni branche d'invocation). Si un utilisateur choisit MCP, l'exécution part silencieusement sur le fournisseur API par défaut.
* **Impact :** promesse UI non tenue + diagnostic utilisateur impossible (aucun message, aucun log indiquant la déviation). Le changelog `Support.jsx` (« sélection libre … ou Protocole MCP ») est donc **partiellement inexact**.
* **Recommandation :** soit implémenter le canal MCP (in-process `handleToolCall('call_agent', …)` du serveur stdio est déjà disponible), soit retirer l'option du sélecteur jusqu'à livraison, et afficher un avertissement si la valeur existe en base.

#### 🟠 N8 — Badges de canaux « temps réel » en réalité statiques (et changelog inexact)
* **Preuve :** badges en dur dans `Settings.jsx` (~lignes 303-322) ; `channelsStatus` jamais lu ; `Support.jsx` v1.47.0 annonce « affichage interactif des badges de statut en direct ».
* **Impact :** l'utilisateur voit « 🟢 Gemini API Cloud » même sans clé configurée — fausse confiance, à rebours de l'objectif du routeur. Exception notable : le badge « ⚡ Auto-Fallback Actif » est également inconditionnel, y compris quand `auto_fallback_enabled=false`.
* **Recommandation :** brancher les badges sur `channelsStatus.channels` (états vert/gris + version réelle remontée par `detectInstalledClis`, plutôt que les versions figées v0.57.0/v2.1.250 codées en dur dans les libellés). Effort : ~20 lignes, la donnée est déjà chargée.

#### 🟠 N9 — 3 des 4 tests promis par le plan sont absents
* **Preuve :** `agentFallback.test.js` = 6 tests, aucun ne couvre la stratégie CLI (T2), le repli binaire inexistant (T3) ni le respect de la stratégie imposée (T4).
* **Impact :** les chemins de code les plus neufs du routeur (sélection de stratégie, invocation CLI, cascade inversée) sont **non régressés** ; c'est précisément ce qui aurait détecté N7.
* **Recommandation :** compléter T2–T4 avec des mocks (`vi.mock` de `executeExternalCli`/`geminiService` — l'import `vi` déjà présent mais inutilisé dans le fichier montre que c'était l'intention initiale). Effort : ~60 lignes.

### 9.3 Synthèse de l'annexe

Le plan a été **globalement suivi dans sa colonne vertébrale** (routeur, réglages, endpoint, sélecteur, versionnage) mais **sous-livré sur ses périphéries** : le canal MCP promis n'existe pas (et son option UI est activable en produisant un comportement non documenté), les badges « temps réel » sont des éléments statiques trompeurs, la synchronisation de `CliAgentBridgeSettings.jsx` est absente, et 3 des 4 tests d'assurance annoncés n'ont pas été écrits — ce qui explique que la validation finale « 100 % au vert » du plan n'ait pas pu être atteinte (4 échecs mesurés, cf. § 3.1). Les points N7–N9 s'ajoutent au plan d'action : **implémenter ou retirer MCP (N7) et brancher les badges (N8) sont les deux actions à plus forte valeur perçue utilisateur ; N9 sécurise l'ensemble.**

---

---

# 📎 Archive — Révision 1 (v1.45.0, commit `609bd08`)

> Conservée pour traçabilité. Les constats C1–C5 et leur détail complet s'appliquaient au 2026-08-29 matin ; leur statut de traitement en v1.47.0 est repris au § 5 ci-dessus. Résultats d'alors : 221 tests (219 ✔, 1 ✘ C1, 1 skip), ESLint 0 erreur, build OK 15,9 s, CLI/MCP vérifiés (~30 outils), 280 fichiers analysés.

*Audit révision 2 généré le 2026-08-29 · carte mentale mise à jour : `carte-mentale-wacopilote-v1.47.png` (et `.svg`) · archive carte révision 1 : `carte-mentale-wacopilote-v1.45.png`.*
