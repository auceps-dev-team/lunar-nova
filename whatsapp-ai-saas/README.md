# WaCopilote

WaCopilote est une application de bureau complète (Electron + React + Express) conçue pour automatiser et assister les flux de travail liés à WhatsApp, à la création de catalogues, et au support client via des agents d'intelligence artificielle.

## 🚀 Fonctionnalités Principales

- **Agents IA Multimodèles** : Support de Gemini, OpenRouter, Ollama (local) et NVIDIA NIM (Llama, Gemma, Qwen).
- **Génération et Édition d'Images** : Création de photos produit et de "Photo Shoots" virtuels, inpainting, et retouche via IA.
- **Support Client Intelligent** : Agents conversationnels spécialisés (Creative, Support, Analyst, etc.).
- **Gestion de Catalogue** : Extraction de données structurées et création automatisée de catalogues.
- **Backend Robuste** : Express.js avec SQLite pour le stockage persistant et Redis pour la gestion du cache et des limites de requêtes.

## 🏗 Architecture du Projet

Le projet fonctionne comme un monorepo contenant :
- **Frontend** : Application React gérée par Vite (dossier `src/`), utilisant TailwindCSS et Zustand pour l'état.
- **Backend** : Serveur Express.js (dossier `backend/`) gérant la logique métier, la base de données (SQLite), et les appels API externes vers les LLMs.
- **Electron** : Wrapper desktop (dossier `electron/`) pour le déploiement en tant qu'application native.

## 🛠 Prérequis

Pour exécuter WaCopilote en local, vous avez besoin de :
- [Node.js](https://nodejs.org/) (version 18 ou supérieure recommandée)
- [Redis](https://redis.io/) (doit être installé et en cours d'exécution sur le port par défaut 6379)
- (Optionnel) Des clés d'API pour les services d'intelligence artificielle :
  - **Gemini** (Google AI Studio)
  - **NVIDIA NIM**
  - **Together AI** (pour Qwen Image)
  - **OpenRouter**

## ⚙️ Installation & Configuration

1. **Cloner le projet** et installer les dépendances à la racine :
   ```bash
   npm install
   ```
2. **Installer les dépendances du backend** :
   ```bash
   cd backend
   npm install
   cd ..
   ```
3. **Configurer les variables d'environnement** :
   Copiez le fichier d'exemple dans le dossier backend :
   ```bash
   cp backend/.env.example backend/.env
   ```
   Ouvrez `backend/.env` et renseignez les ports si nécessaire, ainsi que vos clés d'API système. (Note: Vous pouvez aussi renseigner les clés API directement depuis l'interface utilisateur de WaCopilote dans la section "Settings").

## 🏃‍♂️ Exécution

L'application requiert l'exécution simultanée du frontend (Vite), du backend (Express), et d'Electron. Des scripts automatisés sont prévus :

- **Lancement complet en mode développement** (Frontend + Backend + Electron) :
  ```bash
  npm run start:all
  ```
- *Lancement séparé (si besoin) :*
  - Démarrer uniquement le backend : `npm run start:backend`
  - Démarrer uniquement l'interface web : `npm run dev`

## 📦 Build & Publication

Pour compiler l'application de bureau pour la production :

- **Build local (Windows, Mac, Linux selon l'OS courant)** :
  ```bash
  npm run electron:build
  ```
- **Build et publication sur GitHub Releases** :
  ```bash
  npm run electron:publish
  ```
Les exécutables d'installation seront générés dans le dossier `dist-electron/`.

## 🐛 Troubleshooting

- **"Redis Client Error"** : Assurez-vous que le service Redis tourne bien sur votre machine (ex: via WSL sur Windows ou Docker `docker run -p 6379:6379 -d redis`).
- **"EADDRINUSE" (Port déjà utilisé)** : Le backend utilise par défaut le port 3000. Si ce port est pris, changez `BACKEND_PORT` dans `backend/.env`.
- **"OpenAI/NVIDIA API key not configured"** : Si vous utilisez un modèle de génération d'image spécifique, assurez-vous que la clé API correspondante est bien renseignée dans les Settings de l'application ou dans `.env`.
