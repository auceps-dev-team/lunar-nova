import { API_BASE_URL } from '../config';

/**
 * Store — Réglages : application, backend, modèles disponibles, quota IA.
 *
 * Slice extraite de src/store.js (constat R5 de l’audit du 29/09/2026), à
 * l’identique. Le store reste unique et persisté sous le même nom : voir
 * src/store.js, qui assemble les slices et porte la persistance.
 */
export const createSettingsSlice = (set, get) => ({
    aiQuota: {
        hasCustomKey: false,
        imageUsed: 0,
        imageLimit: 40,
        resetDate: ''
    },


    // --- Global Settings ---
    appSettings: {
        theme: 'light',
        language: 'en',
        model: 'gemini-2.5-flash',
        allowAiRead: true,
        promptFormat: 'json',
        hasCompletedOnboarding: false,
        // Masquage volontaire du bandeau de quota par l'utilisateur.
        // Persisté (appSettings est conservé par partialize) — remplace
        // l'ancien hack qui réécrivait aiQuota.imageLimit à 99999 dans
        // l'état persisté, contaminant les sessions suivantes.
        dismissQuotaBanner: false,
        mainMenuOrder: [],
        // Identifiants des onglets masqués dans la barre latérale.
        // Le masquage n'est que visuel : les routes restent accessibles
        // par URL, il ne s'agit pas d'un contrôle d'accès.
        hiddenMenuItems: []
    },

    // --- Available AI Models ---
    availableModels: { chat: [], image: [] },
    setAvailableModels: (models) => set({ availableModels: models }),

    // --- Backend Settings (provider, models, API keys) ---
    // Synced from GET /api/settings and persisted in IndexedDB
    // so all pages (PhotoShoot, AgentsHub, etc.) can read them without
    // re-fetching on each mount.
    backendSettings: {
        default_ai_provider: 'gemini',
        default_image_provider: 'openai', // dédié à la génération d'images (Together AI/NVIDIA)
        default_image_model: '',
        openai_base_url: 'https://integrate.api.nvidia.com/v1',
        // other keys are populated after fetch
    },


    // --- Actions ---
    updateSettings: (updates) => set((state) => ({
        appSettings: { ...state.appSettings, ...updates }
    })),

    fetchAiQuota: async () => {
        try {
            const res = await fetch(API_BASE_URL + '/api/settings/quota');
            if (!res.ok) return;
            const data = await res.json();
            if (data.status === 'success') {
                set({ aiQuota: data.data });
            }
        } catch (e) {
            if (e?.name !== 'AbortError') {
                console.warn('[Store] Failed to fetch AI Quota (backend offline):', e?.message || e);
            }
        }
    },


    setBackendSettings: (settings) => set((state) => ({
        backendSettings: { ...state.backendSettings, ...settings }
    })),

    fetchAndSyncBackendSettings: async () => {
        try {
            const res = await fetch(API_BASE_URL + '/api/settings');
            if (!res.ok) return;
            const data = await res.json();
            if (data.status === 'success' && data.settings) {
                set((state) => ({
                    backendSettings: { ...state.backendSettings, ...data.settings }
                }));
            }
        } catch (e) {
            if (e?.name !== 'AbortError') {
                console.warn('[Store] Failed to sync backend settings (backend offline):', e?.message || e);
            }
        }
    },

    fetchGlobalModels: async () => {
        const state = get();
        const chatProvider  = state.backendSettings.default_ai_provider  || 'gemini';
        const imageProvider = state.backendSettings.default_image_provider || chatProvider;

        let apiKey = undefined;
        let baseURL = undefined;
        if (chatProvider === 'openrouter' && state.backendSettings.openrouter_api_key) {
            apiKey = state.backendSettings.openrouter_api_key;
        } else if (chatProvider === 'openai' && state.backendSettings.openai_api_key) {
            apiKey = state.backendSettings.openai_api_key;
            baseURL = state.backendSettings.openai_base_url;
        }

        try {
            // 1. Fetch chat models (selon chatProvider)
            const chatRes = await fetch(`${API_BASE_URL}/api/ai/models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: chatProvider, apiKey, baseURL })
            });
            if (!chatRes.ok) return;
            const chatData = await chatRes.json();

            let newChat = [];
            let newImage = [];

            if (chatData.status === 'success' && chatData.models) {
                if (chatData.models.chat) {
                    newChat = chatData.models.chat;
                    newImage = chatData.models.image || [];
                } else if (Array.isArray(chatData.models)) {
                    newChat = chatData.models;
                }
            }

            // 2. Si imageProvider ≠ chatProvider, fetch les modèles image séparément
            if (imageProvider && imageProvider !== chatProvider) {
                try {
                    const imgRes = await fetch(`${API_BASE_URL}/api/ai/models`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ provider: imageProvider })
                    });
                    if (imgRes.ok) {
                        const imgData = await imgRes.json();
                        if (imgData.status === 'success' && imgData.models?.image) {
                            newImage = imgData.models.image;
                        }
                    }
                } catch (e) {
                    console.warn('[Store] Failed to fetch image models:', e);
                }
            }

            // Sécurité additionnelle : nettoyer les emojis résiduels des noms
            const cleanName = (str) => (str || '').replace(/^[\u2700-\u27BF\u1F000-\u1F9FF\u2600-\u26FF]\s*/, '');
            newChat  = newChat.map(m => ({ ...m, name: cleanName(m.name) }));
            newImage = newImage.map(m => ({ ...m, name: cleanName(m.name) }));

            set({ availableModels: { chat: newChat, image: newImage } });
        } catch (e) {
            if (e?.name !== 'AbortError') {
                console.warn('[Store] Failed to fetch global models (backend offline):', e?.message || e);
            }
            set({ availableModels: { chat: [], image: [] } });
        }
    },
});
