import { API_BASE_URL } from '../config';

/**
 * Store — Réglages : application, backend, modèles disponibles.
 *
 * Slice extraite de src/store.js (constat R5 de l’audit du 29/09/2026). Le
 * store reste unique et persisté sous le même nom : voir src/store.js, qui
 * assemble les slices et porte la persistance. Le quota d'images (aiQuota) a
 * disparu avec la génération d'image.
 */
export const createSettingsSlice = (set, get) => ({
    // --- Global Settings ---
    appSettings: {
        theme: 'light',
        language: 'en',
        model: 'gemini-2.5-flash',
        allowAiRead: true,
        promptFormat: 'json',
        hasCompletedOnboarding: false,
        mainMenuOrder: [],
        // Identifiants des onglets masqués dans la barre latérale.
        // Le masquage n'est que visuel : les routes restent accessibles
        // par URL, il ne s'agit pas d'un contrôle d'accès.
        hiddenMenuItems: []
    },

    // --- Available AI Models ---
    // Modèles de conversation seulement : la génération d'image a été retirée.
    availableModels: { chat: [] },
    setAvailableModels: (models) => set({ availableModels: models }),

    // --- Backend Settings (provider, models, API keys) ---
    // Synced from GET /api/settings so every page can read them without
    // re-fetching on each mount.
    backendSettings: {
        default_ai_provider: 'gemini',
        openai_base_url: 'https://integrate.api.nvidia.com/v1',
        // other keys are populated after fetch
    },


    // --- Actions ---
    updateSettings: (updates) => set((state) => ({
        appSettings: { ...state.appSettings, ...updates }
    })),

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

    /**
     * Recopie le modèle choisi dans les Paramètres (appSettings.model) côté
     * backend, sous default_chat_model : c'est lui qu'utilise le routeur pour
     * tout appel qui ne précise pas de modèle (Rédaction, prospection, MCP,
     * CLI). Avant le 26/11/2026, ces appels ignoraient ce choix.
     *
     * N'écrit que si le modèle figure dans la liste du fournisseur ENREGISTRÉ
     * (celle que fetchGlobalModels vient de charger) : un identifiant d'un
     * autre fournisseur ferait échouer les appels.
     * @returns {Promise<boolean>} vrai si une écriture a eu lieu.
     */
    syncDefaultChatModel: async () => {
        const { appSettings, backendSettings, availableModels } = get();
        const model = appSettings?.model;
        if (!model || !(availableModels?.chat || []).some((m) => m.id === model)) return false;
        if (backendSettings?.default_chat_model === model) return false;
        try {
            const res = await fetch(API_BASE_URL + '/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ default_chat_model: model })
            });
            if (!res.ok) return false;
            set((state) => ({ backendSettings: { ...state.backendSettings, default_chat_model: model } }));
            return true;
        } catch (e) {
            if (e?.name !== 'AbortError') {
                console.warn('[Store] Failed to sync default chat model:', e?.message || e);
            }
            return false;
        }
    },

    fetchGlobalModels: async () => {
        const state = get();
        const chatProvider = state.backendSettings.default_ai_provider || 'gemini';

        let apiKey = undefined;
        let baseURL = undefined;
        if (chatProvider === 'openrouter' && state.backendSettings.openrouter_api_key) {
            apiKey = state.backendSettings.openrouter_api_key;
        } else if (chatProvider === 'openai' && state.backendSettings.openai_api_key) {
            apiKey = state.backendSettings.openai_api_key;
            baseURL = state.backendSettings.openai_base_url;
        }

        try {
            const chatRes = await fetch(`${API_BASE_URL}/api/ai/models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: chatProvider, apiKey, baseURL })
            });
            if (!chatRes.ok) return;
            const chatData = await chatRes.json();

            let newChat = [];
            if (chatData.status === 'success' && chatData.models) {
                if (chatData.models.chat) {
                    newChat = chatData.models.chat;
                } else if (Array.isArray(chatData.models)) {
                    newChat = chatData.models;
                }
            }

            // Sécurité additionnelle : nettoyer les emojis résiduels des noms
            const cleanName = (str) => (str || '').replace(/^[\u2700-\u27BF\u1F000-\u1F9FF\u2600-\u26FF]\s*/, '');
            newChat = newChat.map(m => ({ ...m, name: cleanName(m.name) }));

            set({ availableModels: { chat: newChat } });
        } catch (e) {
            if (e?.name !== 'AbortError') {
                console.warn('[Store] Failed to fetch global models (backend offline):', e?.message || e);
            }
            set({ availableModels: { chat: [] } });
        }
    },
});
