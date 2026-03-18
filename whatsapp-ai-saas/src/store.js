import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

// IndexedDB storage adapter for Zustand — replaces localStorage (5MB limit → hundreds of MB)
const idbStorage = {
    getItem: (name) => get(name),
    setItem: (name, value) => set(name, value),
    removeItem: (name) => del(name),
};

// Global store to share contexts across Phase 2 apps and persist to IndexedDB
const useAppStore = create(
    persist(
        (set, get) => ({
            // --- Shared Data ---
            activeWhatsAppContext: null,
            catalogDraft: null,
            copilotNotification: null,
            appNotification: null,

            // --- Persistent Data ---
            instances: [],
            copilotRepliesGenerated: 0,
            tasks: [
                { id: '1', title: 'Implement @dnd-kit/core for this exact board format', description: '', attachments: [], annotations: '', tag: 'Development', status: 'todo', date: new Date().toISOString().split('T')[0] },
                { id: '2', title: 'Review contract drafted by AI Agent', description: '', attachments: [], annotations: '', tag: 'Legal', status: 'todo', date: new Date().toISOString().split('T')[0] },
                { id: '3', title: 'Build React UI layouts for Phase 2 expansion', description: '', attachments: [], annotations: '', tag: 'Design', status: 'in-progress', date: new Date().toISOString().split('T')[0] }
            ],

            userProfile: {
                isAuthenticated: false,
                authMethod: null,
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                companyName: '',
                address: ''
            },

            // --- Global Settings ---
            appSettings: {
                theme: 'light',
                language: 'en',
                model: 'gemini-2.5-flash',
                allowAiRead: true,
                promptFormat: 'json'
            },

            // --- Agent Chats & History ---
            agentChats: {
                creative: [{ sender: 'agent', text: 'Hello! I am your Visual & Creative Agent. How can I assist you with your workload today?' }],
                legal: [{ sender: 'agent', text: 'Hello! I am your Legal & Admin Agent. How can I assist you with your workload today?' }],
                copywriter: [{ sender: 'agent', text: "Bonjour ! Je suis l'Experte en Copywriting de Vente et SDR Senior. Donnez-moi une CIBLE et un OBJECTIF, je vous rédige 3 approches irrésistibles." }]
            },

            aiChatConversations: {},
            aiChatSessions: {},
            agentHistory: [],

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

            setCopilotNotification: (msg) => set({ copilotNotification: msg }),
            clearCopilotNotification: () => set({ copilotNotification: null }),

            showAppNotification: (msg, type = 'success') => {
                set({ appNotification: { msg, type } });
                setTimeout(() => set({ appNotification: null }), 4000);
            },
            clearAppNotification: () => set({ appNotification: null }),

            setInstances: (newInstances) => set({ instances: newInstances }),

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
            }))
        }),
        {
            name: 'whatsapp-saas-storage',
            storage: createJSONStorage(() => idbStorage),
        }
    )
);

export default useAppStore;