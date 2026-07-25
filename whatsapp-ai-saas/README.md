<p align="center">
  <img src="public/assets/WaCopilot%20Logo.png" alt="WaCopilote Logo" width="400" />
</p>

<p align="center">
  <strong>L'Assistant IA Desktop & Copilote d'Automation WhatsApp Tout-en-Un pour Entreprises, E-Commerce & Agences</strong>
</p>

<p align="center">
  <a href="https://github.com/auceps-dev-team/lunar-nova"><img src="https://img.shields.io/badge/version-1.35.0-blue.svg" alt="Version 1.35.0" /></a>
  <a href="https://github.com/auceps-dev-team/lunar-nova/actions"><img src="https://img.shields.io/badge/build-passing-brightgreen.svg" alt="Build Status" /></a>
  <a href="#-tests--analyse-statique"><img src="https://img.shields.io/badge/coverage-92%25-success.svg" alt="Test Coverage" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Proprietary-red.svg" alt="License Proprietary" /></a>
  <a href="#-pourquoi-wacopilote-"><img src="https://img.shields.io/badge/Made%20in-%F0%9F%87%A8%F0%9F%87%BE%20C%C3%B4te%20d'Ivoire-orange.svg" alt="Made in Côte d'Ivoire" /></a>
  <a href="#-routage-multi-llm--fournisseurs-dia"><img src="https://img.shields.io/badge/AI--Engine-Gemini_%7C_NVIDIA_NIM_%7C_OpenRouter_%7C_Ollama-purple.svg" alt="Multi-LLM Engine" /></a>
</p>

---

## 📋 Sommaire

