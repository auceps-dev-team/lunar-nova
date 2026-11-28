# Marketplace : étude de huit dépôts de gestion

*28/11/2026. Ce document complète le cadrage de l'issue #30 (catalogue, application sur les cinq voies, plan en six PR).*

**But.** Comprendre comment ces dépôts sont construits et comment leur code fonctionne, pour en tirer des fonctionnalités du Marketplace. Contrainte du mainteneur : ces fonctionnalités ne doivent **ni ralentir ni alourdir** WaCopilote, dans la mesure du possible.

**Méthode.**
- **Ce qui est lu**, sans téléchargement ni exécution de code : licences, manifestes, schémas de données et arborescences, consultés par l'API GitHub aux commits du §10.
- **Ce qui est mesuré** : le poids des bibliothèques candidates, compilées et minifiées avec esbuild. Les paquets ont été installés dans un dossier isolé, sans exécuter leurs scripts.

Chaque fait indique s'il est **mesuré** (avec sa date) ou **lu** (avec le fichier concerné).

---

## 1. Décisions du mainteneur (28/11)

- **Nom** : « Marketplace ».
- **`mcp-externe`** : actif par défaut.
- **`taches`** : gardée, et c'est elle que le §6-A propose de faire grandir.
- **`boite-a-outils`** : **supprimée**. Elle ne devient pas une entrée du Marketplace : la page `/tools` (`ToolsBox.jsx`) et son entrée de menu disparaissent. Comme cette suppression touche `App.jsx`, elle est à faire **après** la reconstruction de #22.
- **`agents-cli-locaux`** : **désactivé par défaut** (décision du 28/11). L'utilisateur l'active depuis le Marketplace, avec la confirmation prévue pour le risque `execution-locale`. La fonctionnalité H du §6 en dépend.

## 2. Ce qu'on a le droit de reprendre

WaCopilote est sous **AGPL-3.0-only** (`package.json`).

| Dépôt | Licence (lue) | Reprise de code | Exclusions et remarques |
|---|---|---|---|
| EverRoom | Apache-2.0 (`LICENSE`) | Oui | Garder `LICENSE`/`NOTICE` et signaler les modifications. Le projet se dit en développement actif, avec macOS pour cible, et annonce que ses schémas peuvent changer (README). |
| Alexandrie | MIT | Oui | Code en Vue 3 et Go : il n'est pas transposable tel quel dans notre React. |
| Plane | AGPL-3.0 | Oui | Même licence que nous, en gardant les mentions. Python/Django et MobX : on reprend des modèles plutôt que du code. |
| vibe-kanban | Apache-2.0 | Oui | **En fin de vie** (README : *« Vibe Kanban is sunsetting »*). On ne doit pas en dépendre. |
| Kaneo | MIT | Oui | — |
| AFFiNE | MIT **hors** `packages/backend` et `packages/common/native` | Oui, hors ces deux dossiers | Ces dossiers sont sous licence *Enterprise Edition*, dont l'usage en production exige un abonnement (`packages/backend/server/LICENSE`). **Rien à reprendre d'eux.** |
| Docmost | AGPL-3.0 **hors** `apps/server/src/ee`, `apps/client/src/ee`, `packages/ee` | Oui, hors ces dossiers | Ces dossiers sont sous licence *Enterprise* (README). **Rien à reprendre d'eux.** Les fichiers n'ont pas d'en-tête de licence : c'est à nous de l'ajouter. |
| Novel | Apache-2.0 | Oui | **Plus entretenu** : dernier commit le 18/01/2025. |

**Règle pour tout code repris.**
- Un en-tête dans le fichier : `Adapté de <dépôt>@<commit>, <licence>`.
- Une ligne dans un `THIRD_PARTY_NOTICES.md` à la racine de l'application.
- Uniquement des chemins autorisés par le tableau, à un commit précis.

## 3. Comment chaque dépôt est construit (lu)

### Kaneo : gestion de projets (MIT)

**Ce que c'est.** Des tableaux, une liste, un calendrier, un Gantt, un backlog, du suivi du temps, des sous-tâches et des dépendances, des champs personnalisés, des notifications, des webhooks, un CLI et un serveur MCP.

