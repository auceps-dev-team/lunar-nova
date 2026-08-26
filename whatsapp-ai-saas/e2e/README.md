# Tests E2E (P2-4)

Ces tests de bout en bout exercent l'application packagée (Electron + webviews
WhatsApp) via **Playwright**, dans un environnement disposant d'un affichage
(`xvfb` sous Linux / CI) et des binaires Chromium installés.

## Pourquoi ce dossier est séparé de `vitest run`

- `vitest run` cible les tests unitaires (`backend/__tests__`, `src/__tests__`).
  Les specs ici sont nommées `*.playwright.js` **et ne sont donc pas ramassées**
  par Vitest (qui ne matche que `*.test.*` / `*.spec.js`).
- Ils nécessitent un affichage et les binaires Playwright, indisponibles sur
  certaines machines de dev et dans le bac à sable de CI léger.

## Prérequis

```bash
# Installe les binaires Chromium (nécessite un accès réseau aux CDN Playwright)
npx playwright install --with-deps chromium
# Sous Linux sans session graphique :
sudo apt-get install -y xvfb
```

## Exécution

```bash
xvfb-run -a npx playwright test
```

## Intégration CI

Le job correspondant doit s'ajouter au workflow `.github/workflows/ci.yml`
(déjà présent) sous la forme :

```yaml
  e2e:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: xvfb-run -a npx playwright test
```

> À activer une fois le runner CI capable de télécharger les binaires Playwright
> (constraint de réseau / TLS connue sur certains environnements).
