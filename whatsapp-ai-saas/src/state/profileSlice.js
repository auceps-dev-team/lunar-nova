/**
 * Store — Profil utilisateur.
 *
 * Slice extraite de src/store.js (constat R5 de l’audit du 29/09/2026), à
 * l’identique. Le store reste unique et persisté sous le même nom : voir
 * src/store.js, qui assemble les slices et porte la persistance.
 */
export const createProfileSlice = (set) => ({
    userProfile: {
        isAuthenticated: false,
        authMethod: null,
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

    logoutUser: () => set((state) => ({
        userProfile: { ...state.userProfile, isAuthenticated: false, authMethod: null }
    })),
});