**Pile.**
- `apps/api` : Hono, Drizzle, Postgres et `ioredis`, avec `better-auth` pour l'authentification.
- `apps/web` : React 19, TanStack Router et Query, `@dnd-kit` (que WaCopilote emploie déjà), Tiptap 3.32, zustand.

**Données** (`apps/api/src/database/schema.ts`) :

| Table | Champs |
|---|---|
| `project` | `slug`, `name`, `lastTaskNumber`, `position`, `archivedAt`… |
| `column` | `name`, `position`, `color`, `isFinal` |
| `task` | `number`, `title`, `description`, `status`, `columnId`, `priority`, `startDate`, `dueDate`, `recurrence` (JSON), `position` |
| `time_entry` | `startTime`, `endTime`, `duration` |
| `task_relation` | `sourceTaskId`, `targetTaskId`, `relationType` |

S'y ajoutent `label`, `activity`, `notification` et `workflow_rule`.

**Gantt.** Il n'emploie **aucune bibliothèque de Gantt** :
- `components/gantt/` tient en 6 fichiers et 57 Ko de source, tests compris ;
- la logique pure est isolée dans `timeline.ts` ;
- la page n'importe que `date-fns`, `lucide-react`, React, i18next et le routeur.

**MCP** (`packages/mcp`). Il expose 42 outils, relevés par recherche de motif dans `src/` : `list_tasks`, `create_task`, `move_task`, `update_task_status`, `create_time_entry`, `create_task_relation`…

**Pour nous** : c'est le meilleur candidat pour faire grandir les Tâches. Le modèle est simple, il se transpose en SQLite, et le Gantt est léger.

### Plane : gestion de projets complète (AGPL-3.0)

**Pile.**
- `apps/api` : Django et Postgres.
- `apps/web` : React et MobX.
- `apps/live` : Hocuspocus et Redis, pour le temps réel.
- `packages/editor` : Tiptap 3.31, Yjs et `y-indexeddb`.

**Données** (`apps/api/plane/db/models/`) :
- `Issue` : `state`, `priority`, `start_date`/`target_date`, `estimate_point`, `parent`, `labels`, `assignees`, `sort_order`, `archived_at`, `is_draft`, ainsi que les relations `IssueBlocker` et `IssueRelation` ;
- `State`, avec `group` et `is_triage` ;
- `Cycle` (des sprints, avec `progress_snapshot`) et `Module` ;
- `IssueView` (des vues enregistrées, dont les filtres sont en JSON) ;
- `Estimate`/`EstimatePoint`, `Intake` (le triage des demandes entrantes), et `Page` avec ses versions.

**Pour nous** : des **concepts** à reprendre, pas du code :
- les cycles ;
- les modules ;
- les vues enregistrées ;
- les estimations ;
- **Intake**, à transposer en « demandes entrantes depuis WhatsApp ».

L'infrastructure (Postgres, Redis, serveur temps réel) est hors de question pour une application de bureau.

### Docmost : wiki collaboratif (AGPL-3.0, hors `ee`)

**Pile.**
- `apps/server` : NestJS (Fastify), Kysely, Postgres, Redis, BullMQ et socket.io, avec un module `collaboration` en Yjs.
- `apps/client` : React 19, Mantine 9, TanStack Query et jotai.
- Tiptap 3.35.

**Données** (`apps/server/src/database/migrations/`) :
- `spaces` et `space_members` ;
- `pages` : un arbre par `parent_page_id`, avec `content`, `ydoc` et `tsv` pour la recherche ;
- `page_history`, `comments` (une sélection, une résolution), `labels`, `templates` ;
- des **bases**, c'est-à-dire des bases de données dans une page : `base_properties`, `base_rows`, `base_views`.

**`packages/editor-ext`.** Une quarantaine d'extensions Tiptap 3 (51 entrées dans `src/lib`, utilitaires compris) :
- callout, details, columns, tabs ;
- math, mention, table, footnotes ;
- transclusion, search-and-replace, markdown ;
- drawio, excalidraw…

Une extension (`callout`) n'importe que `@tiptap/core`, `@tiptap/pm` et `@tiptap/react`.

**Pour nous** : le modèle de référence d'un wiki, et des extensions d'éditeur réutilisables sous la même licence.

