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
            invoiceDraft: null,
            copilotNotification: null,
            appNotification: null,
            updateAvailable: null, // Stores update object if available
            setUpdateAvailable: (status) => set({ updateAvailable: status }),

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

            // --- Transient Context Actions ---
            setInvoiceDraft: (draft) => set({ invoiceDraft: draft }),

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
                promptFormat: 'json'
            },

            // --- Agent Chats & History ---
            agentChats: {},

            aiChatConversations: {},
            aiChatSessions: {},
            agentHistory: [],

            // --- Invoice Builder (Phase 18) ---
            invoices: [],

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

            setInstances: (newInstances) => set({ instances: newInstances }),

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
            partialize: (state) => {
                const { waAnalysis, ...rest } = state;
                return rest;
            },
        }
    )
);

export default useAppStore;