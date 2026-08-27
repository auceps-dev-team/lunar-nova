import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { API_BASE_URL } from './config';


// IndexedDB storage adapter for Zustand — replaces localStorage (5MB limit → hundreds of MB)
const idbStorage = {
    getItem: async (name) => {
        if (typeof indexedDB === 'undefined') return null;
        try {
            return await get(name);
        } catch {
            return null;
        }
    },
    setItem: async (name, value) => {
        if (typeof indexedDB === 'undefined') return;
        try {
            await set(name, value);
        } catch {
            // Échec d'écriture IndexedDB non bloquant
        }
    },
    removeItem: async (name) => {
        if (typeof indexedDB === 'undefined') return;
        try {
            await del(name);
        } catch {
            // Échec de suppression IndexedDB non bloquant
        }
    },
};

// Global store to share contexts across Phase 2 apps and persist to IndexedDB
const useAppStore = create(
    persist(
        (set, get) => ({
            // --- Shared Data ---
            activeWhatsAppContext: null,
            catalogDraft: null,
            invoiceDraft: null,

            // Phase 21: Global Intelligent Order Listener (IOL) State
            iolInstanceId: null,
            isIolActive: false,
            iolOrders: [],
            iolMessages: [],
            setIolInstanceId: (id) => set({ iolInstanceId: id }),
            setIsIolActive: (active) => set({ isIolActive: active }),
            addIolOrder: (order) => set((state) => ({ iolOrders: [order, ...state.iolOrders].slice(0, 100) })),
            addIolMessage: (msg) => set((state) => ({ iolMessages: [msg, ...state.iolMessages].slice(0, 200) })),
            removeIolOrder: (id) => set((state) => ({ iolOrders: state.iolOrders.filter(o => o.id !== id) })),
            removeIolMessages: (ids) => set((state) => ({
                iolMessages: state.iolMessages.filter(m => !ids.includes(m.id)),
                iolOrders: state.iolOrders.filter(o => !ids.includes(o.id))
            })),
            setIolOrders: (orders) => set({ iolOrders: orders }),
            setIolMessages: (msgs) => set({ iolMessages: msgs }),
            copilotNotification: null,
            appNotification: null,
            updateAvailable: null, // Stores update object if available
            setUpdateAvailable: (status) => set({ updateAvailable: status }),
            
            aiQuota: {
                hasCustomKey: false,
                imageUsed: 0,
                imageLimit: 40,
                resetDate: ''
            },


            // --- WA Analysis (persisted across route changes, reset each session) ---
            waAnalysis: {
                isRunning: false,
                contactStatuses: {}, // { [contactId]: 'loading' | 'valid' | 'invalid' | 'error' }
                totalContacts: 0,
                totalProcessed: 0,
                totalValid: 0,
                totalInvalid: 0,
            },

            // --- Persistent Data ---
            instances: [],
            copilotRepliesGenerated: 0,
            
            // --- Prospecting Data (B2B Leads) ---
            prospectLeads: [],
            prospectSearchQuery: '',
            setProspectSearchQuery: (query) => set((state) => ({ 
                prospectSearchQuery: typeof query === 'function' ? (query(state.prospectSearchQuery) || '') : (query ?? '') 
            })),
            setProspectLeads: (leads) => set((state) => ({ 
                prospectLeads: typeof leads === 'function' ? leads(state.prospectLeads || []) : (leads || []) 
            })),

            // --- Transient Context Actions ---
            setInvoiceDraft: (draft) => set({ invoiceDraft: draft }),
            clearInvoiceDraft: () => set({ invoiceDraft: null }),

            tasks: [],

            userProfile: {
                isAuthenticated: false,
                authMethod: null,
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                companyName: '',
                address: '',
                profilePicture: '',
                companyLogo: ''
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

            // --- Agent Chats & History ---
            agentChats: {},

            aiChatConversations: {},
            aiChatSessions: {},
            agentHistory: [],

            // --- Invoice Builder (Phase 18) ---
            invoices: [],

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

            updateUserProfile: (updates) => set((state) => ({
                userProfile: { ...state.userProfile, ...updates }
            })),

            logoutUser: () => set((state) => ({
                userProfile: { ...state.userProfile, isAuthenticated: false, authMethod: null }
            })),

            setActiveWhatsAppContext: (context) => set({ activeWhatsAppContext: context }),
            setCatalogDraft: (draft) => set({ catalogDraft: draft }),
            clearCatalogDraft: () => set({ catalogDraft: null }),

            setPendingEditImage: (img) => set({ pendingEditImage: img }),
            clearPendingEditImage: () => set({ pendingEditImage: null }),

            setCopilotNotification: (msg) => set({ copilotNotification: msg }),
            clearCopilotNotification: () => set({ copilotNotification: null }),

            showAppNotification: (msg, type = 'success') => {
                set({ appNotification: { msg, type } });
                setTimeout(() => set({ appNotification: null }), 4000);
            },
            clearAppNotification: () => set({ appNotification: null }),

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


            setInstances: (newInstances) => set({ instances: newInstances }),

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

            // --- WA Analysis Actions ---
            startWaAnalysis: (total) => set({
                waAnalysis: {
                    isRunning: true,
                    contactStatuses: {},
                    totalContacts: total,
                    totalProcessed: 0,
                    totalValid: 0,
                    totalInvalid: 0,
                }
            }),

            updateWaContactAnalysis: (contactId, status) => set((state) => {
                const isFinal = status !== 'loading';
                const isPositive = status === 'valid';
                const isNegative = status === 'invalid' || status === 'error';
                return {
                    waAnalysis: {
                        ...state.waAnalysis,
                        contactStatuses: { ...state.waAnalysis.contactStatuses, [contactId]: status },
                        totalProcessed: state.waAnalysis.totalProcessed + (isFinal ? 1 : 0),
                        totalValid: state.waAnalysis.totalValid + (isPositive ? 1 : 0),
                        totalInvalid: state.waAnalysis.totalInvalid + (isNegative ? 1 : 0),
                    }
                };
            }),

            finishWaAnalysis: () => set((state) => ({
                waAnalysis: { ...state.waAnalysis, isRunning: false }
            })),

            resetWaAnalysis: () => set({
                waAnalysis: {
                    isRunning: false,
                    contactStatuses: {},
                    totalContacts: 0,
                    totalProcessed: 0,
                    totalValid: 0,
                    totalInvalid: 0,
                }
            }),

            incrementCopilotReplies: (count = 1) => set((state) => ({
                copilotRepliesGenerated: state.copilotRepliesGenerated + count
            })),

            updateAgentChat: (agentId, updatedChat) => set((state) => ({
                agentChats: {
                    ...state.agentChats,
                    [agentId]: updatedChat
                }
            })),

            updateAiChatConversations: (agentId, messages) => set((state) => ({
                aiChatConversations: {
                    ...state.aiChatConversations,
                    [agentId]: messages
                }
            })),

            updateAiChatSessions: (agentId, sessions) => set((state) => ({
                aiChatSessions: {
                    ...state.aiChatSessions,
                    [agentId]: sessions
                }
            })),

            addAgentHistory: (historyItem) => set((state) => {
                const MAX_HISTORY = 20;
                const updated = [historyItem, ...state.agentHistory];
                return { agentHistory: updated.slice(0, MAX_HISTORY) };
            }),

            removeAgentHistory: (historyId) => set((state) => ({
                agentHistory: state.agentHistory.filter(h => h.id !== historyId)
            })),

            // --- Task Management Actions ---
            addTask: (task) => set((state) => ({
                tasks: [...state.tasks, {
                    description: '',
                    attachments: [],
                    annotations: '',
                    ...task,
                    id: Date.now().toString()
                }]
            })),

            updateTaskStatus: (taskId, newStatus) => set((state) => ({
                tasks: state.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
            })),

            editTask: (taskId, updatedData) => set((state) => ({
                tasks: state.tasks.map(t => t.id === taskId ? { ...t, ...updatedData } : t)
            })),

            deleteTask: (taskId) => set((state) => ({
                tasks: state.tasks.filter(t => t.id !== taskId)
            })),

            // --- Invoice Actions (Phase 18) ---
            addInvoice: (invoice) => set((state) => ({
                invoices: [invoice, ...state.invoices]
            })),

            updateInvoice: (invoiceId, updatedData) => set((state) => ({
                invoices: state.invoices.map(inv => inv.id === invoiceId ? { ...inv, ...updatedData } : inv)
            })),

            deleteInvoice: (invoiceId) => set((state) => ({
                invoices: state.invoices.filter(inv => inv.id !== invoiceId)
            })),
        }),
        {
            name: 'whatsapp-saas-storage',
            storage: createJSONStorage(() => idbStorage),
            // Exclude transient session state from persistence
            // updateAvailable must NOT be persisted — it represents a live check result
            // that should be re-evaluated fresh on each app start from GitHub API.
            // Persisting it caused the stale update banner to persist even on the latest version.
            partialize: (state) => {
                const { waAnalysis, updateAvailable, backendSettings, availableModels, ...rest } = state;
                return rest;
            },
        }
    )
);

export default useAppStore;