### AFFiNE : documents et tableau blanc (MIT hors backend)

**Pile.**
- BlockSuite, un cadre d'éditeur maison, qui n'est pas Tiptap : `blocksuite/framework` contient `std`, `store` et `sync`, sur Yjs.
- Des dizaines de blocs (`affine-block-*`), des éléments graphiques pour le mode tableau blanc (`affine-gfx-*` : mindmap, formes, connecteurs) et un bloc base de données.
- Le frontend est en React avec jotai, et une application Electron.
- Le dépôt pèse 457 Mo.

**Pour nous** : une référence pour une base de données dans un document et pour un canevas. C'est trop lourd et trop éloigné de notre pile pour être intégré.

### Alexandrie : base de connaissances markdown (MIT)

**Pile.**
- Le backend est en Go (`controllers/nodes`, `permissions`, `backup`).
- Le frontend est en Nuxt 4 et Vue 3, avec CodeMirror 6 pour l'éditeur.
- Le rendu passe par `markdown-it` (avec `anchor`, `container`, `emoji`, `highlight` et `mark`) et Mermaid.
- C'est une PWA hors ligne (`sw.ts`).

**Données** (`backend/models/node.model.go`). Une **seule table d'arbre** `Node` : `ParentId`, `Role`, `Content`, `ContentCompiled`, `Access` et `Order`. S'y ajoute `Permission`, qui règle l'accès nœud par nœud sur cinq niveaux.

**Pour nous** : le modèle « un seul arbre de nœuds, avec un contenu compilé mis en cache », et la sauvegarde et la restauration. Le code Vue n'est pas réutilisable.

### vibe-kanban : tableau qui pilote des agents de code (Apache-2.0, en fin de vie)

**Pile.**
- Un serveur en Rust (`crates/server`), avec SQLite et des migrations SQL (`crates/db`).
- React 18, Lexical, `@dnd-kit`, et une application Tauri.

**Exécuteurs** (`crates/executors`). Plus de 10 agents en ligne de commande : `claude`, `codex`, `gemini`, `cursor`, `copilot`, `opencode`, `qwen`…

**Données.** `projects`, puis `tasks(status)`, puis `task_attempts`, devenus par la suite `workspaces` et `sessions`. Il a aussi un serveur MCP (`crates/mcp/src/task_server`).

**Pour nous** : l'idée « une tâche, confiée à un agent CLI local, avec le journal de son exécution ». Elle se réimplémente en Node avec nos agents en liste fermée. Aucune dépendance, puisque le projet s'arrête.

### EverRoom : espace de contexte local pour agents (Apache-2.0)

**Pile.** C'est l'architecture la plus proche de la nôtre.
- `apps/desktop` est en Electron (`main`, `preload`, `renderer`), avec `better-sqlite3`, Tiptap 3 et CodeMirror.
- `apps/gateway` est un service local en Fastify, avec Drizzle, SQLite et Yjs.

**Modules de la passerelle.** `context-rooms`, `memory`, `documents`, `knowledge`, `agent-scheduler`, `diary`, `writing-style`, `notifications`, des connecteurs (Feishu, Slack, Notion, Gmail), `asr`, `ingest`.

**Données** (`apps/gateway/src/infrastructure/database/schema.ts`) :
- `context_rooms` et `agent_sessions` (`roomId`…) ;
- `connector_records`, `connector_emails`, `connector_calendar_events` et `connector_todos` ;
- `audit_logs` ;
- `external_call_policies` et `external_call_usage` : des quotas d'appels par service.

**Pour nous** :
- **la « salle de contexte »**, appliquée à un client WhatsApp : ses conversations, ses devis, ses décisions, ses tâches et sa mémoire, au même endroit, avec un agent limité à ce contexte ;
- les **quotas d'appels externes**, qui répondent au coût des API.

Les schémas annoncés comme instables invitent à reprendre les idées, pas les tables.

### Novel : éditeur à la Notion (Apache-2.0, plus entretenu)

**Pile.** Un éditeur « headless » sur **Tiptap 2.11**, avec commande `/`, menu flottant, poignée de glisser-déposer et complétion par IA.

