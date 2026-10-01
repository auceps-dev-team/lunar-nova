/**
 * Store — Tâches.
 *
 * Slice extraite de src/store.js (constat R5 de l’audit du 29/09/2026), à
 * l’identique. Le store reste unique et persisté sous le même nom : voir
 * src/store.js, qui assemble les slices et porte la persistance.
 */
export const createTasksSlice = (set) => ({
    tasks: [],

    // --- Task Management Actions ---
    addTask: (task) => set((state) => ({
        tasks: [...state.tasks, {
            description: '',
            attachments: [],
            annotations: '',
            ...task,
            id: Date.now().toString()
        }]
    })),

    updateTaskStatus: (taskId, newStatus) => set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
    })),

    editTask: (taskId, updatedData) => set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, ...updatedData } : t)
    })),

    deleteTask: (taskId) => set((state) => ({
        tasks: state.tasks.filter(t => t.id !== taskId)
    })),
});
