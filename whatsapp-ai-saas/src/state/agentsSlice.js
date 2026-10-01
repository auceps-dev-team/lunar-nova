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
    agentHistory: [],

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

    addAgentHistory: (historyItem) => set((state) => {
        const MAX_HISTORY = 20;
        const updated = [historyItem, ...state.agentHistory];
        return { agentHistory: updated.slice(0, MAX_HISTORY) };
    }),

    removeAgentHistory: (historyId) => set((state) => ({
        agentHistory: state.agentHistory.filter(h => h.id !== historyId)
    })),
});
