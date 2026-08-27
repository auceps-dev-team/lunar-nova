# Tech Context: WaCopilote

## Tech Stack
- **Frontend UI Framework**: React 19, Vite 7, React Router 7, Zustand 5, Tailwind CSS 3
- **Desktop Runtime**: Electron 40, Electron Builder 26
- **Backend API & Processing Server**: Node.js 20, Express.js 4
- **Database & Caching**: SQLite 3 (persistent storage), Redis 5 (caching, rate limiting, queues)
- **Browser Automation**: Playwright, Puppeteer Core (WhatsApp automation & web scraping)
- **AI Integrations**:
  - Google Gemini API (`@google/genai`)
  - NVIDIA NIM (Llama 3, Gemma, Qwen, DeepSeek)
  - OpenRouter API
  - Ollama (Local LLM inference)
  - Together AI (Qwen Image Generation)
- **Internationalization**: i18next & react-i18next
- **Testing & Quality Assurance**: Vitest 4, Testing Library, ESLint 9

## Project Topology
```text
/
├── electron/           # Electron main process entry point & desktop integrations
├── bin/                # CLI executables (wacopilote.cjs)
├── backend/            # Express.js REST API server, LLM adapters, database, & scrapers
│   ├── agents/         # AI Agent runner engines & prompt handlers
│   ├── mcp/            # Model Context Protocol (MCP) server stdio (wacopiloteMcpServer.js)
│   ├── routes/         # Express API route modules (cliBridge.js, etc.)
│   ├── scrapers/       # Business directory & web scraping logic
│   ├── services/       # AI & CLI services (Gemini, NVIDIA, Ollama, OpenRouter, externalAgentRunner)
│   └── db.js           # SQLite database schema & migrations (wp_pending_actions, etc.)
├── src/                # React 19 Frontend App (App Router / Vite)
│   ├── components/     # UI Components (CliAgentBridgeSettings, Radix UI, Lucide React)
│   ├── pages/          # View Pages (Settings, Dashboard, Agents, Photo Studio, Prospection)
│   ├── store.js        # Zustand global store (persisté via IndexedDB)
│   └── services/       # API Client services
├── public/             # Static assets (Logos, icons, default assets)
├── docs/               # Technical documentation
├── wordpress-plugin/   # WordPress bridge plugin
└── package.json        # Root workspace configuration & scripts
```

## Environment Variables & Configuration
- Backend env (`backend/.env`):
  - `PORT` / `BACKEND_PORT`: Backend server port (default 3000)
  - `BACKEND_HOST`: Host interface (default `127.0.0.1` — strict IPv4 loopback)
  - `REDIS_URL`: Redis connection URL (default `redis://localhost:6379`)
  - `GEMINI_API_KEY`: Google Gemini API credentials
  - `NVIDIA_API_KEY`: NVIDIA NIM API credentials
  - `OPENROUTER_API_KEY`: OpenRouter API credentials
  - `TOGETHER_API_KEY`: Together AI credentials
- Frontend env (`src/config.js`):
  - `API_BASE_URL`: `http://127.0.0.1:3000` (IPv4 loopback pour éliminer les échecs de résolution IPv6 `::1` de `localhost` sous Windows).

## Dev Orchestration & Scripts
- `npm run start:all`: `concurrently -k "npm run start:backend" "npm run electron:dev"`
- `npm run start:backend`: `node backend/server.js` (démarre Express sur `127.0.0.1:3000`)
- `npm run electron:dev`: `concurrently -k "npm run dev" "wait-on tcp:5173 tcp:3000 && npm run electron:start"` (attend que Vite sur `5173` ET le Backend sur `3000` soient prêts avant de lancer Electron)
- `npm run test`: `vitest run` (16 suites de tests, 157 tests unitaires/intégration)
- `npm run lint`: `eslint .`
- `npm run build`: `vite build`
