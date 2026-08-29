# 🧠 Carte Mentale & Architecture Globale : WaCopilote (v1.45.0)

## 📌 Vue d'Ensemble
**WaCopilote** est une suite logicielle SaaS Desktop & Agentique d'entreprise (Electron 40 + React 19 + Node.js 20 Express) conçue pour automatiser les flux de vente et de prospection WhatsApp, la génération d'images/catalogue IA, la facturation/devis, le bridge WordPress HITL (Human-in-the-Loop) et le pilotage bidirectionnel par agents IA externes (Claude Code, Cursor, Antigravity) via CLI et MCP (Model Context Protocol).

---

## 🗺️ 1. Carte Mentale Graphique (Mermaid Mindmap)

```mermaid
mindmap
  root((🚀 WaCopilote v1.45.0))
    Desktop & Runtime
      Electron 40 Main Process
        Remote Debugging Port 8315 CDP
        SafeStorage DPAPI / Trousseau / libsecret
        Auto-Updater Electron Updater
        Preload Bridge Context Isolation
      Vite 7 Renderer Port 5173
        React 19 & React Router 7
        Zustand 5 Store + IndexedDB
        i18n Multi-langues (FR, EN, ES, AR)
        Tailwind CSS 3 & Lucide Icons
    Backend & Orchestration
      Express 4 Server 127.0.0.1:3000
        API Bearer Token Auth
        Rate Limiters Global & Heavy
        Multi-Provider AI Gateway
          Google Gemini 2.5 Flash / Pro
          OpenRouter DeepSeek / Llama
          NVIDIA NIM Qwen / Gemma
          Together AI Qwen Image Gen
          Ollama Local LLMs
        27 Personas IA Spécialisés
      Couche de Services In-Process
        pipelineService (Runs, Scrape, Contacts, Kanban)
        prospectionService (Google Maps, GoAfrica, Annuaire CI)
        documentsService (CRUD ai_documents)
        invoiceService (CRUD quotes, Export PDF Headless)
        wordpressService (HITL Propose, Approve, Reject, Stats)
        waInstancesService (Miroir SQLite des instances)
        externalAgentRunner (Sandbox CLI spawn sécurisé)
    Pilotage Externe & Agentique
      CLI Inbound bin/wacopilote.cjs
        list-agents, run --agent
        prospect search, pipeline run --auto
        documents, photo generate, wordpress HITL
        quotes create/export-pdf, instances
      Serveur MCP Stdio backend/mcp/wacopiloteMcpServer.js
        JSON-RPC 2.0 Stdio
        30+ Outils Métier Exposés
        Gouvernance HITL wp_pending_actions
    Données & Stockage
      SQLite 3 database.sqlite
        Migrations de Schéma v1 -> v7
        Chiffrement AES-GCM 256 des Clés API
        Tables (copilot_logs, wa_contacts, quotes, etc.)
      Redis 5 Caching & Queues
      CDP & Puppeteer WhatsApp Web
        MutationObserver & Order Radar
```

---

## 🔄 2. Diagramme de Flux de Données & Architecture Système

```mermaid
flowchart TB
    subgraph IDE_AGENTS["🤖 IDEs & Agents Externes (Claude Code, Cursor, Antigravity)"]
        CLI["💻 CLI Inbound (bin/wacopilote.cjs)"]
        MCP["🔌 Serveur MCP JSON-RPC Stdio"]
    end

    subgraph DESKTOP_ELECTRON["🖥️ Desktop Electron (Port CDP 8315)"]
        MAIN["main.cjs (Processus Principal)"]
        SAFE["safeStorage (DPAPI / Keychain)"]
        RENDERER["src/ (React 19 UI - Vite 5173)"]
        WEBVIEW["<webview> WhatsApp Web"]
    end

    subgraph BACKEND_EXPRESS["⚙️ Backend Express (127.0.0.1:3000)"]
        AUTH["Middleware requireApiToken"]
        ROUTERS["Routes REST (/api/...)"]
        
        subgraph SERVICES_LAYER["📦 Couche de Services Métier (In-Process)"]
            SRV_PIPE["pipelineService"]
            SRV_PROS["prospectionService"]
            SRV_DOCS["documentsService"]
            SRV_INV["invoiceService (Playwright Headless PDF)"]
            SRV_WP["wordpressService (HITL Gouvernance)"]
            SRV_WA["waInstancesService"]
            SRV_CLI["externalAgentRunner (Whitelisted Spawn)"]
        end

        subgraph AI_GATEWAY["🧠 Passerelle Multi-LLM (27 Personas)"]
            GEMINI["Google Gemini API"]
            OPENROUTER["OpenRouter API"]
            NVIDIA["NVIDIA NIM"]
            OLLAMA["Ollama Local"]
            TOGETHER["Together AI (Images)"]
        end
    end

    subgraph DATA_LAYER["💾 Persistance & Automatisation"]
        SQLITE[("SQLite 3 (database.sqlite)\nMigrations v1->v7 + SecretStore")]
        REDIS[("Redis Cache / Rate Limiting")]
        WP_REMOTE["🌐 Site WordPress Client (Plugin Bridge)"]
        SCRAPERS["🔍 Scrapers (Google Maps, GoAfrica, Annuaire CI)"]
    end

    %% Connexions
    CLI --> SERVICES_LAYER
    MCP --> SERVICES_LAYER
    RENDERER -->|HTTP Bearer Token| AUTH
    AUTH --> ROUTERS
    ROUTERS --> SERVICES_LAYER
    
    MAIN -->|Fork / IPC| BACKEND_EXPRESS
    MAIN --> SAFE
    WEBVIEW -.->|CDP 8315| SERVICES_LAYER
    
    SERVICES_LAYER --> AI_GATEWAY
    SERVICES_LAYER --> SQLITE
    SERVICES_LAYER --> REDIS
    SERVICES_LAYER --> WP_REMOTE
    SERVICES_LAYER --> SCRAPERS
```

---

## 📂 3. Topologie Détaillée du Dépôt

| Répertoire / Fichier | Responsabilité & Modules Clés |
| :--- | :--- |
| `bin/wacopilote.cjs` | Point d'entrée CLI autonome pour l'orchestration système et le piping Unix. |
| `backend/mcp/` | Serveur MCP (`wacopiloteMcpServer.js`) JSON-RPC 2.0 exposant 30+ outils agentiques. |
| `backend/services/` | Logique métier extraite (pipeline, prospection, documents, devis, WP, instances, CLI runner). |
| `backend/routes/` | Wrappers fins Express avec rate limiting et token middleware. |
| `backend/agents/` | Orchestrateur des 27 personas IA (`orchestrator.js`, prompts système). |
| `backend/scrapers/` | Moteurs et parsers de prospection (Google Maps, Annuaire CI, GoAfrica). |
| `backend/db.js` | Driver SQLite avec interface mockée Postgres Pool, migrations v1->v7 et chiffrement. |
| `backend/secretStore.js` | Chiffrement AES-256-GCM au repos scellé par la clé maître. |
| `electron/` | Gestion du cycle de vie de l'application desktop, remote debugging CDP et updater. |
| `src/` | Interface utilisateur React 19, Zustand store, composants Radix/Tailwind, i18n FR/EN/ES/AR. |
| `docs/` | Documentation technique, schémas d'architecture et spécifications des ponts. |
| `wordpress-plugin/` | Plugin WordPress officiel pour la synchronisation e-commerce et le bridge HITL. |
