import { API_BASE_URL } from '../config';

/**
 * Store — Devis et factures (reflet du backend, table quotes).
 *
 * Slice extraite de src/store.js (constat R5 de l’audit du 29/09/2026), à
 * l’identique. Le store reste unique et persisté sous le même nom : voir
 * src/store.js, qui assemble les slices et porte la persistance.
 */
export const createInvoicesSlice = (set) => ({
    // --- Invoice Builder (Phase 18) ---
    invoices: [],

    // --- Invoice Actions (Phase 18) ---
    // Migrées vers le backend (table `quotes`) pour être lisibles/pilotables
    // par le CLI/MCP — le store ne fait plus que refléter la réponse serveur.
    fetchInvoices: async () => {
        try {
            const res = await fetch(API_BASE_URL + '/api/invoices');
            const json = await res.json();
            if (json.status === 'success') {
                set({ invoices: json.data || [] });
            }
        } catch {
            // Échec réseau non bloquant : le store garde son dernier état connu.
        }
    },

    addInvoice: async (invoice) => {
        const res = await fetch(API_BASE_URL + '/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invoice)
        });
        const json = await res.json();
        if (json.status === 'success') {
            set((state) => ({ invoices: [json.data, ...state.invoices] }));
        }
        return json.data;
    },

    updateInvoice: async (invoiceId, updatedData) => {
        const res = await fetch(API_BASE_URL + '/api/invoices/' + invoiceId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        const json = await res.json();
        if (json.status === 'success') {
            set((state) => ({
                invoices: state.invoices.map(inv => inv.id === invoiceId ? json.data : inv)
            }));
        }
        return json.data;
    },

    deleteInvoice: async (invoiceId) => {
        await fetch(API_BASE_URL + '/api/invoices/' + invoiceId, { method: 'DELETE' });
        set((state) => ({
            invoices: state.invoices.filter(inv => inv.id !== invoiceId)
        }));
    },
});
