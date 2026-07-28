<p align="center">
  <img src="whatsapp-ai-saas/public/assets/WaCopilot%20Logo.png" alt="WaCopilote Logo" width="400" />
</p>

<p align="center">
  <strong>L'Assistant IA Desktop & Copilote d'Automation WhatsApp Tout-en-Un pour Entreprises, E-Commerce & Agences</strong>
</p>

<p align="center">
  <a href="https://github.com/auceps-dev-team/lunar-nova"><img src="https://img.shields.io/badge/version-1.39.1-blue.svg" alt="Version 1.39.1" /></a>
  <a href="whatsapp-ai-saas/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License AGPL-3.0" /></a>
  <a href="#-open-source"><img src="https://img.shields.io/badge/open%20source-oui-brightgreen.svg" alt="Open Source" /></a>
  <a href="#-pourquoi-wacopilote-"><img src="https://img.shields.io/badge/Made%20in-%F0%9F%87%A8%F0%9F%87%BE%20C%C3%B4te%20d'Ivoire-orange.svg" alt="Made in Côte d'Ivoire" /></a>
  <a href="#-routage-multi-llm--fournisseurs-dia"><img src="https://img.shields.io/badge/AI--Engine-Gemini_%7C_NVIDIA_NIM_%7C_OpenRouter_%7C_Ollama-purple.svg" alt="Multi-LLM Engine" /></a>
</p>

---

## 📋 Sommaire

