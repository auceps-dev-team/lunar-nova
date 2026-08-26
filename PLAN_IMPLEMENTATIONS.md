# 🛠️ Plan d'implémentations & de correctifs — WaCopilote v1.42.12

> **Source :** croisement de deux audits —
> ① *Audit complet interne* (`AUDIT_COMPLET_2026-08-26.md`, 14 constats N1→N14 vérifiés fichier:ligne) ;
> ② *Audit « Antigravity AI Engine »* (vision macro + recommandations produit).
> **Date :** 2026-08-26 · **Base :** branche `arena/01a03da0-lunar-nova`, commit `195c8bd`.

---

## 1. Méthodologie & règles d'exécution (héritées du dépôt)

1. **Anti faux positifs** : vérifier chaque point dans le code avant de modifier.
2. **Boucle de contrôle après chaque modification** : `npx vitest run` + `npx eslint .` + `npx vite build`.
3. **Versionnage commenté** (cf. `CONTRIBUTING.md`) :
   - `+0.1.0` = nouvelle fonctionnalité / changement de contrat ;
   - `+0.0.1` = correctif notable / changement de comportement ;
   - `—` = autre (docs, commentaires, formatage, refactor sans comportement, tests, CI) ;
   - **la version n'est pas modifiée dans une PR** : le mergeur s'en charge via `bump_version.sh`.
4. **Une PR = un sujet.** Description du problème avant la solution.
5. **Sécurité** : jamais d'issue publique pour une faille ; review dédiée.

---

## 2. Vue d'ensemble consolidée

| Lot | Priorité | Contenu | Effort | Bump cumulé |
|---|---|---|---|---|
| **P0 — Sécurité & blocages** | 🔴 Haute | Fermer la surface d'écriture directe WP (N12) · Livrer la CI (N3) | ~0,5 j | `+0.0.1` |
| **P1 — Quick wins** | 🟠 Moyenne | Synchro versions, nettoyages, bouton « supprimer la clé », i18n Prospection | ~2 j | `+0.1.0` (1 feat) |
| **P2 — Dette structurelle** | 🟡 Normale | i18n es/ar, testabilité DB, extension des tests, E2E | 3–5 j | `—` |
| **P3 — Produit / stratégique** | 🔵 Long terme | Cloud API WhatsApp, workflows agentiques, proxies, vocal | sprints dédiés | `+0.1.0` chacun |
| **H — Actions hors code** | ⚪ Éditeur | Release ≥ 1.42.12, permissions GitHub, décisions produit | — | — |

---

## 3. Lot P0 — Sécurité & blocages

