/**
 * Store — Écouteur de commandes (IOL) : instance suivie, commandes et messages reçus.
 *
 * Slice extraite de src/store.js (constat R5 de l’audit du 29/09/2026), à
 * l’identique. Le store reste unique et persisté sous le même nom : voir
 * src/store.js, qui assemble les slices et porte la persistance.
 */
export const createOrdersSlice = (set) => ({
    // Phase 21: Global Intelligent Order Listener (IOL) State
    iolInstanceId: null,
    isIolActive: false,
    iolOrders: [],
    iolMessages: [],
    setIolInstanceId: (id) => set({ iolInstanceId: id }),
    setIsIolActive: (active) => set({ isIolActive: active }),
    addIolOrder: (order) => set((state) => ({ iolOrders: [order, ...state.iolOrders].slice(0, 100) })),
    addIolMessage: (msg) => set((state) => ({ iolMessages: [msg, ...state.iolMessages].slice(0, 200) })),
    removeIolOrder: (id) => set((state) => ({ iolOrders: state.iolOrders.filter(o => o.id !== id) })),
    removeIolMessages: (ids) => set((state) => ({
        iolMessages: state.iolMessages.filter(m => !ids.includes(m.id)),
        iolOrders: state.iolOrders.filter(o => !ids.includes(o.id))
    })),
    setIolOrders: (orders) => set({ iolOrders: orders }),
    setIolMessages: (msgs) => set({ iolMessages: msgs }),
});
