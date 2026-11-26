/**
 * Store — Notifications et mise à jour disponible.
 *
 * Slice extraite de src/store.js (constat R5 de l’audit du 29/09/2026), à
 * l’identique. Le store reste unique et persisté sous le même nom : voir
 * src/store.js, qui assemble les slices et porte la persistance.
 */

/** Durée d'affichage d'une notification, comptée depuis SON affichage. */
export const APP_NOTIFICATION_MS = 4000;

export const createNotificationsSlice = (set) => {
    // Jusqu'au 26/11/2026, chaque notification lançait son minuteur sans
    // annuler le précédent : le minuteur d'une notification antérieure
    // effaçait la suivante avant l'heure. Mesuré dans l'application
    // construite : « le texte réécrit est dans le presse-papiers » restait
    // affiché 0,3 s, effacé par le minuteur de « Réécriture en cours ».
    let minuteur = null;
    const arreter = () => {
        if (minuteur) clearTimeout(minuteur);
        minuteur = null;
    };

    return {
        copilotNotification: null,
        appNotification: null,
        updateAvailable: null, // Stores update object if available
        setUpdateAvailable: (status) => set({ updateAvailable: status }),

        setCopilotNotification: (msg) => set({ copilotNotification: msg }),
        clearCopilotNotification: () => set({ copilotNotification: null }),

        showAppNotification: (msg, type = 'success') => {
            arreter();
            set({ appNotification: { msg, type } });
            minuteur = setTimeout(() => {
                minuteur = null;
                set({ appNotification: null });
            }, APP_NOTIFICATION_MS);
        },
        clearAppNotification: () => {
            arreter();
            set({ appNotification: null });
        },
    };
};