### P0-1 · Fermer la surface d'écriture directe WordPress — **N12**
- **Problème :** `backend/routes/wordpress.js` expose `POST /api/wp/:id/posts` (l.231) et `POST /api/wp/:id/products` (l.243), qui ciblent des endpoints PHP legacy **non routés** dans le plugin (→ 404 aujourd'hui, donc *dormant*, pas exploitable). Le frontend ne les appelle pas (il passe par `/propose`, HITL). Par principe de défense en profondeur et cohérence HITL, on les retire.
- **Actions :**
  1. Supprimer les deux handlers du proxy Express.
  2. (2ᵉ PR) Supprimer les callbacks PHP morts `wac_bridge_create_post` / `wac_bridge_create_product` (`wacopilote-bridge.php`, section « Legacy direct-write ») pour empêcher qu'on les rebranche.
- **Fichiers :** `backend/routes/wordpress.js`, `wordpress-plugin/wacopilote-bridge/wacopilote-bridge.php`.
- **Type / bump :** `security` · `+0.0.1`.
- **Effort :** S · **Risque :** faible (aucun appelant).
- **Validation :** `grep` (plus de route POST directe) + `vitest run` + `eslint .` + `vite build` ; smoke test WordPress optionnel.

### P0-2 · Livrer réellement la CI — **N3**
- **Problème :** `TRAITEMENT_AUDIT.md` dit le workflow « conservé sur le disque » ; il n'existe **ni sur le disque, ni dans Git**.
- **Actions :** créer `.github/workflows/ci.yml` (**à la racine du dépôt** — GitHub Actions n'exécute pas les workflows placés sous `whatsapp-ai-saas/`) : `checkout` → `setup-node@20` (avec `cache: npm`) → `npm ci` (racine **et** `backend/`) → `npx vitest run` → `npx eslint .` → `npx vite build`. Déclencheurs : `push` (main), `pull_request`, `workflow_dispatch`.
- **Note technique :** prévoir `libsqlite3-dev` (ou `npm ci` standard ; Ubuntu dispose des prébuilds `sqlite3`) pour que la suite tourne avec le binding natif.
- **Prérequis :** permission GitHub « workflows » (déjà identifiée comme manquante → cf. H2).
- **Type / bump :** `chore` · `—`.
- **Effort :** S · **Risque :** faible.
- **Validation :** CI verte sur la PR d'ouverture.

---

## 4. Lot P1 — Quick wins (nettoyages & finitions)

| # | Constat | Action | Fichier(s) | Type · bump | Effort |
|---|---|---|---|---|---|
| P1-1 | **N1** version `1.42.0` figée | Passer à `1.42.12` les fichiers périmés (**le README racine est déjà à 1.42.12** — seuls `whatsapp-ai-saas/README.md` et les 2 `package-lock.json` sont figés à `1.42.0`) ; **étendre `bump_version.sh`** pour couvrir aussi `whatsapp-ai-saas/README.md` et les deux `package-lock.json` | `whatsapp-ai-saas/README.md`, `package-lock.json` ×2, `bump_version.sh` | `chore` · `—` | S |
| P1-2 | **N2** placeholder bug | `1.42.0` → `1.42.12` (ou texte « visible dans les Réglages ») | `.github/ISSUE_TEMPLATE/bug_report.yml` | `chore` · `—` | XS |
| P1-3 | **N10** pas de `LICENSE` racine | Copier `whatsapp-ai-saas/LICENSE` à la racine (GitHub affichera la licence) | `LICENSE` | `chore` · `—` | XS |
| P1-4 | **N7** changelog in-app figé à v1.40.0 | Ajouter `v1.41.0` → `v1.42.12` (source : `TRAITEMENT_AUDIT.md`) | `src/pages/Support.jsx` | `chore` · `—` | S |
| P1-5 | **N6** handler IPC `ping` mort | Retirer `ping` du preload (aucun handler main, aucun usage renderer — vérifié) | `electron/preload.cjs` | `chore` · `—` | XS |
| P1-6 | **N9** typo « unistall » | Corriger en « uninstall » **après** confirmation de l'URL réelle (sinon corriger la page côté éditeur) | `build/installer.iss:66`, `build/installer.nsh:15` | `chore` · `—` | XS |
| P1-7 | **N8** résidus `gemini-1.5-pro` | Remplacer par `gemini-2.5-flash` (défauts cache-key + log) | `backend/routes/ai.js` (l.74,95), `backend/db.js` (l.335) | `chore` · `—` | XS |
| P1-8 | **N11** `.env.example` désynchronisé | Retirer `NVIDIA_KEY_GEMMA` (aucun modèle ne la lit ; `NVIDIA_DEFAULT_API_KEY` couvre tout) | `backend/.env.example` | `chore` · `—` | XS |
| P1-9 | **N13** défaut OpenRouter figé | Centraliser `DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet'` (3 occurrences) + documenter le `HTTP-Referer` obligatoire | `backend/openrouterService.js` | `chore` · `—` | S |
| P1-10 | **Antigravity #2** + audit interne | **Bouton « Supprimer la clé »** : endpoint `DELETE /api/settings/:key` (secrets uniquement, suppression de la ligne `app_settings`) + bouton poubelle/confirmation dans Settings | `backend/routes/settings_and_agents.js`, `src/pages/Settings.jsx`, locales | `feat` · `+0.1.0` | S/M |
| P1-11 | **Antigravity #1** | i18n de `Prospection.jsx` : chaînes FR en dur (`'Mise à jour démarrée'`, `'Erreur'`, `'Liste vidée…'`, `'Non précisé'`, `'Démarrage…'`) → `t('…')` | `src/pages/whatsapp/Prospection.jsx`, `src/locales/*.json` | `chore` · `—` | S |

> **Note P1-10 (bouton supprimer la clé) :** aujourd'hui `PUT /api/settings` ignore les valeurs vides sur les secrets (`isSecretKey && value === ''`), donc une clé ne peut pas être effacée — limitation documentée dans le commentaire du routeur. Le nouveau endpoint doit **supprimer la ligne** (`DELETE FROM app_settings WHERE setting_key = $1`) et n'être autorisé que sur les clés `*_api_key`. L'UI rafraîchit `secretsSet` après suppression.

---

## 5. Lot P2 — Dette structurelle

| # | Constat | Action | Fichier(s) | Type · bump | Effort |
|---|---|---|---|---|---|
| P2-1 | **N4** es/ar à ~32 % — **824 clés manquantes** (fr/en = 1 143 vs es/ar = 366) et **47 clés surnuméraires** à réconcilier | Compléter `es.json` et `ar.json` jusqu'à parité avec fr/en (script d'extraction des clés manquantes, traduction, **réconciliation des 47 clés en trop**, review). Alternative si budget : documenter la couverture dans le README | `src/locales/es.json`, `ar.json` | `chore` · `—` | M/L (~2 j) |
| P2-2 | **N14** `initDB()` + `process.exit(1)` au chargement | Rendre l'initialisation DB **exportable/injectable** : ne plus déclencher le « fail fast » au `require`, l'appeler au démarrage (`server.js`). Supprime le `process.exit` intercepté sous Vitest sans binding natif | `backend/db.js`, `backend/server.js` | `refactor` · `—` | M |
| P2-3 | Feuille de route Q3 + audit interne | **Étendre les tests** : (a) extraire la logique de parsing des scrapers hors `page.evaluate()` → tests unitaires ; (b) adaptateurs LLM avec fetch mocké ; (c) migrations de schéma sur base SQLite en mémoire | `backend/__tests__/`, `backend/scrapers/`, `backend/*Service.js` | `test` · `—` | L (~2-3 j) |
| P2-4 | Antigravity moyen terme | **Tests E2E Playwright ↔ webview** (interaction Puppeteer sur les webviews) avec `xvfb` + binaire Playwright en CI | `e2e/`, `.github/workflows/ci.yml` | `test` · `—` | L |
| P2-5 | **N5** dump HTML GoAfrica (116 Ko) suivi par Git | Décision : (a) conserver + documenter l'origine et le rôle (aucune PII — vérifié) **ou** (b) exclure du suivi et régénérer par fetch réseau. Recommandation par défaut : (a) + note dans `SECURITY.md`/`CONTRIBUTING.md` | `backend/goafrica-tg-annuaire.html`, `.gitignore` | `chore` · `—` | S |

---

## 6. Lot P3 — Produit / stratégique (feuille de route)

| # | Source | Action | Bump | Effort |
|---|---|---|---|---|
| P3-1 | Feuille de route 2027 + Antigravity | **WhatsApp Cloud API officiel** en option (bascule webview CDP → webhook Cloud API) | `+0.1.0` | XL |
| P3-2 | Antigravity | **Workflows agentiques multi-étapes** (Scrape → Enrichissement IA → Validation Admin → Envoi) dans l'orchestrateur | `+0.1.0` | L |
| P3-3 | Antigravity (optionnel) | **Rotation de proxies** pour les scrapers (HTTP/SOCKS5) — à valider produit (surface de maintenance) | `+0.1.0` | M |
| P3-4 | Feuille de route 2027 | **Assistant vocal WhatsApp** (transcription + réponse vocale) | `+0.1.0` | XL |

---

## 7. Lot H — Actions hors code (éditeur / équipe)

| # | Action | Blocage levé |
|---|---|---|
| H1 | Publier une release **≥ 1.42.12** dans `auceps-dev-team/wacopilote-releases` (`npm run electron:publish`) | **Updater inopérant tant que non fait** (condition sine qua non) |
| H2 | Accorder la permission GitHub **workflows** | Permet P0-2 (CI) |
| H3 | Trancher le sort de `goafrica-tg-annuaire.html` (P2-5) | Propreté du dépôt |
| H4 | Confirmer l'URL de désinstallation (`/uninstall-wacopilote/` vs `/unistall-…/`) avant P1-6 | Évite de « corriger » une URL qui existerait réellement |

---

## 8. Décisions assumées — à NE PAS modifier (pour éviter les re-litiges)

Ces points, relevés par l'un ou l'autre audit, ont été tranchés et documentés ; le plan ne les remet pas en cause :

1. **`disable_safety_checker` = `true` par défaut** sur Together/Qwen (shootings fashion) — l'option de l'appelant est désormais respectée.
2. **Dédup des numéros sans rapprochement indicatif/national** (comportement défensif, testé).
3. **Automatisation WhatsApp Web maintenue** malgré le risque de restriction — aucune extension de surface sans réflexion (règle CONTRIBUTING).
4. **Masquage des logs par défaut** (`WACOPILOTE_LOG_MESSAGES=1` pour diagnostic).
5. **HITL WordPress strict** : l'IA propose, l'humain exécute (renforcé par P0-1).
6. **Routage `aiController` non unitarisable sans DI** — documenté ; la résolution de clé est couverte par `nvidiaModels.test.js`.

---

## 9. Séquence d'exécution recommandée

```
H2 (permission workflows) ──────────────┐
                                        ▼
P0-1 (N12) → P0-2 (N3)  →  P1 (1 ou 2 PR groupées)
                              ├─ PR "nettoyages" : P1-1 → P1-9
                              ├─ PR "feat clé"   : P1-10
                              └─ PR "i18n prospection" : P1-11
                                        ▼
P2 (selon budget) : P2-2 → P2-3 → P2-1 → P2-4
P2-5 (décision H3 d'abord)
                                        ▼
H1 (release ≥ 1.42.12) avant toute mise en production
                                        ▼
P3 (sprints dédiés, feuille de route)
```

**Dépendances clés :**
- P2-3 (migrations) dépend de P2-2 (testabilité DB).
- P2-4 (E2E) dépend de P0-2 (CI) et d'un runner avec affichage.
- P1-10 (suppression de clé) est indépendant et peut partir en parallèle.
- H1 est bloquant pour le système de mise à jour, indépendamment du reste.

---

## 10. Critères de fin (Definition of Done)

Pour **chaque** lot :
- ✅ `npx vitest run` vert (aujourd'hui 114 tests, jamais de régression) ;
- ✅ `npx eslint .` = 0 erreur / 0 avertissement ;
- ✅ `npx vite build` OK ;
- ✅ version synchronisée partout via `bump_version.sh` (étendu par P1-1) ;
- ✅ commit au format `WaCopilote vX.Y.Z - type: description` ; PR = un sujet, problème décrit avant la solution ;
- ✅ tout correctif touchant WhatsApp Web, secrets ou schéma DB est **expliqué** dans la PR (points d'attention du gabarit).

---

## 11. Correspondance constats ↔ tâches (traçabilité)

| Audit ① (interne) | Audit ② (Antigravity) | Tâche |
|---|---|---|
| N1 | — | P1-1 |
| N2 | — | P1-2 |
| N3 | — | P0-2 |
| N4 | « i18n **complet** » (contesté) | P2-1 |
| N5 | — | P2-5 |
| N6 | « openWhatsAppTab » (inexistant) | P1-5 |
| N7 | — | P1-4 |
| N8 | — | P1-7 |
| N9 | — | P1-6 |
| N10 | — | P1-3 |
| N11 | — | P1-8 |
| N12 | (non vu) | P0-1 |
| N13 | — | P1-9 |
| N14 | « busy_timeout 5000 » (inexistant) | P2-2 |
| — (bouton clé documenté dans le code) | Reco #2 « Supprimer la clé » | P1-10 |
| — | Reco #1 « i18n Prospection » | P1-11 |
| — | Reco moyen terme « E2E » | P2-4 |
| — | Reco moyen terme « proxies » | P3-3 |
| — | Reco long terme « Cloud API / agentic » | P3-1, P3-2 |
| Updater inopérant (audit ①) | « Production-Ready » (contesté) | H1 |
