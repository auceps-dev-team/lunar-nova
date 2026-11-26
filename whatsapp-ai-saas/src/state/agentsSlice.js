/**
 * Store — Conversations et historique des agents IA.
 *
 * Slice extraite de src/store.js (constat R5 de l’audit du 29/09/2026), à
 * l’identique. Le store reste unique et persisté sous le même nom : voir
 * src/store.js, qui assemble les slices et porte la persistance.
 */
export const createAgentsSlice = (set) => ({
    // --- Agent Chats & History ---
    agentChats: {},

    aiChatConversations: {},
    aiChatSessions: {},
    // agentHistory (historique des images générées) a disparu avec la
    // génération d'image : voir OBSOLETE_PERSISTED_KEYS dans src/store.js.

    updateAgentChat: (agentId, updatedChat) => set((state) => ({
        agentChats: {
            ...state.agentChats,
            [agentId]: updatedChat
        }
    })),

    updateAiChatConversations: (agentId, messages) => set((state) => ({
        aiChatConversations: {
            ...state.aiChatConversations,
            [agentId]: messages
        }
    })),

    updateAiChatSessions: (agentId, sessions) => set((state) => ({
        aiChatSessions: {
            ...state.aiChatSessions,
            [agentId]: sessions
        }
    })),
});
