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
