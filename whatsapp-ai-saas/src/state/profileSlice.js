/**
 * Store — Profil utilisateur.
 *
 * Slice extraite de src/store.js (constat R5 de l’audit du 29/09/2026). Le
 * store reste unique et persisté sous le même nom : voir src/store.js, qui
 * assemble les slices et porte la persistance.
 *
 * Plus de connexion (retrait de Google, 26/11/2026) : isAuthenticated,
 * authMethod et logoutUser ont disparu. Les profils persistés qui les portent
 * encore les gardent sans effet — plus rien ne les lit.
 */
export const createProfileSlice = (set) => ({
    userProfile: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        companyName: '',
        address: '',
        profilePicture: '',
        companyLogo: ''
    },

    updateUserProfile: (updates) => set((state) => ({
        userProfile: { ...state.userProfile, ...updates }
    })),
});