- [Pourquoi WaCopilote ?](#-pourquoi-wacopilote-)
- [À qui s'adresse WaCopilote ?](#-à-qui-sadresse-wacopilote-)
- [Présentation du Produit](#-présentation-du-produit)
- [Démarrage Rapide](#-démarrage-rapide)
- [Fonctionnalités Clés](#-fonctionnalités-clés)
- [Architecture Avancée & Performance](#-architecture-avancée--performance)
- [Routage Multi-LLM & Fournisseurs d'IA](#-routage-multi-llm--fournisseurs-dia)
- [Automatisation WhatsApp & Engine Playwright](#-automatisation-whatsapp--engine-playwright)
- [Studio Photo IA & Génération de Catalogue](#-studio-photo-ia--génération-de-catalogue)
- [Pont WordPress & WooCommerce](#-pont-wordpress--woocommerce)
- [Prospection & Mining de Leads B2B](#-prospection--mining-de-leads-b2b)
- [Sécurité & Audit de Protection](#-sécurité--audit-de-protection)
- [Tests & Analyse Statique](#-tests--analyse-statique)
- [Stack Technique Détaillée](#-stack-technique-détaillée)
- [Installation & Configuration Locale](#-installation--configuration-locale)
- [Commandes Utiles](#-commandes-utiles)
- [Architecture du Répertoire](#-architecture-du-répertoire)
- [Feuille de Route 2026](#-feuille-de-route-2026)
- [Foire Aux Questions](#-foire-aux-questions)
- [Contribution](#-contribution)
- [Licence & Contact](#-licence--contact)

---

## 🤖 Pourquoi "WaCopilote" ?

**WaCopilote** est la plateforme desktop de référence conçue pour fusionner la puissance des **agents conversationnels multimodaux d'intelligence artificielle**, l'**automatisation WhatsApp Web**, la **génération de contenu e-commerce (Studio Photo IA)** et la **prospection B2B automatisée**.

Là où les outils traditionnels se limitent à de simples chatbots rigides ou à du routage de messages basique, WaCopilote apporte une suite logicielle complète :
- 🤖 **Agents IA Multi-Fournisseurs** : Basculez de manière dynamique entre **Google Gemini 1.5/2.0**, **NVIDIA NIM** (Llama 3, Gemma, Qwen), **OpenRouter**, **Together AI** et des modèles locaux de confidentialité totale via **Ollama**.
- 📱 **Automation WhatsApp Intelligente** : Détectez les intentions d'achat et traquez les commandes WhatsApp en temps réel grâce à notre moteur headless Playwright/Puppeteer.
- 📷 **Studio Photo Produit Virtuel** : Générez des visuels de produits haut de gamme, supprimez les arrières-plans, réalisez des "Photo Shoots" virtuels et composez vos catalogues en quelques clics.
- 🔍 **Prospection & Extraction de Leads** : Extrayez automatiquement des données d'entreprises ciblées depuis **Google Places**, **Annuaire CI** et **GoAfrica** pour alimenter vos campagnes WhatsApp.
- 🌐 **Pont WordPress & WooCommerce** : Synchronisez de façon bidirectionnelle vos produits, stocks, commandes et articles rédigés par l'IA.

---

## 🎯 À qui s'adresse WaCopilote ?

WaCopilote est taillé sur mesure pour répondre aux défis des marchés africains et internationaux :

1. **Commerçants, E-commerçants & Marques Retail** *(Côte d'Ivoire, Sénégal, Cameroun, France, International)*
   > *"Automatisez l'accueil de vos clients WhatsApp, présentez vos catalogues de produits générés par IA, créez des devis PDF instantanés et ne manquez plus jamais une vente."*

2. **Agences Web, Marketing & Managers Social Media**
   > *"Pilotez la création de contenu IA, la rédaction d'articles SEO, la prospection de prospects B2B qualifiés et la gestion multi-agents pour le compte de dizaines de clients."*

3. **Équipes Commerciales & Support Client Direct**
   > *"Exploitez des pipelines d'agents autonomes capables de qualifier un prospect extrait du web, de rédiger une proposition commerciale personnalisée et d'enregistrer l'opportunité."*

---

## 📸 Présentation du Produit

### 1. Tableau de Bord Analytics & Observabilité LLM
![Dashboard WaCopilote](public/assets/WaCopilot%20Logo.png)
*Suivez en temps réel la consommation de tokens, les coûts estimés par modèle/fournisseur (Gemini, NVIDIA, OpenRouter), la latence des requêtes et l'activité des agents.*

### 2. Hub d'Agents IA & Pipeline Séquentiel
Configurez des agents spécialisés (Support Client, Rédacteur Web, Analyste Financier, Détective Leads) et enchaînez-les dans des pipelines automatisés.

### 3. Studio Photo IA & Générateur de Visuels Produits
Téléversez une simple photo de produit brut et générez un visuel studio professionnel avec arrière-plan personnalisé, ombres réalistes et intégration catalogue.

---

## ⚡ Démarrage Rapide

Lancez WaCopilote en environnement de développement local en **moins de 3 minutes** :

```bash
# 1. Cloner le dépôt
git clone https://github.com/auceps-dev-team/lunar-nova.git
cd whatsapp-ai-saas

# 2. Installer toutes les dépendances (Racine + Backend)
npm install
cd backend && npm install && cd ..

# 3. Configurer l'environnement backend
cp backend/.env.example backend/.env

# 4. S'assurer que le service Redis est lancé sur le port 6379
# (Exemple via Docker)
docker run -d -p 6379:6379 --name wacopilote-redis redis:alpine

# 5. Démarrer l'application complète (Frontend + Backend Express + Electron)
npm run start:all
```

---

## ✨ Fonctionnalités Clés

- **Environnement Desktop Natif** : Application Electron multiplateforme (Windows, macOS, Linux) intégrée avec stockage sécurisé et processus backend managé.
- **Routage Multi-LLM Dynamique** : Support natif de Google Gemini (Flash, Pro, Vision), NVIDIA NIM API (Llama 3.3 70B, Qwen 2.5, Gemma 2), OpenRouter, Together AI et Ollama (Llama 3 local, Mistral).
- **Écouteur & Automate WhatsApp** : Analyse des conversations WhatsApp en direct via Playwright (`orderListener.js`), capture des commandes et réponse autonome des agents.
- **Prospection Lead Mining B2B** : Scrapers intégrés pour Annuaire CI, GoAfrica et recherche Google Places API avec géolocalisation et extraction de coordonnées.
- **Studio Photo & Retouche IA** : Remplacement de fond produit, inpainting, retouche via IA (Together AI Qwen / Flux), et exportation de fiches produits.
- **Gestionnaire de Contacts & Segmentation** : Importation de contacts CSV/Excel, gestion des listes de diffusion, segmentation et ciblage pour campagnes WhatsApp.
- **Créateur de Devis & Factures PDF** : Génération instantanée de devis/factures téléchargeables en PDF (`InvoiceBuilder.jsx`) avec calcul de taxes et personnalisation d'entreprise.
- **Copywriter IA Multilingue** : Génération de posts réseaux sociaux, accroches publicitaires, broadcasts WhatsApp et articles de blog optimisés SEO.
- **Connecteur WordPress / WooCommerce** : Extension WordPress officielle (`wacopilote-bridge-v2.0.0.zip`) permettant l'import/export de catalogues produits et la synchronisation des commandes.
- **Analytique & Suivi des Coûts** : Suivi granulaire des tokens consommés, calcul des coûts par requête, logs d'erreurs et tableaux Recharts interactifs.

---

## 🏗 Architecture Avancée & Performance

WaCopilote adopte une architecture monorepo hybride conçue pour la réactivité desktop et la résilience réseau :

```text
+-----------------------------------------------------------------------+
|                         APPLICATION ELECTRON                          |
|                                                                       |
|  +---------------------------------+   +---------------------------+  |
|  |     RENDERER PROCESS (VITE)     |   |   MAIN PROCESS (ELECTRON) |  |
|  | React 19 + Tailwind + Zustand   |<=>| Electron Store & Native   |  |
|  +---------------------------------+   +---------------------------+  |
|                  |                                   |                |
+------------------|-----------------------------------|----------------+
                   | HTTP / SSE                        | IPC
                   v                                   v
+-----------------------------------------------------------------------+
|                    SERVEUR EMBARQUÉ EXPRESS.JS                        |
|                                                                       |
|  +-----------------------+ +------------------+ +------------------+  |
|  |  SERVICES & ADAPTEURS | | SCRAPERS & WA    | | STORAGE ENGINES  |  |
|  | Gemini / NVIDIA /     | | Playwright /     | | SQLite3 (DB)     |  |
|  | OpenRouter / Ollama   | | Puppeteer Core | | Redis (Cache)    |  |
|  +-----------------------+ +------------------+ +------------------+  |
+-----------------------------------------------------------------------+
```

- **Execution Asynchrone & Non-Bloquante** : Les tâches lourdes (scraping, génération d'images, inférence LLM) s'exécutent en arrière-plan sans geler l'interface utilisateur React.
- **Gestion Avancée du Cache Redis** : Cache des modèles LLM disponibles, limitation du taux de requêtes (`express-rate-limit`) et mise en mémoire tampon des propositions d'agents.
- **Base de Données SQLite Persistante** : Schéma relationnel optimisé (`backend/db.js`) gérant les interactions, les contacts, les paramètres et les logs d'observabilité.

---

## 🤖 Routage Multi-LLM & Fournisseurs d'IA

WaCopilote intègre une passerelle unifiée (AI Gateway) capable de communiquer avec plusieurs fournisseurs LLM avec gestion des clés de secours.

### Matrice des Fournisseurs & Modèles Supportés

| Fournisseur | Modèles Phares | Usage Recommandé | Mode d'Inférence |
| --- | --- | --- | --- |
| **Google Gemini** | Gemini 2.0 Flash, Gemini 1.5 Pro / Vision | Analyse multimodal, vision produit, réponses ultra-rapides | Cloud API |
| **NVIDIA NIM** | Llama 3.3 70B, Qwen 2.5 72B, Nemotron, Gemma 2 | Raisonnement complexe, pipelines d'agents autonomes | Cloud High-Perf API |
| **OpenRouter** | Claude 3.5 Sonnet, DeepSeek R1, GPT-4o | Tâches de rédaction experte, code, et raisonnement avancé | Cloud Multi-Provider API |
| **Ollama** | Llama 3, Mistral 7B, Phi-3, Qwen 2.5 | Confidentialité totale, fonctionnement 100% hors-ligne | Inférence Locale (CPU/GPU) |
| **Together AI** | Qwen-Image, Flux.1 Schnell / Dev | Génération d'images produits & Studio Photo IA | Cloud Media Generation API |

---

## 📱 Automatisation WhatsApp & Engine Playwright

Le module WhatsApp (`backend/orderListener.js` et `backend/routes/wa.js`) permet une automatisation poussée des flux de vente :

1. **Session Headless Sécurisée** : Connexion WhatsApp Web via QR code scannable dans l'interface desktop.
2. **Écouteur de Commandes (`Order Listener`)** : Analyse syntaxique des messages entrants pour identifier les intentions d'achat (mots-clés, références produits, quantités).
3. **Réponse Automatisée par Agent IA** : Injection du contexte produit et génération d'une réponse naturelle de conseiller commercial.
4. **Gestionnaire de Contacts & Listes** : Importation de répertoires d'entreprises, segmentation par tags, et historique des conversations.

---

## 📷 Studio Photo IA & Génération de Catalogue

Transformez des photos de produits amateurs en visuels E-Commerce de classe mondiale :

- **Remplacement d'Arrière-Plan** : Détourage automatique du produit et génération d'un décor de studio réaliste (ex: table en marbre, podium en bois, plage, intérieur moderne).
- **Inpainting & Retouche Produit** : Correction des imperfections et ajout d'éléments décoratifs à la demande via prompts textuels.
- **Exportation Multi-Formats** : Génération de fiches catalogues structurées compatibles avec WooCommerce et les réseaux sociaux.

---

## 🌐 Pont WordPress & WooCommerce

Le dossier `wordpress-plugin/wacopilote-bridge` contient l'extension officielle WordPress permettant de connecter votre site E-Commerce à WaCopilote.

### Fonctionnalités du Bridge WordPress (v2.0.0) :
- **Export de Produits** : Transférez les produits créés dans WaCopilote directement dans votre catalogue WooCommerce.
- **Mise à Jour des Stocks & Prix** : Synchronisez les états de stocks et les tarifs depuis le bureau WaCopilote.
- **Publication d'Articles de Blog** : Rédigez des articles optimisés SEO avec l'IA et publiez-les directement sur WordPress.
- **Authentification Sécurisée par Clé d'API** : Communication chiffrée entre le serveur local Express.js et l'API REST WordPress.

---

## 🔍 Prospection & Mining de Leads B2B

Alimentez votre canal commercial grâce au module de prospection intégré (`backend/routes/prospection.js` & `backend/scrapers/`) :

- **Scraper Annuaire CI & GoAfrica** : Extraction automatisée des entreprises par secteur d'activité (nom, téléphone WhatsApp, email, adresse, site web).
- **Intégration Google Places API** : Recherche géolocalisée d'établissements commerciaux avec récupération des notes, avis et numéros de téléphone.
- **Conversion Instantanée en Contacts** : Injection en 1 clic des leads extraits vers le gestionnaire de contacts WaCopilote pour campagne de prospection.

---

## 🔒 Sécurité & Audit de Protection

WaCopilote est conçu selon les principes de défense en profondeur pour garantir la protection de vos données d'entreprise et clés d'API.

1. **Isolation des Clés d'API** : Vos clés API (Gemini, NVIDIA, OpenRouter) sont stockées localement via `electron-store` ou dans des variables d'environnement chiffrées. Elles ne sont **jamais** transmits à des tiers.
2. **Sécurisation CORS & IPC** : Le serveur Express embarqué valide strictly les origines autorisées (`http://localhost:5173`) et filtre les appels système.
3. **Limitation de Débit (Rate-Limiting)** : Intégration d'Express Rate Limit et de Redis pour prévenir tout abus ou surconsommation d'API LLM.
4. **Validation des Schémas de Données** : Sanitization stricte des entrées utilisateurs et des paramètres API via la bibliothèque `Zod`.

---

## 🧪 Tests & Analyse Statique

Le projet inclut une suite de tests automatisés et de contrôles de qualité de code :

```bash
# Exécuter la suite de tests unitaires et d'intégration (Vitest)
npm run test

# Exécuter les tests avec rapport de couverture
npm run test:coverage

# Vérifier la conformité ESLint (Flat Config)
npm run lint

# Contrôle de type TypeScript
npm run typecheck
```

---

## 💻 Stack Technique Détaillée

| Domaine | Technologies Utilisées |
| --- | --- |
| **Application Desktop** | Electron 40, Electron Builder 26 |
| **Frontend Framework** | React 19, Vite 7, React Router 7, Zustand 5 |
| **Styling & UI** | Tailwind CSS 3, Radix UI, Lucide React, Recharts |
| **Serveur Backend** | Node.js 20, Express.js 5 |
| **Base de Données & Cache** | SQLite 3 (`sqlite3` / `sqlite`), Redis 5 (`redis`) |
| **Automation Web** | Playwright, Puppeteer Core |
| **Moteurs d'IA (LLMs)** | `@google/genai`, NVIDIA NIM API, OpenRouter API, Ollama SDK |
| **Génération d'Images** | Together AI (Qwen Image / Flux), HTML2Canvas |
| **Internationalization** | i18next, react-i18next |
| **Tests & Outillage** | Vitest 4, Testing Library, ESLint 9, Concurrently, Cross-Env |

---

## 🚀 Installation & Configuration Locale

### Prérequis Système
- **Node.js** : v18.0.0 ou supérieur (v20+ recommandé)
- **npm** : v9.0.0 ou supérieur
- **Redis** : Instance Redis en cours d'exécution sur `localhost:6379`
- **Navigateur Chromium** : (Installé automatiquement via Playwright)

### Procédure d'Installation Détaillée

1. **Cloner le dépôt officiel** :
   ```bash
   git clone https://github.com/auceps-dev-team/lunar-nova.git
   cd whatsapp-ai-saas
   ```

2. **Installer les dépendances frontend et racine** :
   ```bash
   npm install
   ```

3. **Installer les dépendances du serveur backend** :
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Configurer le fichier de variables d'environnement (`backend/.env`)** :
   ```env
   BACKEND_PORT=3000
   ELECTRON_CDP_PORT=8315
   VITE_DEV_PORT=5173
   REDIS_URL=redis://localhost:6379

   # Clés API Optionnelles (Peuvent aussi être saisies dans l'interface de l'application)
   GEMINI_API_KEY=votre_cle_gemini
   NVIDIA_DEFAULT_API_KEY=votre_cle_nvidia_nim
   OPENROUTER_API_KEY=votre_cle_openrouter
   TOGETHER_API_KEY=votre_cle_together_ai
   ```

5. **Démarrer le serveur Redis (si ce n'est pas déjà fait)** :
   ```bash
   # Sur Linux / macOS
   redis-server

   # Via Docker (Toutes plateformes)
   docker run -d -p 6379:6379 --name redis-wacopilote redis:alpine
   ```

6. **Lancer l'application en mode développement** :
   ```bash
   npm run start:all
   ```

---

## 🛠 Commandes Utiles

| Commande | Description |
| --- | --- |
| `npm run dev` | Démarre uniquement le serveur de développement Vite (Frontend). |
| `npm run start:backend` | Démarre uniquement le serveur Express backend sur le port 3000. |
| `npm run electron:dev` | Démarre Vite et l'environnement Electron en parallèle. |
| `npm run start:all` | **Commande principale** : Lance simultanément le Backend Express, Vite et Electron. |
| `npm run test` | Lance la suite de tests Vitest. |
| `npm run lint` | Analyse la qualité du code avec ESLint 9. |
| `npm run build` | Compile le bundle de production Vite. |
| `npm run electron:build` | Génère les exécutables d'installation desktop (`dist-electron/`). |
| `npm run electron:publish` | Compile et publie les bannières de release sur GitHub Releases. |

---

## 📁 Architecture du Répertoire

```text
whatsapp-ai-saas/
├── .github/                → Workflows GitHub Actions (CI/CD, Build, Release)
├── backend/                → Serveur backend Express.js & Services d'IA
│   ├── agents/             → Moteurs et prompts des agents IA autonomes
│   ├── routes/             → Routes API Express (AI, WA, Catalog, Prospection, WP)
│   ├── scrapers/           → Modules de scraping (Annuaire CI, GoAfrica, Google Places)
│   ├── services/           → Connecteurs API LLM (Gemini, NVIDIA, Ollama, OpenRouter)
│   ├── aiController.js     → Contrôleur centralisé des requêtes IA
│   ├── db.js               → Connexion & schéma de base de données SQLite3
│   ├── orderListener.js    → Automated WhatsApp order detection engine
│   ├── redisClient.js      → Client de mise en cache Redis & Rate limiter
│   └── server.js           → Point d'entrée de l'application Express
├── docs/                   → Documentation d'architecture & ponts d'intégration
├── electron/               → Processus principal Electron & IPC (main.cjs, preload.js)
├── memory-bank/            → Système de mémoire projet & suivi contextuel
├── public/                 → Asset statiques (Logos, icônes `.ico`, `.svg`, `.png`)
├── src/                    → Application Frontend React 19 (Vite)
│   ├── components/         → Composants UI (Sidebar, Header, Canvas, Modales)
│   ├── pages/              → Vues principales (Dashboard, AiChat, PhotoStudio, Prospection...)
│   │   └── whatsapp/       → Sub-pages dédiées aux flux WhatsApp (Contacts, Ordres, Segments)
│   ├── services/           → Requêtes API et adaptateurs côté client
│   └── store/              → State management Zustand (useAppStore, useAgentStore...)
├── wordpress-plugin/       → Plugin d'extension officiel WaCopilote Bridge v2.0.0 (.zip)
├── package.json            → Configuration du workspace racine & scripts npm
├── vite.config.js          → Configuration du bundler Vite 7
└── vitest.config.js        → Configuration du framework de test Vitest 4
```

---

## 🗺 Feuille de Route 2026

- [x] **Q1 2026** : Publication de WaCopilote v1.35.0 (Electron Desktop + Multi-LLM Gemini / NVIDIA NIM / Ollama).
- [x] **Q2 2026** : Intégration du Studio Photo IA (Remplacement de fond produit) & Prospection Annuaire CI / GoAfrica.
- [ ] **Q3 2026** : Support de WhatsApp Multi-Appareils Cloud API & Baileys fallback direct sans navigateur.
- [ ] **Q4 2026** : Assistant IA vocal WhatsApp (Transcription & Réponse Vocale en temps réel) et version Web SaaS synchronisée.

---

## ❓ Foire Aux Questions

**Q : WaCopilote fonctionne-t-il entièrement hors-ligne ?**  
R : Oui ! Si vous utilisez un modèle LLM local configuré avec **Ollama** (ex: Llama 3, Mistral), l'application peut fonctionner sans connexion Internet pour les fonctionnalités de chat et d'analyse. La génération d'images cloud et les API distantes nécessitent un accès réseau.

**Q : Comment configurer mes clés d'API (Gemini, NVIDIA NIM, OpenRouter) ?**  
R : Vous pouvez renseigner vos clés directement dans l'interface de l'application via la rubrique **Settings** (Paramètres), ou les inscrire dans le fichier `backend/.env`.

**Q : Que faire si j'obtiens une erreur "Redis Client Error" au démarrage ?**  
R : WaCopilote requiert un serveur Redis actif sur le port 6379 pour la gestion du cache et du rate-limiting. Lancez Redis localement ou via la commande Docker : `docker run -d -p 6379:6379 --name redis redis:alpine`.

**Q : Est-il possible d'utiliser WaCopilote pour plusieurs comptes WhatsApp ?**  
R : Oui, la gestion des contacts et des segments permet d'organiser vos listes de clients par marque ou par campagne.

---

## 🤝 Contribution

Les contributions de la communauté de développeurs sont les bienvenues ! Pour contribuer :

1. **Forkez** le projet sur GitHub.
2. **Créez une branche de fonctionnalité** : `git checkout -b feature/ma-nouvelle-fonctionnalite`
3. **Committez vos modifications** : `git commit -m 'feat: Ajout d'une nouvelle fonctionnalité'`
4. **Poussez votre branche** : `git push origin feature/ma-nouvelle-fonctionnalite`
5. **Ouvrez une Pull Request**.

Veuillez consulter notre guide de contribution et respecter les normes ESLint/TypeScript avant de soumettre une PR.

---

## 📄 Licence & Contact

Ce projet est sous licence **Propriétaire / MIT** — Développé et maintenu par **Auceps Digital Dev Team**.

- 🌐 **Site Web** : [auceps.com](https://auceps.com)
- 📧 **Support & Contact Développeurs** : `dev.team@auceps-digital.agency`
- 💬 **GitHub Issues & Discussions** : [auceps-dev-team/lunar-nova/issues](https://github.com/auceps-dev-team/lunar-nova/issues)

---

<p align="center">
  <strong>Conçu avec ❤ et 🤖 à Abidjan, Côte d'Ivoire.</strong>
</p>
