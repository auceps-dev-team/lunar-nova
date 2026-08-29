# Tests E2E — WaCopilote (P2-4)

Smoke tests Playwright pilotant la **vraie application Electron** (renderer
buildé + backend forké), pas un navigateur isolé : ils couvrent le démarrage
complet `Electron → main.cjs → backend Express` tel que vécu par l'utilisateur.

## Exécuter en local

Prérequis :

1. Dépendances **avec scripts postinstall** (télécharge le binaire Electron) :
   ```bash
   npm install          # PAS --ignore-scripts
   ```
2. Renderer de production :
   ```bash
   npm run build
   ```
3. Lancer :
   ```bash
   npm run test:e2e
   ```
   Sous Linux sans affichage (CI, conteneur) :
   ```bash
   xvfb-run -a npm run test:e2e
   ```

Le backend forké requiert le binding natif `sqlite3` (prébuilds Linux/macOS/
Windows via `npm install` standard).

## Ce que couvre le smoke actuel

- démarrage de l'application et montage du renderer React ;
- navigation interne (HashRouter) vers la page Réglages ;
- présence des cinq champs de clé API (`type="password"`, indépendant de la
  langue) ;
- résistance du couple Electron ↔ backend (pas d'arrêt brutal).

Les sélecteurs sont volontairement indépendants de la locale (fr/en/es/ar) —
toute extension des tests devrait préserver cette propriété, ou forcer
explicitement la langue du profil de test.

## Branchement CI (prêt, v1.48.1 — publication manuelle requise)

Le job **`e2e-smoke`** (ubuntu-latest, `xvfb-run -a npm run test:e2e`,
dépendant du job de build) est préparé : la modification de
`.github/workflows/ci.yml` est prête dans la copie de travail du dépôt et le
workflow final intégral est fourni dans `e2e/ci-snippet.yml`. Le jeton GitHub
App utilisé pour les contributions automatisées n'a pas la permission
`workflows` (constat H2) : la publication du workflow doit être faite par un
membre de l'équipe éditrice (copier `e2e/ci-snippet.yml` vers
`.github/workflows/ci.yml`).

## Étendre

- Ajouter les specs dans `e2e/*.spec.js` (un fichier par parcours).
- Pour les webviews WhatsApp : `page.locator('webview')` après le branchement
  d'une instance — le DOM de WhatsApp Web reste fragile par nature (sélecteurs
  Meta), cf. SECURITY.md ; privilégier des assertions d'état applicatif.
