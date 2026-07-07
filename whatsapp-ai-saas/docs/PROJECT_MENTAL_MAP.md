# Carte Mentale du Projet: WA Copilote (WhatsApp AI SaaS)

## Vue d'Ensemble
L'application est un SaaS desktop (Electron) combinant React (Vite) pour le frontend, Node.js (Express) pour l'orchestration locale et l'interaction avec le navigateur (Puppeteer via CDP port 8315), et un bridge WordPress.

## Architecture des Dossiers
- `/backend`: Serveur Node.js local (Express, port 3000).
  - `/backend/routes/`: `ai.js`, `authGoogle.js`, `catalog.js`, `documents.js`, `prospection.js`, `settings_and_agents.js`, `wa.js`, `wordpress.js`.
  - `/backend/server.js`: Point d'entrée, configure Express, CORS, multer, et la connexion Puppeteer au CDP d'Electron pour interagir avec les instances WhatsApp Web.
- `/src`: Frontend React (construit avec Vite).
  - `/src/App.jsx`: Point d'entrée de l'application et définition du routing React (React Router).
  - `/src/pages/`: Pages principales de l'UI (Dashboard, Analytics, AgentsHub, AiChat, AiWriter, InvoiceBuilder, etc.) et sous-pages WhatsApp (Prospection, Contacts, etc.).
  - `/src/components/`: Composants UI réutilisables (`Sidebar`, `Topbar`, `WorkArea`, sous-dossiers `ui/`, `wordpress/`, `image-editor/`, `invoice/`).
  - `/src/store.js`: Gestion de l'état global (probablement Zustand).
- `/electron`: Code source de l'application Electron (gestion du cycle de vie, des fenêtres, et de l'updater).
- `/wordpress-plugin`: Archives ZIP des plugins bridge (ex: `wacopilote-bridge-v2.0.0.zip`).

## Routes et Flux de Données
### Frontend (React Router - `App.jsx`)
- `/dashboard`, `/analytics`, `/profile`, `/agents`, `/ai-chat`, `/settings`, etc.
- **Routes WhatsApp** : `/wa/prospection`, `/wa/contact-lists`, `/wa/segments`, `/wa/contacts`, `/wa/contacts/add`, `/wa/contacts/import`.
- **Mécanique Clé** : Le composant `WorkArea` gère les balises `<webview>` d'Electron pour afficher les instances WhatsApp Web. Il est toujours rendu mais caché via CSS si l'utilisateur n'est pas sur la route `/whatsapp-hub`.

### Backend (Express API - `server.js`)
- `/api/auth/google`: Authentification Google.
- `/api/prospection`: Fonctionnalités de prospection (ex: Google Maps API).
- `/api/wp`: Bridge WordPress (Upload media géré par multer sur `/api/wp/media/upload`).
- `/api/documents`: Gestion documentaire locale.
- `/api/config`: Renvoie la configuration basique au frontend.
- `/api/instances`: Vérifie les instances WhatsApp actives en se connectant via Puppeteer à Electron (port 8315). Attach un `MutationObserver` pour écouter les nouveaux messages.
- `/api/context/:instance_id`: Extraction (Read-Only) du contexte de chat via Puppeteer.
- Autres routes REST sous `/` déléguées aux routeurs correspondants (`wa.js`, `ai.js`, etc.).

## Dépendances Clés Identifiées
- **Frontend** : React, React Router, Zustand (store), react-i18next, @react-oauth/google. TailwindCSS pour les styles.
- **Backend** : Express, Puppeteer-core, Zod, Sqlite (via `db.js`), Redis (`redisClient.js`), Multer.
- **Bridge IA** : Intégrations avec Gemini, OpenAI, Ollama, OpenRouter, Nvidia via des services dédiés dans `/backend/` (`geminiService.js`, `openaiService.js`, etc.).
