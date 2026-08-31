# 🛠️ Diagnostic & Plan de correctifs — 2 bugs signalés — WaCopilote v1.48.1

> **Date :** 2026-08-31 · **Révision :** v2 — **plan consolidé** intégrant le diagnostic croisé (apport « Workspace Trust » Gemini CLI, vérifié contre la documentation officielle) et deux raffinements de sécurité/compatibilité sur C3
> **Demande :** recherche de cause exacte + plan de correctifs **sans toucher au code**
> **Méthode :** lecture exhaustive de la chaîne d'exécution (`agentFallbackRouter.js` → `externalAgentRunner.js` → `secretStore.js` → `db.js` → `electron/main.cjs`), confrontation avec vos logs de `npm run start:all`, vérification croisée avec la documentation Gemini CLI.
> ⚠️ Les deux captures d'écran n'ont pas pu être exploitées (non sauvegardées dans l'espace de travail) — le diagnostic s'appuie sur vos logs, qui suffisent à verrouiller la chaîne de cause à effet.

---

## 🐛 BUG A — « Gemini CLI injojnable alors qu'il est présent »

### Symptôme (vos logs)

```
[0] [SecretStore] Déchiffrement impossible (clé maître absente ou modifiée) : Unsupported state or unable to authenticate data
[0] [SmartFallback] Échec sur fournisseur configuré (openai) : OpenAI/NVIDIA API key not configured in settings.
[0] [SmartFallback] Échec sur auto-fallback Google Gemini CLI local (cli) : Échec d'exécution du CLI 'gemini'
[0] [SmartFallback] ✅ Agent 'copywriter' secouru avec succès via auto-fallback Claude Code CLI local (cli)
```

### Cause exacte : trois couches empilées

#### Couche 1 — Racine : la clé maître de chiffrement a changé (prouvé par la 1ʳᵉ ligne de log)

`Unsupported state or unable to authenticate data` est l'échec d'authentification AES-256-GCM : la clé maître résolue **aujourd'hui** n'est pas celle qui a chiffré les secrets stockés en base. Le mécanisme (`backend/secretStore.js`) :

- `decrypt()` (l. 155-190) renvoie **chaîne vide** en cas d'échec → toutes les clés `*_api_key` deviennent « absentes » ;
- résolution de la clé maître (`loadOrCreateMasterKey`, l. 60-135), dans l'ordre :
  1. variable d'environnement `WACOPILOTE_MASTER_KEY` ;
  2. fichier `master-key.enc` (scellé safeStorage) déchiffré via un **helper Electron lancé en sous-processus avec un timeout de 5 000 ms** (l. 91) — silencieux en cas d'échec ;
  3. fichier `master-key` en clair dans le répertoire de données résolu ;
  4. fichier `master-key` en clair à la racine du projet ;
  5. **sinon : génération d'une nouvelle clé aléatoire** — qui rend ipso facto tous les secrets existants indéchiffrables.

**Déclencheurs probables (à confirmer, voir plan phase 1) :**
- **(a) timeout helper trop court** : 5 s pour un démarrage à froid d'Electron (antivirus Windows, disque lent) → le déchiffrement échoue silencieusement → étape 5 → nouvelle clé ;
- **(b) mélange dev/packagé** : en dev, `resolveUserDataDir()` (secretStore.js l. 27-47) **retombe sur `%APPDATA%/WaCopilote` si une base y existe** (installation packagée) — le backend dev utilise alors la base de production mais résout la clé à sa manière, différemment du process Electron (qui, en production, passe `WACOPILOTE_MASTER_KEY` au backend forké — `electron/main.cjs` l. 150-194 ; en dev il ne le fait pas exprès) ;
- **(c) clé et base séparées** : `master-key`(±`.enc`) et `database.sqlite` sont tous deux gitignorés — un nettoyage/re-clone qui garde la base mais perd la clé produit exactement cette erreur ;
- **(d) données copiées d'une autre machine** : `master-key.enc` est lié à la machine/utilisateur par DPAPI — il devient indéchiffrable ailleurs.

**Conséquence directe dans vos logs** : `gemini_api_key` déchiffrée → `''` → la variable `GEMINI_API_KEY` n'est **pas injectée** dans l'environnement du processus Gemini CLI enfant (`agentFallbackRouter.js` l. 190-199) ; même chose pour la clé NVIDIA/OpenAI (« not configured »). C'est aussi pourquoi **aucune tentative « Gemini API » n'apparaît** dans la cascade : le canal est détecté « sans clé ».

#### Couche 2 — Cause immédiate : Gemini CLI sort en erreur d'authentification en mode headless

L'exécution de secours lance (`agentFallbackRouter.js` l. 174-199) :

```
gemini -p "<prompt>" -o text     (timeout 35 s, GEMINI_API_KEY absente cf. couche 1)
```

Le badge « présent » des Réglages ne prouve rien pour ce cas : la détection (`detectInstalledClis`, `externalAgentRunner.js` l. 204-230) exécute seulement `gemini --version`, qui **ne nécessite aucune authentification**.

Or en mode non interactif (`-p`), Gemini CLI exige soit une identité OAuth **déjà en cache**, soit une clé passée par variable d'environnement — sans quoi il termine sur `FatalAuthenticationError` (code de sortie 41) (docs Gemini CLI : « Headless mode will use your existing authentication method, if an existing credential is cached. If you have not already signed in [...], you must configure authentication using environment variables » — https://geminicli.com/docs/get-started/authentication/ ; codes de sortie : https://geminicli.com/docs/resources/troubleshooting/).

**Claude Code fonctionne** car son authentification est indépendante (connexion propre à Claude CLI, sans lien avec la clé maître WaCopilote ni GEMINI_API_KEY) — ce qui confirme le diagnostic différentiel.

Causes secondaires à écarter formellement en phase 1 (moins probables) : validité du drapeau `-o text` sur votre version installée, Node système < 20. **Le timeout (35 s) est exclu** : un dépassement produirait le message « Délai d'exécution dépassé (35000ms) » et non le message générique observé.

#### Couche 2bis — Verrou « Workspace Trust » (apport du diagnostic croisé, ✅ vérifié)

Depuis le durcissement de sécurité de `@google/gemini-cli` (advisory **GHSA-wpqr-6v78-jr5g**, criticité **CVSS 10.0**, corrigé dans les versions 0.39.1+/0.40.0), le mode headless **n'honore plus la confiance implicite du dossier de travail** : si le `cwd` n'est pas trusté, la CLI lève `FatalUntrustedWorkspaceError` et sort (exit ≠ 0, constaté : code 1) **même avec une clé valide**, avec le message :

> *« Gemini CLI is not running in a trusted directory. To proceed, either use `--skip-trust`, set the `GEMINI_CLI_TRUST_WORKSPACE=true` environment variable, or trust this directory in interactive mode. »* (docs officielles — trusted-folders/#headless-and-automated-environments)

L'invocation du routeur (`agentFallbackRouter.js` l. 174-199) ne passe **ni le flag ni la variable** → ce verrou se cumule à la couche 2 (authentification) sur v0.57.0.

> ⚠️ **Pourquoi ce verrou existe (à ne pas contourner à la légère)** : avant 0.39.1, un dossier `.gemini/.env` malveillant dans le répertoire de travail pouvait conduire à une exécution de code à distance en headless. Le trust explicite est une barrière volontaire. Pour WaCopilote le trade-off est acceptable **à condition de scope le contournement à l'invocation gemini du routeur** (dont le `cwd` par défaut est le dossier contrôlé de l'application, pas un dépôt arbitraire) et de ne pas l'activer globalement sur le poste.

#### Couche 3 — Bug d'observabilité : la vraie erreur est capturée puis jetée

`agentFallbackRouter.js` l. 204-206 :

```js
if (!result.success && !result.stdout) {
    throw new Error(result.error || `Échec d'exécution du CLI '${cliCommand}'`);
}
```

`executeExternalCli` (close handler, `externalAgentRunner.js` l. ~357-365) remplit `error` **uniquement** pour : commande non autorisée, échec de lancement, timeout. Pour un exit code ≠ 0 « propre », `result.error` est `undefined` et le message générique est utilisé — **tandis que `result.stderr`, qui contient la raison réelle renvoyée par Gemini CLI, est capturé puis ignoré**. C'est le trou noir diagnostic qui rend le bug difficile à cerner.

---

## 🐛 BUG B — « La stratégie de routage apparaît 2 fois dans les Réglages »

### Cause exacte : deux sélecteurs liés à la même clé de réglage, sur la même page — doublon introduit en v1.48.0

| Emplacement | Fichier:ligne | Comportement |
|---|---|---|
| Section **« Stratégie d'Appel LLM & Résilience »** (ajoutée v1.48.0 dans la section Moteur IA) | `src/pages/Settings.jsx` l. 271-320 | `CustomSelect` sur `ai_execution_strategy` + sous-sélecteur `default_cli_agent` ; état local `backendSettings`, **sauvegarde différée** via le bouton global (`handleSaveAll`, l. 160, `PUT /api/settings`) |
| Panneau **« Bridge CLI & Protocoles Agentiques »** monté plus bas **dans la même page** | `src/components/CliAgentBridgeSettings.jsx` l. 166-185 (monté à `Settings.jsx` l. 762) | Second sélecteur sur **la même clé** `ai_execution_strategy` ; état local `strategyInfo` chargé au montage (`GET /api/settings/channels-status`) ; **sauvegarde immédiate** au changement (`PUT /api/settings`) |

Le commentaire du code (`CliAgentBridgeSettings.jsx` l. 166-168) admet la redondance : *« Stratégie d'exécution IA — synchronisation directe avec les Réglages. Même clé (`ai_execution_strategy`) que la section "Stratégie d'Appel LLM" »*. La v1.48.0 a ajouté la section principale **sans retirer** le sélecteur historique du panneau Bridge, qui n'avait de raison d'être que lorsqu'il était le seul point d'entrée.

### Aggravant : les deux affichages peuvent se contredire

Les deux composants tiennent chacun leur état local, chargé à des moments différents, **sans mécanisme de rafraîchissement croisé** (ni event bus, ni store partagé) :

- changer la stratégie dans le panneau Bridge (sauvegarde immédiate) → la section principale continue d'afficher l'ancienne valeur (état local périmé) ;
- changer dans la section principale + Enregistrer → le panneau Bridge continue d'afficher sa valeur chargée au montage.

Ce n'est donc pas seulement un doublon visuel : les deux sélecteurs peuvent **afficher simultanément des valeurs différentes** de la même clé. Aucun risque d'intégrité des données (même clé en base), mais incohérence UX réelle.

---

## 📋 PLAN DE CORRECTIFS — Phase immédiate SANS toucher au code

### Phase 1 — Diagnostic ciblé (30 min, outils existants uniquement)

**1. Révéler la vraie erreur Gemini (elle est déjà capturée, il suffit de la demander)**
L'endpoint existant `POST /api/cli/test-bridge` en mode `external` retourne `details` **avec stderr** (`routes/cliBridge.js` l. 120-135). Depuis la page Réglages → panneau « Bridge CLI » → console de test :
- Mode : **Externe** · Commande : `gemini` · Prompt : `Bonjour, réponds en une phrase`
- Ou en direct (backend démarré, token récupéré dans le fichier `api-token` du répertoire de données) :
  ```bash
  curl -X POST http://127.0.0.1:3000/api/cli/test-bridge \
    -H "Authorization: Bearer $(cat api-token)" -H "Content-Type: application/json" \
    -d '{"mode":"external","cliCommand":"gemini","cliArgs":["-p","Bonjour","-o","text"]}'
  ```
→ Le champ `response`/`details.stderr` contiendra la cause réelle (attendu : erreur d'authentification).

**2. Répliquer l'invocation exacte dans un terminal** (même utilisateur que celui qui lance WaCopilote) :
```bash
gemini --version                      # présent ? version ?
echo $GEMINI_API_KEY                  # (PowerShell : Get-ChildItem Env:GEMINI_API_KEY)
gemini -p "Bonjour" -o text           # la commande exacte du routeur → lire stderr
gemini                                # UNE FOIS en interactif : déclenche la connexion OAuth
```
Si `gemini -p` échoue avant la connexion OAuth et réussit après → cause = authentification (confirmé). Vérifier `~/.gemini/` (`%USERPROFILE%\.gemini\`) : présence du cache d'identification.

**3. Établir l'état des lieux de la clé maître** (cause racine couche 1) — lister les emplacements :
- `whatsapp-ai-saas/master-key`, `whatsapp-ai-saas/master-key.enc`, `whatsapp-ai-saas/database.sqlite` (dev) ;
- `%APPDATA%/WaCopilote/master-key`, `master-key.enc`, `database.sqlite` (packagé).
Scénario de collision confirmé si : base présente dans les DEUX, ou `.enc` présent sans `master-key` en clair à côté de la base utilisée, ou base ancienne + clé régénérée récemment (date du fichier `master-key` postérieure à la base).

### Phase 2 — Correction par la configuration (aucune modification de code)

**A. Rétablir l'authentification Gemini CLI (débloque immédiatement le canal)**
- Option 1 (recommandée — **résout les deux verrous d'un coup**) : lancer `gemini` une fois en interactif **depuis le répertoire de travail du backend** (`whatsapp-ai-saas/`) : la session interactive déclenche (i) la connexion OAuth (cache pour le headless) **et** (ii) le dialogue « Trust this folder? » → confiance persistante inscrite dans `~/.gemini/trustedFolders.json` (`%USERPROFILE%\.gemini\trustedFolders.json`) ;
- Option 2 : définir `GEMINI_API_KEY` comme variable **système** (AI Studio) → le processus enfant l'héritera (`executionEnv = {...process.env, ...env}`) même si la clé stockée en base reste illisible. Pour le seul verrou trust, la variable **`GEMINI_CLI_TRUST_WORKSPACE=true`** au niveau système fonctionne aussi sans aucun code (session par session).

**B. Ré-armer les secrets WaCopilote (annule les conséquences de la couche 1)**
1. Choisir UN répertoire de données cohérent (éviter le mélange base dev / base packagée) ;
2. Renseigner à nouveau les clés API dans Réglages → elles seront chiffrées avec la clé maître courante → le message SecretStore disparaît, les canaux « Gemini API » et « OpenAI/NVIDIA » redeviennent disponibles, la cascade reprend son ordre nominal ;
3. Si la base utilisée est une base de test héritée : la supprimer (recommandation déjà émise par le changelog v1.47.2) — une base neuve repart proprement.

**C. Bug B (doublon) — contournement immédiat**
- Utiliser **uniquement** la section « Stratégie d'Appel LLM & Résilience » (haut de page) comme point de référence ; rafraîchir la page (F5) après tout changement pour resynchroniser les deux affichages. Le doublon est cosmétique : les deux écrivent la même clé en base, aucune donnée n'est corrompue.

### Phase 3 — Correctifs à programmer dans une future version (description, non appliqués)

> **✅ Statut application (2026-08-31) :** **les 7 correctifs C1→C7 sont appliqués** — C1+C2+C3 (v1.48.2), C4+C5 (v1.48.3), C6+C7 (v1.48.4), branche `arena/01a057ee-lunar-nova` — validation à chaque lot : tests 0 échec (253 → 255 → 262) · ESLint 0/0 · build Vite OK · bump + changelog Support.jsx + memory-bank à chaque fois. **Plan fermé.**

| # | Correctif | Fichier:ligne | Nature | Priorité |
|---|---|---|---|---|
| C1 | Inclure `stderr` dans l'erreur propagée : `throw new Error(result.error || result.stderr?.slice(0,300) || \`Échec d'exécution...\`)` | `agentFallbackRouter.js:206` | 1 ligne, observabilité | **P0** — débloque tout diagnostic futur |
| C2 | Timeout du helper de déchiffrement 5 s → 15 s (cold start Electron/antivirus) | `secretStore.js:91` | 1 valeur | **P0** |
| C3 | **Fiabiliser l'exécution headless de Gemini CLI (Workspace Trust)** — ⚠️ **préférer la variable d'environnement au flag** : injecter `GEMINI_CLI_TRUST_WORKSPACE: 'true'` dans le bloc `env` de l'invocation gemini, et non `--skip-trust` en argument. **Raison (vérifiée)** : les gemini-cli **0.38.x rejettent le flag inconnu** (`Unknown arguments: skip-trust`, exit non nul → toute la cascade de repli brûle — régression constatée chez d'autres intégrateurs, issue openclaw #74749), tandis que la variable d'env est **ignorée silencieusement** par les versions qui n'en ont pas besoin et honorée par les 0.39.1+ (v0.57.0 incluse). Scoper au seul canal gemini du routeur — le `cwd` d'exécution est le dossier contrôlé de l'app, cf. note sécurité couche 2bis (advisory GHSA-wpqr-6v78-jr5g, CVSS 10.0) | `agentFallbackRouter.js:190-199` (+ propagation optionnelle `externalAgentRunner.js`) | 3 lignes | **P0** |
| C4 | Alerte UI explicite quand `decrypt()` échoue (aujourd'hui : 1 ligne stderr + champ vide) : notification « Clés illisibles — ressaisissez vos clés » | `secretStore.js:186` + `Settings.jsx` | Petit | P1 |
| C5 | Dédupliquer le sélecteur de stratégie : retirer le sélecteur du panneau Bridge (le convertir en libellé d'état en lecture seule) OU l'inverse ; ajouter un rafraîchissement croisé (remontée d'événement ou store partagé) | `CliAgentBridgeSettings.jsx:166-185` | Moyen | P1 (UX) |
| C6 | Pré-vol d'authentification + trust : tester `gemini -p ping` (timeout court, trust accordé) dans `detectInstalledClis` pour distinguer « installé » / « installé mais non authentifié ou non trusté » dans les badges des Réglages | `externalAgentRunner.js` | Moyen | P2 |
| C7 | Journaliser un événement horodaté lors de la **régénération** d'une clé maître (étape 5 de la résolution) pour tracer la cause des ruptures | `secretStore.js:128-135` | Petit | P2 |

### Matrice de validation (après chaque action)

| Test | Commande / geste | Résultat attendu |
|---|---|---|
| Auth Gemini headless | `gemini -p "ping" -o text` | Réponse texte, exit 0 |
| Détection badge | page Réglages → badges canaux | Gemini CLI détecté (inchangé) |
| Test bridge externe | console Bridge, mode Externe, `gemini` | `success: true` |
| Cascade complète | chat avec un agent (stratégie `auto`) | plus aucun « Échec d'exécution du CLI 'gemini' » |
| Secrets | redémarrage `start:all` | plus de `[SecretStore] Déchiffrement impossible` |
| Doublon stratégie | F5 Réglages après changement | les deux sélecteurs affichent la même valeur (avant C4) |

---

## 🧩 Chaîne de cause à effet (résumé)

```
Clé maître changée/perdue (secretStore — helper 5 s trop court, ou base/clé séparées, ou mélange dev/packagé)
   └─> decrypt() → '' pour toutes les *_api_key        [SecretStore:186]
        ├─> GEMINI_API_KEY non injectée au enfant       [agentFallbackRouter:190-199]
        ├─> canal « Gemini API » exclu de la cascade    (absent de vos logs ✓)
        └─> « OpenAI/NVIDIA API key not configured »    [log ✓]
             └─> gemini -p ... : DOUBLE verrou sur v0.57.0
                  ├─ (1) pas de clé d'env ni OAuth en cache → FatalAuthenticationError
                  └─ (2) dossier de travail non trusté → FatalUntrustedWorkspaceError   [couche 2bis]
                       └─> stderr (la preuve) jeté par le routeur  [agentFallbackRouter:206]  ← C1
                            └─> message générique « Échec d'exécution du CLI 'gemini' »  [log ✓]
                                 └─> repli Claude (auth ET trust indépendants) → succès  [log ✓]
```

---

*Références externes : authentification Gemini CLI (headless/OAuth/clé) — geminicli.com/docs/get-started/authentication/ ; codes de sortie (41 = FatalAuthenticationError) — geminicli.com/docs/resources/troubleshooting/ ; **dossiers trustés & headless (`--skip-trust`, `GEMINI_CLI_TRUST_WORKSPACE`, `trustedFolders.json`) — geminicli.com/docs/cli/trusted-folders/** ; rejet du flag `--skip-trust` par gemini-cli 0.38.x — github.com/openclaw/openclaw/issues/74749 ; durcissement trust headless (GHSA-wpqr-6v78-jr5g, CVSS 10.0, patch 0.39.1+) — penligent.ai/hackinglabs/gemini-cli-rce-workspace-trust-and-the-ci-cd-agent-attack-surface/ ; Node ≥ 20 requis — docs officielles Gemini CLI.*

---

## 📌 Annexe — Validation du diagnostic croisé (v2)

| Point du diagnostic croisé | Vérification | Statut |
|---|---|---|
| Workspace Trust bloque le headless (`--skip-trust` / `GEMINI_CLI_TRUST_WORKSPACE=true`) | Docs officielles « Trusted Folders » : message d'erreur exact confirmé mot pour mot, `FatalUntrustedWorkspaceError` en headless si dossier non trusté | ✅ **Confirmé** |
| Flag `--skip-trust` utilisable tel quel | ⚠️ Vrai sur v0.57.0, **mais rejeté par gemini-cli 0.38.x** (`Unknown arguments: skip-trust` → exit non nul → cascade entière brûlée). La variable d'env est l'option compatible avec toutes les versions | 🔧 **Raffiné** — C3 = env var, pas flag |
| Nature « verrou de sécurité volontaire » | Advisory GHSA-wpqr-6v78-jr5g (CVSS 10.0) : trust auto headless = vecteur RCE via `.gemini/.env` malveillant → contournement à scoper à l'invocation du routeur uniquement | ✅ Confirmé + **garde-fou ajouté** |
| Timeout helper 5 s → régénération silencieuse (racine crypto) | Convergence des deux diagnostics — C2 (15 s) inchangé | 🤝 Convergé |
| stderr jeté par le routeur (observabilité) | Convergence — C1 inchangé | 🤝 Convergé |
| Doublon sélecteur stratégie | Convergence — C5 (ex-C4) inchangé | 🤝 Convergé |
| Action immédiate : login interactif `gemini` | **Renforcé** : la session interactive règle AUSSI le trust du dossier (`trustedFolders.json`) — double verrou (auth + trust) résolu en un geste, sans code | 💎 Complété |
