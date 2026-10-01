/**
 * Store — Contexte partagé entre écrans : conversation active, brouillons.
 *
 * Slice extraite de src/store.js (constat R5 de l’audit du 29/09/2026), à
 * l’identique. Le store reste unique et persisté sous le même nom : voir
 * src/store.js, qui assemble les slices et porte la persistance.
 */
export const createContextSlice = (set) => ({
    // --- Shared Data ---
    activeWhatsAppContext: null,
    catalogDraft: null,
    invoiceDraft: null,

    // --- Transient Context Actions ---
    setInvoiceDraft: (draft) => set({ invoiceDraft: draft }),
    clearInvoiceDraft: () => set({ invoiceDraft: null }),

    setActiveWhatsAppContext: (context) => set({ activeWhatsAppContext: context }),
    setCatalogDraft: (draft) => set({ catalogDraft: draft }),
    clearCatalogDraft: () => set({ catalogDraft: null }),

    setPendingEditImage: (img) => set({ pendingEditImage: img }),
    clearPendingEditImage: () => set({ pendingEditImage: null }),
});
