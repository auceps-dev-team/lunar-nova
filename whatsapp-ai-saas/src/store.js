import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Global store to share contexts across Phase 2 apps and persist to LocalStorage
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
                { id: '1', title: 'Implement @dnd-kit/core for this exact board format', tag: 'Development', status: 'todo', date: new Date().toISOString().split('T')[0] },
                { id: '2', title: 'Review contract drafted by AI Agent', tag: 'Legal', status: 'todo', date: new Date().toISOString().split('T')[0] },
                { id: '3', title: 'Build React UI layouts for Phase 2 expansion', tag: 'Design', status: 'in-progress', date: new Date().toISOString().split('T')[0] }
            ],

            userProfile: {
                isAuthenticated: false,
                authMethod: null, // 'email' or 'google'
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
                model: 'gemini-1.5-pro',
                allowAiRead: true,
                promptFormat: 'json'
            },

            // --- Agent Chats & History ---
            agentChats: {
                creative: [{ sender: 'agent', text: 'Hello! I am your Visual & Creative Agent. How can I assist you with your workload today?' }],
                legal: [{ sender: 'agent', text: 'Hello! I am your Legal & Admin Agent. How can I assist you with your workload today?' }],
                copywriter: [{ sender: 'agent', text: 'Bonjour ! Je suis l\'Experte en Copywriting de Vente et SDR Senior. Donnez-moi une CIBLE et un OBJECTIF, je vous rédige 3 approches irrésistibles.' }]
            },

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

            addAgentHistory: (historyItem) => set((state) => ({
                agentHistory: [historyItem, ...state.agentHistory]
            })),

            removeAgentHistory: (historyId) => set((state) => ({
                agentHistory: state.agentHistory.filter(h => h.id !== historyId)
            })),

            // --- Task Management Actions ---
            addTask: (task) => set((state) => ({
                tasks: [...state.tasks, { ...task, id: Date.now().toString() }]
            })),

            updateTaskStatus: (taskId, newStatus) => set((state) => ({
                tasks: state.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
            })),

            deleteTask: (taskId) => set((state) => ({
                tasks: state.tasks.filter(t => t.id !== taskId)
            }))
        }),
        {
            name: 'whatsapp-saas-storage', // name of the item in the storage (must be unique)
        }
    )
);

export default useAppStore;
