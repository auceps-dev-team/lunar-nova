/**
 * Store — Prospection B2B : leads et requête en cours.
 *
 * Slice extraite de src/store.js (constat R5 de l’audit du 29/09/2026), à
 * l’identique. Le store reste unique et persisté sous le même nom : voir
 * src/store.js, qui assemble les slices et porte la persistance.
 */
export const createProspectingSlice = (set) => ({
    // --- Prospecting Data (B2B Leads) ---
    prospectLeads: [],
    prospectSearchQuery: '',
    setProspectSearchQuery: (query) => set((state) => ({ 
        prospectSearchQuery: typeof query === 'function' ? (query(state.prospectSearchQuery) || '') : (query ?? '') 
    })),
    setProspectLeads: (leads) => set((state) => ({ 
        prospectLeads: typeof leads === 'function' ? leads(state.prospectLeads || []) : (leads || []) 
    })),
});
