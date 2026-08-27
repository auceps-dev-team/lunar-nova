# System Patterns: WaCopilote

## Architectural Paradigms

1. **Hybrid Desktop / Server Architecture**:
   - Electron wrapper launches both the React renderer interface and an embedded/managed Express.js Node server.
   - IPC communication between renderer and main process for file operations, store updates, and desktop native capabilities.

2. **Multi-Model AI Gateway & Strategy Pattern**:
   - Standardized provider adapters (`geminiService.js`, `nvidiaModels.js`, `openrouterService.js`, `ollamaService.js`, `openaiService.js`).
   - Dynamic model routing based on agent role (e.g. vision tasks to Gemini/NVIDIA, quick text to Ollama/OpenRouter).

3. **Persistent Storage & Caching Layer**:
   - SQLite as local transactional database for chats, agent states, catalog products, scrapers, and analytics logs.
   - Redis for caching model lists, rate limiting API calls, and queuing asynchronous automation actions.

4. **Web Automation Engine**:
   - Playwright / Puppeteer automation headless sessions managing WhatsApp Web interface (`orderListener.js`), handling web hooks, QR code authentications, and incoming customer events.

5. **State Management & UI Design**:
   - Modular Zustand stores for UI state, agent configuration, active chat sessions, and app settings.
   - Modern Tailwind CSS styling with responsive, dark-mode ready design tokens and Lucide icons.

6. **Multi-Port Startup Gating (`wait-on tcp:5173 tcp:3000`)**:
   - Mécanisme de barrière au démarrage garantissant qu'Electron ne s'ouvre que lorsque le serveur de build Vite (port `5173`) ET l'API Express (port `3000`) acceptent activement les connexions TCP.
   - Évite les courses critiques et les erreurs `ERR_CONNECTION_REFUSED` au montage initial de l'UI.

7. **IPv4 Loopback Binding & CORS Strategy (`127.0.0.1`)**:
   - Le backend écoute strictement sur `127.0.0.1` (`HOST = '127.0.0.1'`), jamais `0.0.0.0`, pour sécuriser l'API locale contre le réseau local.
   - Le client frontend utilise `http://127.0.0.1:3000` par défaut afin d'éviter la tentative de résolution IPv6 (`::1`) de `localhost` sous Windows.
   - La liste `allowedOrigins` autorise explicitement `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:3000`, `http://127.0.0.1:3000` et `null` (production Electron).
