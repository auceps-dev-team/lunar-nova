/**
 * Store — Notifications et mise à jour disponible.
 *
 * Slice extraite de src/store.js (constat R5 de l’audit du 29/09/2026), à
 * l’identique. Le store reste unique et persisté sous le même nom : voir
 * src/store.js, qui assemble les slices et porte la persistance.
 */
export const createNotificationsSlice = (set) => ({
    copilotNotification: null,
    appNotification: null,
    updateAvailable: null, // Stores update object if available
    setUpdateAvailable: (status) => set({ updateAvailable: status }),
    
    setCopilotNotification: (msg) => set({ copilotNotification: msg }),
    clearCopilotNotification: () => set({ copilotNotification: null }),

    showAppNotification: (msg, type = 'success') => {
        set({ appNotification: { msg, type } });
        setTimeout(() => set({ appNotification: null }), 4000);
    },
    clearAppNotification: () => set({ appNotification: null }),
});
