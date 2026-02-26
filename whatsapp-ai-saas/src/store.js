import { create } from 'zustand';

// Global store to share contexts across Phase 2 apps
const useAppStore = create((set) => ({
    // Shared Data
    activeWhatsAppContext: null,

    // Actions
    setActiveWhatsAppContext: (context) => set({ activeWhatsAppContext: context }),
}));

export default useAppStore;
