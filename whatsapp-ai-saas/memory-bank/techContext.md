# Tech Context: WaCopilote

## Tech Stack
- **Frontend UI Framework**: React 19, Vite 7, React Router 7, Zustand 5, Tailwind CSS 3
- **Desktop Runtime**: Electron 40, Electron Builder 26
- **Backend API & Processing Server**: Node.js 20, Express.js 5
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
├── backend/            # Express.js REST API server, LLM adapters, database, & scrapers
│   ├── agents/         # AI Agent runner engines & prompt handlers
│   ├── routes/         # Express API route modules
│   ├── scrapers/       # Business directory & web scraping logic
│   ├── services/       # AI services (Gemini, NVIDIA, Ollama, OpenRouter, OpenAI)
│   └── db.js           # SQLite database schema & migrations
├── src/                # React 19 Frontend App (App Router / Vite)
│   ├── components/     # UI Components (Radix UI, Lucide React, Charts, Canvas)
│   ├── pages/          # View Pages (Dashboard, Agents, Photo Studio, Scraper, Settings)
│   ├── store/          # Zustand state stores
│   └── services/       # API Client services
├── public/             # Static assets (Logos, icons, default assets)
├── docs/               # Technical documentation
├── wordpress-plugin/   # WordPress bridge plugin
└── package.json        # Root workspace configuration & scripts
```

## Environment Variables & Configuration
- Backend env (`backend/.env`):
  - `PORT` / `BACKEND_PORT`: Backend server port (default 3000)
  - `REDIS_URL`: Redis connection URL (default `redis://localhost:6379`)
  - `GEMINI_API_KEY`: Google Gemini API credentials
  - `NVIDIA_API_KEY`: NVIDIA NIM API credentials
  - `OPENROUTER_API_KEY`: OpenRouter API credentials
  - `TOGETHER_API_KEY`: Together AI credentials
