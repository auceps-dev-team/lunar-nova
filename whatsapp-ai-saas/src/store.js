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
            agentChats: {
                legal: [{ sender: 'agent', text: 'Hello! I am your Legal & Admin Agent. How can I assist you with your workload today?' }],
                copywriter: [{ sender: 'agent', text: "Bonjour ! Je suis l'Experte en Copywriting de Vente et SDR Senior. Donnez-moi une CIBLE et un OBJECTIF, je vous rédige 3 approches irrésistibles." }],
                ella: [{ sender: 'agent', text: 'Hello! I am Ella, your Life Architect. How can I help you organize your tasks today?' }],
                brand_guardian: [{ sender: 'agent', text: 'Hello! I am Claris, your Brand Guardian. How can I help protect and grow your brand identity today?' }],
                paid_social_strategist: [{ sender: 'agent', text: 'Hello! I am Marc, your Paid Social Strategist. Ready to optimize your ad spend?' }],
                ad_creative_strategist: [{ sender: 'agent', text: 'Hello! I am Léa, your Ad Creative Strategist. Let’s create ads that convert.' }],
                outbound_strategist: [{ sender: 'agent', text: 'Hello! I am Antoine, your Outbound Strategist. Ready to scale your prospecting?' }],
                sales_engineer: [{ sender: 'agent', text: 'Hello! I am Christ, your Sales Engineer. How can I help with your technical discovery?' }],
                sales_coach: [{ sender: 'agent', text: 'Hello! I am Camille, your Sales Coach. Ready to master the psychology of the sale?' }],
                growth_hacker: [{ sender: 'agent', text: 'Hello! I am Julien, your Growth Hacker. Let’s find your next big growth lever.' }],
                content_creator: [{ sender: 'agent', text: 'Hello! I am Sophie, your Content Creator. What story are we telling today?' }],
                twitter_engager: [{ sender: 'agent', text: 'Hello! I am Théo, your Twitter Engager. Ready to build your authority 280 characters at a time?' }],
                tiktok_strategist: [{ sender: 'agent', text: 'Hello! I am Inès, your TikTok Strategist. Let’s make your brand go viral.' }],
                instagram_curator: [{ sender: 'agent', text: 'Hello! I am Lucas, your Instagram Curator. Ready to master your visual aesthetic?' }],
                social_media_strategist: [{ sender: 'agent', text: 'Hello! I am Manon, your Social Media Strategist. Let’s drive organic performance.' }],
                seo_specialist: [{ sender: 'agent', text: 'Hello! I am Romain, your SEO Specialist. Ready to climb the SERP rankings?' }],
                podcast_strategist: [{ sender: 'agent', text: 'Hello! I am Elodie, your Podcast Strategist. How can I help with your audio content strategy?' }],
                support_responder: [{ sender: 'agent', text: 'Hello! I am Karim, your Support Responder. How can I help resolve customer issues today?' }],
                legal_compliance: [{ sender: 'agent', text: 'Hello! I am Aicha, your Legal Compliance Checker. Is your business staying compliant?' }],
                account_strategist: [{ sender: 'agent', text: 'Hello! I am Maël, your Account Strategist. Ready to expand your account relationships?' }],
            },

            aiChatConversations: {},
            aiChatSessions: {},
            agentHistory: [],

            // --- Invoice Builder (Phase 18) ---
            invoices: [
                {
                    id: 'inv-001',
                    invoiceNumber: '#INV-2025-001',
                    clientName: 'Acme Corporation',
                    clientEmail: 'billing@acme.com',
                    clientAddress: '123 Main St, Paris, France',
                    issueDate: '2025-01-10',
                    dueDate: '2025-02-10',
                    items: [
                        { id: 'i1', description: 'Social Media Strategy Q1', qty: 1, price: 1500 },
                        { id: 'i2', description: 'Monthly Consultation', qty: 5, price: 120 },
                    ],
                    taxRate: 20,
                    notes: 'Merci pour votre confiance.',
                    status: 'paid',
                    template: 'classic',
                    currency: 'EUR',
                    createdAt: '2025-01-10T10:00:00Z',
                },
                {
                    id: 'inv-002',
                    invoiceNumber: '#INV-2025-002',
                    clientName: 'Starlight Agency',
                    clientEmail: 'finance@starlight.io',
                    clientAddress: '456 Rue de Rivoli, Paris, France',
                    issueDate: '2025-02-05',
                    dueDate: '2025-03-05',
                    items: [
                        { id: 'i3', description: 'Landing Page Copywriting', qty: 1, price: 850 },
                        { id: 'i4', description: 'SEO Audit Report', qty: 1, price: 600 },
                    ],
                    taxRate: 20,
                    notes: '',
                    status: 'pending',
                    template: 'modern',
                    currency: 'EUR',
                    createdAt: '2025-02-05T09:00:00Z',
                },
                {
                    id: 'inv-003',
                    invoiceNumber: '#INV-2025-003',
                    clientName: 'Nexus Tech',
                    clientEmail: 'pay@nexus.io',
                    clientAddress: '789 Tech Park, Lyon, France',
                    issueDate: '2025-03-01',
                    dueDate: '2025-03-31',
                    items: [
                        { id: 'i5', description: 'Brand Identity Design', qty: 1, price: 2200 },
                    ],
                    taxRate: 20,
                    notes: 'Paiement à 30 jours.',
                    status: 'overdue',
                    template: 'classic',
                    currency: 'EUR',
                    createdAt: '2025-03-01T11:00:00Z',
                },
            ],

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