- [Open Source](#-open-source)
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

## 🔓 Open Source

**Depuis la version 1.36.0, WaCopilote est un logiciel libre, publié sous licence [AGPL-3.0](whatsapp-ai-saas/LICENSE).**

Le code que vous lisez est celui qui tourne chez nos utilisateurs. Il n'y a pas d'édition « communautaire » amputée d'un côté et d'édition propriétaire de l'autre : c'est le même dépôt.

**Ce que cela vous autorise :**
- Lire, auditer et modifier l'intégralité du code, y compris ce qui touche à vos conversations WhatsApp et à vos clés d'API.
- L'installer sur autant de postes que vous voulez, en entreprise comme chez un client, sans licence à acheter.
- Le forker et l'adapter à votre métier.

**Ce que l'AGPL exige en retour :** si vous distribuez une version modifiée, ou si vous la proposez comme service accessible par le réseau, vous devez publier le code de cette version sous la même licence. C'est la seule contrepartie, et elle ne s'applique qu'à ceux qui redistribuent — pas à l'usage interne, même commercial.

Si ce cadre ne convient pas à votre contexte (intégration dans un produit propriétaire, revente en marque blanche), une **licence commerciale alternative** est disponible : `dev.team@auceps-digital.agency`.

> **Sur l'état du projet.** WaCopilote est né comme un produit interne et en porte encore les traces : la couverture de tests est aujourd'hui quasi nulle, plusieurs pages dépassent 800 lignes et certains modules méritent une refonte. Nous ouvrons le code avec ces défauts visibles plutôt que de retarder la publication le temps de faire le ménage. La [feuille de route](#-feuille-de-route-2026) et les issues ouvertes reflètent cet état réel.

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
![Dashboard WaCopilote](whatsapp-ai-saas/public/assets/WaCopilot%20Logo.png)
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
cd lunar-nova/whatsapp-ai-saas

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
- **Authentification par Application Passwords** : le pont s'authentifie via le mécanisme natif WordPress (WP 5.6+) en HTTPS, sans token maison ni clé partagée.
- **Gouvernance humaine (HITL)** : l'agent IA ne fait que soumettre des propositions ; toute écriture en base exige l'approbation d'un administrateur depuis le back-office WordPress.

---

## 🔍 Prospection & Mining de Leads B2B

Alimentez votre canal commercial grâce au module de prospection intégré (`backend/routes/prospection.js` & `backend/scrapers/`) :

- **Scraper Annuaire CI & GoAfrica** : Extraction automatisée des entreprises par secteur d'activité (nom, téléphone WhatsApp, email, adresse, site web).
- **Intégration Google Places API** : Recherche géolocalisée d'établissements commerciaux avec récupération des notes, avis et numéros de téléphone.
- **Conversion Instantanée en Contacts** : Injection en 1 clic des leads extraits vers le gestionnaire de contacts WaCopilote pour campagne de prospection.

---

## 🔒 Sécurité & Audit de Protection

Vos conversations, vos contacts et vos clés d'API ne quittent jamais votre machine : il n'y a pas de serveur WaCopilote qui les collecte. Voici précisément ce qui les protège — et ce qui ne les protège pas encore.

**En place depuis la v1.36.0**

1. **Serveur local, jamais exposé au réseau** : le backend Express n'écoute que sur `127.0.0.1`. Jusqu'à la v1.35.0 il écoutait sur toutes les interfaces, ce qui exposait l'API à n'importe quelle machine du réseau local — corrigé.
2. **Authentification de l'API locale** : toutes les routes exigent un token généré à l'installation et partagé entre le processus Electron et le backend. Un autre programme de la machine ne peut pas interroger l'API.
3. **Les clés d'API ne sortent pas du backend** : l'endpoint de configuration ne renvoie jamais leur valeur, seulement l'information « configurée / non configurée ».
4. **Isolation du renderer Electron** : `contextIsolation` activé, `nodeIntegration` désactivé, passerelle IPC réduite à une liste explicite de fonctions.
5. **CORS restreint** et **limitation de débit** (`express-rate-limit`) sur les routes d'inférence LLM.
6. **Validation des entrées** par `Zod` sur les routes d'agents.
7. **Gouvernance humaine du pont WordPress** : l'agent IA ne peut que *proposer* des modifications ; leur exécution exige une approbation explicite d'un administrateur du site.

**Limites connues, à corriger**

- Les clés d'API et les mots de passe d'application WordPress sont stockés **en clair** dans la base SQLite locale. Le chiffrement au repos est la prochaine étape prioritaire.
- Toutes les routes ne sont pas encore soumises au rate-limiting.

Une revue de sécurité complète est ouverte publiquement dans les issues. Si vous trouvez une faille, écrivez à `dev.team@auceps-digital.agency` plutôt que d'ouvrir une issue publique.

---

## 🧪 Tests & Analyse Statique

```bash
# Suite de tests Vitest
npm run test

# Analyse statique ESLint 9 (Flat Config)
npm run lint

# Build de production Vite
npm run build
```

**État réel de la couverture.** Soyons directs : le projet ne compte aujourd'hui qu'un test de fumée. C'est la dette la plus importante du dépôt, et c'est aussi la contribution la plus utile qu'on puisse y apporter. Les zones prioritaires, celles qui cassent en production :

- les parseurs de scraping (`backend/scrapers/`), dépendants de la structure HTML de sites tiers ;
- les adaptateurs LLM (`backend/*Service.js`), dont les formats de réponse varient d'un fournisseur à l'autre ;
- les migrations de schéma (`backend/db.js`).

La configuration ESLint remonte actuellement du bruit sur le code backend et Electron, faute de déclarer les globales Node — un correctif est en cours.

---

## 💻 Stack Technique Détaillée

| Domaine | Technologies Utilisées |
| --- | --- |
| **Application Desktop** | Electron 40, Electron Builder 26 |
| **Frontend Framework** | React 19, Vite 7, React Router 7, Zustand 5 |
| **Styling & UI** | Tailwind CSS 3, Lucide React, Recharts, dnd-kit |
| **Serveur Backend** | Node.js 20, Express.js 4 |
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
   cd lunar-nova/whatsapp-ai-saas
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
├── backend/                → Serveur backend Express.js & Services d'IA
│   ├── agents/             → Moteurs et prompts des agents IA autonomes
│   │   └── personas/       → Définitions des 27 personas d'agents
│   ├── routes/             → Routes API Express (AI, WA, Catalog, Prospection, WP)
│   ├── scrapers/           → Modules de scraping (Annuaire CI, GoAfrica, Google Places)
│   ├── aiController.js     → Contrôleur centralisé des requêtes IA
│   ├── apiAuth.js          → Token d'authentification de l'API locale
│   ├── db.js               → Connexion & schéma de base de données SQLite3
│   ├── geminiService.js    → Connecteurs LLM (+ openai/openrouter/ollamaService.js)
│   ├── orderListener.js    → Moteur de détection des commandes WhatsApp
│   ├── redisClient.js      → Client de mise en cache Redis
│   └── server.js           → Point d'entrée de l'application Express
├── build/                  → Ressources d'empaquetage (licence installeur, script NSIS)
├── docs/                   → Documentation d'architecture & ponts d'intégration
├── electron/               → Processus principal Electron & IPC (main.cjs, preload.cjs)
├── memory-bank/            → Système de mémoire projet & suivi contextuel
├── public/                 → Assets statiques (Logos, icônes .ico/.svg/.png, poses, fonds)
├── src/                    → Application Frontend React 19 (Vite)
│   ├── components/         → Composants UI (Sidebar, Topbar, éditeur d'images, kanban)
│   ├── locales/            → Traductions i18next (fr, en, es, ar)
│   ├── pages/              → Vues principales (Dashboard, AiChat, PhotoShoot, Prospection...)
│   │   └── whatsapp/       → Sous-pages dédiées aux flux WhatsApp (Contacts, Orders, Segments)
│   ├── services/           → Client API et authentification côté renderer
│   └── store.js            → State management Zustand (store unique persisté)
├── wordpress-plugin/       → Plugin WaCopilote Bridge (source + archives .zip)
├── LICENSE                 → GNU AGPL-3.0
├── package.json            → Configuration du workspace racine & scripts npm
├── vite.config.js          → Configuration du bundler Vite 7
└── vitest.config.js        → Configuration du framework de test Vitest 4
```

---

## 🗺 Feuille de Route 2026

- [x] **Q1 2026** : Publication de WaCopilote v1.35.0 (Electron Desktop + Multi-LLM Gemini / NVIDIA NIM / Ollama).
- [x] **Q2 2026** : Intégration du Studio Photo IA (Remplacement de fond produit) & Prospection Annuaire CI / GoAfrica.
- [x] **Q3 2026** : **Passage en open source sous AGPL-3.0** (v1.36.0) et durcissement de la sécurité du backend local.
- [ ] **Q3 2026** : Chiffrement au repos des clés d'API et des identifiants WordPress ; couverture de tests sur les scrapers et les adaptateurs LLM.
- [ ] **Q4 2026** : Support de WhatsApp Multi-Appareils Cloud API & fallback Baileys direct sans navigateur.
- [ ] **2027** : Assistant IA vocal WhatsApp (transcription & réponse vocale temps réel) et version Web SaaS synchronisée.

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

Les contributions sont les bienvenues. Pour contribuer :

1. **Forkez** le projet sur GitHub.
2. **Créez une branche** : `git checkout -b feature/ma-nouvelle-fonctionnalite`
3. **Committez vos modifications** : `git commit -m "feat: ajout d'une nouvelle fonctionnalité"`
4. **Poussez votre branche** : `git push origin feature/ma-nouvelle-fonctionnalite`
5. **Ouvrez une Pull Request** en décrivant le problème résolu.

Faites passer `npm run lint` et `npm run test` avant de soumettre. Le projet est en JavaScript, pas en TypeScript — pas de contrôle de types à exécuter.

**Par où commencer ?** Les issues étiquetées `good first issue` couvrent surtout l'ajout de tests et le nettoyage de la configuration ESLint. C'est là que l'aide a le plus de valeur immédiate.

**Sur les droits.** En contribuant, vous acceptez que votre contribution soit distribuée sous AGPL-3.0. Nous proposant par ailleurs une licence commerciale, un accord de contribution (CLA) sera mis en place pour les contributions substantielles — il n'est pas encore rédigé, nous l'annoncerons dans les issues avant de l'appliquer.

---

## 📄 Licence & Contact

WaCopilote est distribué sous **GNU Affero General Public License v3.0** — voir le fichier [LICENSE](whatsapp-ai-saas/LICENSE) pour le texte intégral.

```
Copyright (C) 2026  Auceps Digital

Ce programme est un logiciel libre : vous pouvez le redistribuer et/ou le modifier
selon les termes de la GNU Affero General Public License telle que publiée par la
Free Software Foundation, en version 3 de la licence.

Ce programme est distribué dans l'espoir qu'il sera utile, mais SANS AUCUNE
GARANTIE ; sans même la garantie implicite de QUALITÉ MARCHANDE ou d'ADÉQUATION
À UN USAGE PARTICULIER. Voir la GNU Affero General Public License pour plus de détails.
```

**Exception :** le plugin `wordpress-plugin/wacopilote-bridge/` reste sous **GPL-2.0-or-later**, comme l'exige l'écosystème WordPress. La clause « or later » le rend compatible avec l'AGPL-3.0 du reste du dépôt.

**Licence commerciale.** L'AGPL impose de publier le code de toute version modifiée que vous redistribuez ou exposez comme service. Si votre contexte l'interdit — intégration dans une solution propriétaire, revente en marque blanche — écrivez-nous pour une licence commerciale.

- 🌐 **Site Web** : [auceps.com](https://auceps.com)
- 📧 **Contact & licences commerciales** : `dev.team@auceps-digital.agency`
- 💬 **GitHub Issues & Discussions** : [auceps-dev-team/lunar-nova/issues](https://github.com/auceps-dev-team/lunar-nova/issues)

---

<p align="center">
  <strong>Conçu avec ❤ et 🤖 à Abidjan, Côte d'Ivoire.</strong>
</p>
