# Contribuer à WaCopilote

Merci de l'intérêt que vous portez au projet. Ce guide décrit comment mettre en
route l'environnement, ce qui est le plus utile à faire, et les conventions du
dépôt.

Les échanges se font en français ou en anglais, au choix.

---

## Mettre en route

### Prérequis

- **Node.js 20+** et **npm 9+**
- **Redis** sur le port 6379 (cache et limitation de débit)
- Un navigateur Chromium, installé automatiquement par Playwright

### Installation

Le dépôt contient l'application dans un sous-dossier — attention au `cd`, c'est
l'erreur la plus fréquente :

```bash
git clone https://github.com/auceps-dev-team/lunar-nova.git
cd lunar-nova/whatsapp-ai-saas

npm install
cd backend && npm install && cd ..

cp backend/.env.example backend/.env
docker run -d -p 6379:6379 --name wacopilote-redis redis:alpine

npm run start:all
```

Aucune clé d'API n'est nécessaire pour démarrer. Elles se saisissent dans les
Réglages de l'application une fois lancée.

### Commandes

| Commande | Effet |
| --- | --- |
| `npm run start:all` | Backend + Vite + Electron, la commande du quotidien |
| `npm run dev` | Frontend seul (Vite) |
| `npm run start:backend` | Backend Express seul |
| `npm test` | Suite Vitest |
| `npm run lint` | ESLint 9 |
| `npm run build` | Bundle de production |

---

## Comprendre l'architecture en cinq minutes

Trois processus cohabitent, et savoir lequel vous modifiez évite beaucoup de
confusion :

1. **Le renderer** (`src/`) — React 19 dans une fenêtre Electron. Environnement
   navigateur : pas de `require`, pas d'accès au système de fichiers.
2. **Le processus principal Electron** (`electron/`) — CommonJS, accès système.
   Il lance le backend en production, gère les fenêtres et la clé maître.
3. **Le backend Express** (`backend/`) — CommonJS, écoute sur `127.0.0.1:3000`.
   Il parle aux fournisseurs d'IA, à SQLite et pilote WhatsApp Web.

Un quatrième environnement, moins évident : le code passé à `page.evaluate()`
dans `backend/orderListener.js`, `backend/routes/wa.js` et
`backend/scrapers/` s'exécute **dans la page WhatsApp**, pas dans Node. Il n'a
accès ni à `require`, ni aux variables du fichier qui l'entoure. La
configuration ESLint distingue ces quatre cas.

Le backend exige un **token d'authentification** sur toutes ses routes. Il est
généré au premier lancement dans le fichier `api-token` et transmis au renderer
par IPC. Si vous testez l'API à la main :

```bash
curl -H "Authorization: Bearer $(cat api-token)" http://127.0.0.1:3000/api/settings
```

---

## Par où commencer

Le projet vient d'un développement produit interne et en porte les traces. Les
contributions les plus utiles, dans l'ordre :

1. **Des tests.** La couverture est faible. Les zones qui cassent réellement en
   production sont les parseurs de scraping, les adaptateurs LLM et les
   migrations de schéma. Extraire la logique de parsing hors de `page.evaluate()`
   pour la rendre testable est en soi une excellente contribution.
2. **Les avertissements `react-hooks/exhaustive-deps`.** Il en reste une
   vingtaine. Ils demandent un examen au cas par cas : ajouter mécaniquement les
   dépendances manquantes provoque des boucles de rendu.
3. **Le découpage des grosses pages.** Plusieurs dépassent 800 lignes.

Les issues étiquetées `good first issue` correspondent aux deux premiers points.

---

## Conventions

### Code

Suivez le style du fichier que vous modifiez plutôt qu'un style personnel. Le
projet est en **JavaScript**, pas en TypeScript : il n'y a pas de vérification
de types à lancer.

Faites passer `npm run lint` et `npm test` avant de proposer une modification.

Les commentaires expliquent **pourquoi**, pas **quoi**. Un commentaire qui
paraphrase la ligne suivante sera signalé en revue ; un commentaire qui explique
qu'une garde existe parce que WhatsApp régénère ses classes CSS à chaque refonte
vaut de l'or.

### Messages de commit

Le dépôt suit ce format :

```
WaCopilote vX.Y.Z - type: description courte

Corps expliquant le problème résolu et pourquoi cette solution.
```

Les types utilisés : `feat`, `fix`, `security`, `chore`, `docs`.

### Versionnage

La version est portée **dans les deux `package.json`** (racine et `backend/`) et
dans les badges du README :

- **Modification majeure** — nouvelle fonctionnalité, changement de contrat :
  `+0.1.0`
- **Modification importante** — correctif notable, changement de comportement :
  `+0.0.1`
- **Autre** — documentation, commentaires, formatage : pas de changement

Dans une pull request, ne modifiez pas la version : la personne qui fusionne s'en
charge, ce qui évite les conflits.

### Pull requests

Une PR = un sujet. Décrivez le problème résolu avant la solution. Si le
comportement visible change, dites-le explicitement.

---

## Sécurité

**N'ouvrez pas d'issue publique pour une faille.** La procédure est décrite dans
[SECURITY.md](SECURITY.md).

Deux points de vigilance propres à ce projet, à garder en tête en contribuant :

- **N'augmentez pas la surface d'automatisation de WhatsApp Web sans y réfléchir.**
  Faire saisir du texte par l'automatisation dans les champs de WhatsApp est
  précisément ce qui déclenche les restrictions de compte. Les délais « humains »
  disséminés dans le code ne sont pas décoratifs.
- **Les données de prospection sont des données personnelles.** Ne commitez
  jamais de dump de page scrapée, même à titre de fixture, sans l'avoir vidé de
  toute coordonnée réelle.

- **Exception documentée (P2-5 / N5) :** `backend/goafrica-tg-annuaire.html`
  (≈116 Ko) est un instantané hors-ligne d'une page d'annuaire GoAfrica Online
  (Togo), utilisé uniquement par `backend/scripts/fetchGoAfricaStructure.js` pour
  dériver la structure des catégories sans accès réseau. Il est intentionnellement
  suivi car il ne contient que la structure des liens — aucune coordonnée réelle
  (0 `tel:` / 0 `email` vérifié à l'audit). Ne pas le confondre avec un dump de
  prospects : ne commitez jamais de dump contenant de vraies coordonnées.

---

## Licence et droits

WaCopilote est distribué sous **AGPL-3.0**. En contribuant, vous acceptez que
votre contribution soit distribuée sous cette licence.

Le projet proposant par ailleurs une licence commerciale, un accord de
contribution (CLA) sera mis en place pour les contributions substantielles. Il
n'est pas encore rédigé ; il sera annoncé dans les issues avant d'être appliqué.
Les contributions acceptées d'ici là ne seront pas concernées rétroactivement
sans votre accord.
