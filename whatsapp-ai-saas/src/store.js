import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Global store to share contexts across Phase 2 apps and persist to LocalStorage
const useAppStore = create(
    persist(
        (set, get) => ({
            // --- Shared Data ---
            activeWhatsAppContext: null,

            // --- Persistent Data (Instances & Dashboard Metrics) ---
            instances: [],
            copilotRepliesGenerated: 0,

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
                allowAiRead: true
            },

            // --- Agent Chats ---
            agentChats: {
                creative: [{ sender: 'agent', text: 'Hello! I am your Visual & Creative Agent. How can I assist you with your workload today?' }],
                legal: [{ sender: 'agent', text: 'Hello! I am your Legal & Admin Agent. How can I assist you with your workload today?' }],
                copywriter: [{ sender: 'agent', text: 'Bonjour ! Je suis l\'Experte en Copywriting de Vente et SDR Senior. Donnez-moi une CIBLE et un OBJECTIF, je vous rédige 3 approches irrésistibles.' }]
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

            setInstances: (newInstances) => set({ instances: newInstances }),

            incrementCopilotReplies: (count = 1) => set((state) => ({
                copilotRepliesGenerated: state.copilotRepliesGenerated + count
            })),

            updateAgentChat: (agentId, updatedChat) => set((state) => ({
                agentChats: {
                    ...state.agentChats,
                    [agentId]: updatedChat
                }
            }))
        }),
        {
            name: 'whatsapp-saas-storage', // name of the item in the storage (must be unique)
        }
    )
);

export default useAppStore;
