import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { createContextSlice } from './state/contextSlice';
import { createOrdersSlice } from './state/ordersSlice';
import { createNotificationsSlice } from './state/notificationsSlice';
import { createSettingsSlice } from './state/settingsSlice';
import { createWhatsappSlice } from './state/whatsappSlice';
import { createProspectingSlice } from './state/prospectingSlice';
import { createProfileSlice } from './state/profileSlice';
import { createAgentsSlice } from './state/agentsSlice';
import { createTasksSlice } from './state/tasksSlice';
import { createInvoicesSlice } from './state/invoicesSlice';


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
        // Slices thématiques (constat R5 de l’audit du 29/09/2026). Le store reste
        // unique : les clés, l’état initial et les clés persistées sont ceux
        // d’avant le découpage.
        (set, get) => ({
            ...createContextSlice(set, get),
            ...createOrdersSlice(set, get),
            ...createNotificationsSlice(set, get),
            ...createSettingsSlice(set, get),
            ...createWhatsappSlice(set, get),
            ...createProspectingSlice(set, get),
            ...createProfileSlice(set, get),
            ...createAgentsSlice(set, get),
            ...createTasksSlice(set, get),
            ...createInvoicesSlice(set, get),
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