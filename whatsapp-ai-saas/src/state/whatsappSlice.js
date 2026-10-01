/**
 * Store — Instances WhatsApp et analyse des contacts.
 *
 * Slice extraite de src/store.js (constat R5 de l’audit du 29/09/2026), à
 * l’identique. Le store reste unique et persisté sous le même nom : voir
 * src/store.js, qui assemble les slices et porte la persistance.
 */
export const createWhatsappSlice = (set) => ({
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
});