**Pour nous** : ses **gestes d'interface** sont à refaire sur Tiptap 3. On ne doit pas en dépendre : il est 2,7 fois plus lourd que Tiptap 3 (§4), repose sur Tiptap 2 et n'est plus entretenu.

## 4. Poids des bibliothèques candidates (mesuré le 28/11)

Les bibliothèques sont compilées avec esbuild : minifiées, en ESM, avec découpage des imports dynamiques. React reste externe, puisque l'application l'embarque déjà. Le total compressé (gzip) est donné entre parenthèses.

| Bibliothèque (version) | À l'ouverture | Total, chargé à la demande compris |
|---|---|---|
| **WaCopilote aujourd'hui** (31 fichiers JS) | — | **1 520 Ko (472)** |
| Tiptap 3.34 (`react` et `starter-kit`) | 403 Ko (128) | 403 Ko (128) |
| Tiptap 3.34 avec l'extension markdown | 467 Ko (148) | 467 Ko (148) |
| Novel 1.0.2 (Tiptap 2) | 1 090 Ko (347) | 1 090 Ko (347) |
| Lexical 0.36 (texte riche, listes, markdown) | 323 Ko (106) | 323 Ko (106) |
| CodeMirror 6 (markdown) | 489 Ko (170) | 489 Ko (170) |
| Yjs 13.6 | 91 Ko (28) | 91 Ko (28) |
| Mermaid 11.17 | 1 386 Ko (439) | 3 360 Ko (972) |
| Excalidraw 0.18 | 3 707 Ko (1 092) | 8 006 Ko (2 532) |
| date-fns 4.4 (les fonctions d'un Gantt) | 20 Ko (6) | 20 Ko (6) |
| markdown-it 14.3 | 146 Ko (52) | 146 Ko (52) |

**Ce qu'on en tire.**
- **Un seul éditeur riche : Tiptap 3.** Lexical est plus léger d'environ 20 % (17 % compressé). Mais Tiptap est l'éditeur de Docmost, Plane, Kaneo et EverRoom, tous en version 3, et leurs extensions sont réutilisables. Charger Lexical, CodeMirror ou Novel en plus coûterait deux fois.
- **Le Gantt de Kaneo ne coûte presque rien** : 6 Ko compressés de `date-fns`, plus son propre code.
- **Mermaid et Excalidraw sont lourds.** Excalidraw pèse à lui seul plus de cinq fois tout le JavaScript actuel. Ils ne peuvent être que des fonctions optionnelles, chargées quand on les ouvre, et affichées « lourdes » dans le Marketplace.
- **Yjs (temps réel collaboratif) n'a pas lieu d'être** tant que l'application fonctionne sur un seul poste.

Dans une application Electron, ce poids ne se télécharge pas : il se paie en temps d'analyse et de compilation au chargement, en mémoire, et en taille de l'installeur.

**À noter au passage** (mesuré) : `dist/assets/WaCopilot Logo.svg` pèse 1,4 Mo, et `.png` 830 Ko. C'est plus que tout le code de l'interface.

## 5. Règles de poids et de vitesse pour toute fonctionnalité

1. **Chargement à la demande.**
   - **Pages** : chaque page de fonctionnalité passe par `React.lazy`, comme les pages actuelles (`App.jsx`).
   - **Blocs lourds** : dans une page, un bloc lourd (diagramme, tableau blanc) passe par un `import()` au moment où il s'affiche, pas à l'ouverture de la page.
2. **Une fonctionnalité éteinte ne coûte rien.**
   - **Interface** : son morceau de code n'est jamais chargé.
   - **Backend** : son routeur n'est requis (`require`) que si elle est active.
   - **Tâches de fond** : aucune ne tourne.
3. **Un seul éditeur (Tiptap 3)**, dans un morceau de code partagé par toutes les fonctionnalités qui en ont besoin.
4. **Aucun nouveau serveur** : ni Postgres, ni Redis, ni BullMQ, ni Hocuspocus. On reste sur la base SQLite existante, avec des migrations à partir de la v13, et les tâches de fond tournent dans le processus. Pour la recherche plein texte, **FTS5** de SQLite remplace le `tsvector` de Postgres.
5. **Pas de Yjs ni de temps réel** tant que l'application reste sur un seul poste.
6. **Budget de poids vérifié par la CI.** Un script lit le manifeste de Vite et échoue si une fonctionnalité dépasse son budget :
   - 150 Ko compressés à l'ouverture de sa page, sans compter le morceau Tiptap partagé ;
   - le poids réel affiché dans le Marketplace pour les fonctionnalités marquées « lourdes ».
7. **Pas de régression au démarrage.** Chaque PR mesure le temps entre le lancement et la première réponse de l'API (`/api/settings`) et l'affichage du tableau de bord, avant et après, sur l'application construite.

## 6. Fonctionnalités proposées pour le Marketplace

Elles s'ajoutent au catalogue v1 de l'issue #30.

| # | Fonctionnalité | D'après | Contenu | Données (SQLite) | Poids et risque |
|---|---|---|---|---|---|
| **A** | **Projets et Tâches**, évolution de `taches` | Kaneo ; concepts de Plane | Tableau (existant, `@dnd-kit`), liste, calendrier, **Gantt** (port de `timeline.ts`), sous-tâches et relations, étiquettes, échéances, récurrence, temps passé. Outils MCP et commandes CLI calqués sur les 42 de Kaneo. **Création d'une tâche depuis un message ou une commande WhatsApp**, à la manière de l'*Intake* de Plane | `project`, `column`, `task`, `task_relation`, `time_entry`, `label`. Les tâches quittent IndexedDB (le store zustand) pour SQLite : c'est indispensable pour les rendre accessibles au MCP et au CLI | Léger : `date-fns` pèse 6 Ko compressés |
| **B** | **Base de connaissances (wiki)** | Docmost ; Alexandrie | Espaces, pages en arbre, historique, commentaires, étiquettes, modèles, recherche FTS5. S'appuie sur les documents existants (`ai_documents`, `MyDocuments`) | `spaces`, `pages` (`parent_id`), `page_history`, `comments`, `labels`, `templates` | Tiptap partagé (128 Ko compressés), et extensions Docmost reprises au cas par cas |
| **C** | **Socle d'éditeur Tiptap 3** : un socle, pas une entrée du Marketplace | Docmost, Kaneo, Novel (les gestes) | Rédaction (`AiWriter`) passe de `contentEditable` à Tiptap. **Doivent être conservés** : les 6 réécritures, la copie au format WhatsApp, l'annulation d'une génération et la sonde de rédaction (21/21) | — | 128 Ko compressés, chargés seulement avec les pages qui éditent |
| **D** | **Bases de données dans une page** | Docmost (bases), AFFiNE (bloc base de données) | Propriétés typées, lignes, vues | `base_properties`, `base_rows`, `base_views` | Moyen |
| **E** | **Diagrammes** (Mermaid), optionnel | Alexandrie, Docmost | Bloc de diagramme dans une page | — | **Lourd** : 439 Ko compressés à l'affichage du bloc, 972 Ko au total |
| **F** | **Tableau blanc** (Excalidraw), optionnel | Docmost, AFFiNE | Dessin libre dans une page | — | **Très lourd** : 1 092 Ko compressés, 2,5 Mo au total. À faire en dernier, voire jamais |
| **G** | **Salles de contexte client** | EverRoom | Par client ou contact WhatsApp : conversations, devis, documents, décisions, tâches et mémoire, avec un agent limité à cette salle | `context_rooms`, et des liens vers les objets existants | Léger, risque `acces-externe` si l'agent est externe |
| **H** | **Tâche confiée à un agent CLI local** | vibe-kanban | Exécution d'une tâche par Claude Code ou Gemini CLI (liste fermée de la v1.51.1), avec son journal | `task_runs` | Dépend de `agents-cli-locaux`. Risque `execution-locale` |

## 7. Comment intégrer une fonctionnalité (méthode)

1. **Repérage.** Lire, au commit noté au §10, les fichiers sources cités pour la fonctionnalité. Noter ce qui est lu, et mesurer ce qui doit l'être (poids, temps).
2. **Données.** Écrire la migration SQLite, un service backend et son routeur (sur le modèle de `invoiceService` ou de `documents`), puis les outils MCP et les commandes CLI. C'est ce qui permet le contrôle sur les cinq voies de l'issue #30.
3. **Interface.**
   - une page en `React.lazy` ;
   - les blocs lourds en `import()` ;
   - textes en français et en anglais ;
   - Tailwind 3, `lucide-react` et zustand, nos outils actuels. Kaneo emploie Tailwind 4 et TanStack Router : il faut adapter.
4. **Catalogue.** Une entrée dans `features/catalogue.json`, avec ses surfaces, ses dépendances, ses risques et son poids.
5. **Preuves.**
   - des tests qui échouent sans le code qu'ils protègent ;
   - le budget de poids vérifié par la CI ;
   - le temps de démarrage mesuré avant et après ;
   - une sonde sur l'application construite, avec un profil jetable.
6. **Code repris.** Uniquement depuis les chemins autorisés au §2, à un commit précis, avec l'en-tête d'attribution et la ligne dans `THIRD_PARTY_NOTICES.md`.

## 8. Ordre proposé

1. **Le squelette du Marketplace** : les PR 1 à 6 de l'issue #30. Sans lui, aucune fonctionnalité ne peut être éteinte.
2. **A, Projets et Tâches** : la plus utile, la plus légère, et la seule qui a déjà une page.
3. **C, le socle Tiptap**, puis **B, la base de connaissances**.
4. **G, les salles de contexte client**, puis **H, les agents CLI**.
5. **D, les bases de données dans une page**, puis **E, les diagrammes**.
6. **F, le tableau blanc**, seulement si le besoin justifie 2,5 Mo.

La suppression de la Boîte à outils (§1) se fait à part, après #22.

## 9. Ce qui n'est pas vérifié

- Le poids a été mesuré avec esbuild, pas dans le build Vite de WaCopilote. L'ordre de grandeur est fiable, mais le chiffre exact sera celui du budget de la CI.
- EverRoom n'a pas été essayé sous Windows. Ses schémas sont annoncés comme instables.
- Les performances du Gantt de Kaneo avec plusieurs centaines de tâches ne sont pas mesurées.
- Pour Plane, je n'ai pas trouvé le dossier des extensions d'éditeur au chemin `packages/editor/src/core/extensions`, ni vérifié toute l'infrastructure de déploiement.
- Pour vibe-kanban, je n'ai pas lu l'annonce d'arrêt, seulement la mention du README.

## 10. Sources (lues le 28/11/2026)

| Dépôt | Commit lu | Fichiers principaux |
|---|---|---|
| [usekaneo/kaneo](https://github.com/usekaneo/kaneo) | `f1a8a6897d` (28/11) | `apps/api/src/database/schema.ts`, `apps/web/src/components/gantt/`, `packages/mcp/src/` |
| [makeplane/plane](https://github.com/makeplane/plane) | `723bb178f9` (24/11, branche `preview`) | `apps/api/plane/db/models/*.py`, `apps/live`, `packages/editor/package.json` |
| [docmost/docmost](https://github.com/docmost/docmost) | `b8df9d0824` (28/11) | `apps/server/src/database/migrations/`, `packages/editor-ext/src/lib/`, README (licence `ee`) |
| [toeverything/AFFiNE](https://github.com/toeverything/AFFiNE) | `90d093f418` (28/11, branche `canary`) | `LICENSE`, `packages/backend/server/LICENSE`, `blocksuite/affine/all/package.json` |
| [smaug6739/alexandrie](https://github.com/smaug6739/alexandrie) | `33e4bb2dcb` (08/11) | `backend/models/*.go`, `frontend/package.json`, `frontend/app/helpers/` |
| [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban) | `59e0fd067c` (28/11) | README (fin de vie), `crates/db/migrations/`, `crates/executors/src/executors/` |
| [NxcoreAI/EverRoom](https://github.com/NxcoreAI/EverRoom) | `b0d58e5e8d` (20/09) | `LICENSE`, `apps/gateway/src/infrastructure/database/schema.ts`, `apps/desktop/package.json`, `apps/gateway/src/modules/` |
| [steven-tey/novel](https://github.com/steven-tey/novel) | `fa95098e66` (18/01/2025) | `packages/headless/package.json`, README |
