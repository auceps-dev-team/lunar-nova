import React, { useState } from 'react';
import useAppStore from '../store';
import { getTranslation as t } from '../locales';
import { DndContext, closestCorners, TouchSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Sortable Task Item Component ---
const SortableTask = ({ task, onEdit, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none'
    };

    const getTagColor = (tag) => {
        const colors = {
            'Development': '#10b981',
            'Legal': '#0b9f84',
            'Design': '#0d9488',
            'Marketing': '#f59e0b',
            'Sales': '#ef4444'
        };
        return colors[tag] || '#64748b';
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="group bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-grab relative hover:shadow-md transition-all"
        >
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10 bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                    title="Edit Task"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    title="Delete Task"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: getTagColor(task.tag) }}>
                {task.tag}
            </div>
            <div className="font-semibold text-gray-900 dark:text-white text-sm mb-2 leading-snug">{task.title}</div>
            
            {task.description && (
                <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                    {task.description.replace(/<[^>]+>/g, '') /* Strip HTML for preview */}
                </div>
            )}

            <div className="flex flex-wrap gap-2 mb-3">
               {task.attachments && task.attachments.length > 0 && (
                   <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-[10px] font-medium px-2 py-0.5 rounded-md">
                       <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                       {task.attachments.length} files
                   </span>
               )}
               {task.annotations && (
                   <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-[10px] font-medium px-2 py-0.5 rounded-md">
                       <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                       Notes
                   </span>
               )}
            </div>

            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50 dark:border-gray-700/50">
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    {task.date}
                </div>
                {/* Placeholder Avatar */}
                <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-700 border border-white dark:border-gray-800">
                    JO
                </div>
            </div>
        </div>
    );
};

// --- Task Column Component ---
const TaskColumn = ({ id, title, defaultCount, color, tasks, onEdit, onDelete }) => {
    return (
        <div style={{ minWidth: '320px', flex: 1, background: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }}></div>
                    <span style={{ fontWeight: 600 }}>{title}</span>
                </div>
                <span style={{ background: 'var(--bg-color)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {tasks.length}
                </span>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '400px' }}>
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy} id={id}>
                    {tasks.map(task => (
                        <SortableTask key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                    {tasks.length === 0 && (
                        <div style={{ width: '100%', height: '100%', minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No tasks here</span>
                        </div>
                    )}
                </SortableContext>
            </div>
        </div>
    );
};

const TasksMap = () => {
    const language = useAppStore(state => state.appSettings?.language) || 'en';
    const tasks = useAppStore(state => state.tasks) || [];
    const addTask = useAppStore(state => state.addTask);
    const updateTaskStatus = useAppStore(state => state.updateTaskStatus);
    const editTask = useAppStore(state => state.editTask);
    const deleteTask = useAppStore(state => state.deleteTask);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const [isEllaOpen, setIsEllaOpen] = useState(false);
    const [ellaInput, setEllaInput] = useState('');
    const [ellaHistory, setEllaHistory] = useState([
        { sender: 'agent', text: 'Bonjour ! Je suis Ella, votre Life Architect. Dites-moi ce que vous avez en tête, je m\'occupe de structurer tout ça dans votre planning.' }
    ]);

    const defaultFormState = {
        title: '',
        tag: 'Development',
        date: new Date().toISOString().split('T')[0],
        status: 'todo',
        description: '',
        annotations: ''
    };
    
    const [taskForm, setTaskForm] = useState(defaultFormState);

    const [viewMode, setViewMode] = useState('board'); // 'board' or 'calendar'
    const [currentDate, setCurrentDate] = useState(new Date());

    // Dnd sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over) return;

        const taskId = active.id;
        // determine over container if we drop on another item or empty space
        let destContainerId = over.id;

        // If dropped over a task, find its status
        if (destContainerId !== 'todo' && destContainerId !== 'in-progress' && destContainerId !== 'completed') {
            const overTask = tasks.find(t => t.id === destContainerId);
            if (overTask) destContainerId = overTask.status;
        }

        const task = tasks.find(t => t.id === taskId);
        if (task && destContainerId && destContainerId !== task.status) {
            updateTaskStatus(taskId, destContainerId);
        }
    };

    const handleSaveTask = (e) => {
        e.preventDefault();
        if (!taskForm.title.trim()) return;

        if (editingTaskId) {
            editTask(editingTaskId, taskForm);
        } else {
            addTask(taskForm);
        }

        setIsFormOpen(false);
    };

    const handleOpenAddForm = () => {
        setTaskForm(defaultFormState);
        setEditingTaskId(null);
        setIsFormOpen(true);
    };

    const handleOpenEditForm = (task) => {
        setTaskForm({
            title: task.title || '',
            tag: task.tag || 'Development',
            date: task.date || new Date().toISOString().split('T')[0],
            status: task.status || 'todo',
            description: task.description || '',
            annotations: task.annotations || ''
        });
        setEditingTaskId(task.id);
        setIsFormOpen(true);
    };

    const handleAIAssist = async () => {
        if (!taskForm.description) return;
        setIsAiLoading(true);
        try {
            const prompt = `Refine and expand the following task description to make it professional and clear. Here is the draft: \n\n${taskForm.description}`;
            const res = await fetch('http://127.0.0.1:3000/api/ai/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: prompt, personaId: 'ella' })
            });
            const data = await res.json();
            
            // Ella will respond in JSON { text: "...", actions: [] } or raw JSON.
            let improvedText = '';
            try {
                const parsed = JSON.parse(data.response);
                improvedText = parsed.text || data.response;
            } catch(e) {
                improvedText = data.response;
            }

            setTaskForm(prev => ({ ...prev, description: improvedText }));
        } catch (error) {
            console.error('AI Assist error:', error);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleEllaSubmit = async (e) => {
        e.preventDefault();
        if (!ellaInput.trim()) return;

        const userMessage = ellaInput.trim();
        setEllaHistory(prev => [...prev, { sender: 'user', text: userMessage }]);
        setEllaInput('');
        setIsAiLoading(true);

        try {
            const promptContext = `[CURRENT_TASKS]: ${JSON.stringify(tasks)}\n\nUser instruction: ${userMessage}`;
            const res = await fetch('http://127.0.0.1:3000/api/ai/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: promptContext, personaId: 'ella' })
            });
            const data = await res.json();
            
            let replyText = data.response;
            try {
                // Sometime Gemini wraps JSON in markdown block ```json ... ```
                let rawRes = data.response;
                if (rawRes.startsWith('\`\`\`json')) {
                    rawRes = rawRes.replace(/^\`\`\`json\s*/, '').replace(/\s*\`\`\`$/, '');
                } else if (rawRes.startsWith('\`\`\`')) {
                     rawRes = rawRes.replace(/^\`\`\`\s*/, '').replace(/\s*\`\`\`$/, '');
                }

                const parsed = JSON.parse(rawRes);
                if (parsed.text) replyText = parsed.text;
                
                if (parsed.actions && Array.isArray(parsed.actions)) {
                    parsed.actions.forEach(action => {
                        if (action.type === 'ADD_TASK') {
                            addTask(action.payload);
                        } else if (action.type === 'UPDATE_TASK') {
                            editTask(action.payload.id, action.payload);
                        } else if (action.type === 'DELETE_TASK') {
                            deleteTask(action.payload.id);
                        }
                    });
                }
            } catch(e) {
                console.error('Ella JSON parse error:', e);
            }

            setEllaHistory(prev => [...prev, { sender: 'agent', text: replyText }]);
        } catch (error) {
            console.error('Ella error:', error);
            setEllaHistory(prev => [...prev, { sender: 'agent', text: 'Désolé, je rencontre un problème de connexion.' }]);
        } finally {
            setIsAiLoading(false);
        }
    };

    const todoTasks = tasks.filter(t => t.status === 'todo');
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
    const completedTasks = tasks.filter(t => t.status === 'completed');

    return (
        <div className="flex-1 overflow-y-auto" style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>{t(language, 'taskManagement')}</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>{t(language, 'taskDesc')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex items-center">
                        <button
                            onClick={() => setViewMode('board')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'board' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                        >
                            Board
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                        >
                            Calendar
                        </button>
                    </div>
                    <button className="btn-primary" onClick={handleOpenAddForm} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        {t(language, 'newTask')}
                    </button>
                </div>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingTaskId ? 'Edit Task' : 'Add New Task'}
                            </h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSaveTask} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Title</label>
                                <input
                                    type="text"
                                    value={taskForm.title}
                                    onChange={e => setTaskForm({...taskForm, title: e.target.value})}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                    placeholder="Task title..."
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category / Label</label>
                                    <select
                                        value={taskForm.tag}
                                        onChange={e => setTaskForm({...taskForm, tag: e.target.value})}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="Development">Development</option>
                                        <option value="Design">Design</option>
                                        <option value="Legal">Legal</option>
                                        <option value="Marketing">Marketing</option>
                                        <option value="Sales">Sales</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                    <select
                                        value={taskForm.status}
                                        onChange={e => setTaskForm({...taskForm, status: e.target.value})}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="todo">To Do</option>
                                        <option value="in-progress">In Progress</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        value={taskForm.date}
                                        onChange={e => setTaskForm({...taskForm, date: e.target.value})}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Visual Media & Files (Images, PDFs)</label>
                                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                    <p className="text-sm font-medium">Drag and drop files here or click to upload</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rich text description</label>
                                <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
                                    <div className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-300 dark:border-gray-600 px-3 py-2 flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            {/* Dummy rich text toolbar icons */}
                                            <button type="button" className="p-1 text-gray-600 hover:bg-gray-200 rounded dark:text-gray-300 dark:hover:bg-gray-600"><b className="font-serif font-bold">B</b></button>
                                            <button type="button" className="p-1 text-gray-600 hover:bg-gray-200 rounded dark:text-gray-300 dark:hover:bg-gray-600"><i className="font-serif italic">I</i></button>
                                            <button type="button" className="p-1 text-gray-600 hover:bg-gray-200 rounded dark:text-gray-300 dark:hover:bg-gray-600"><u className="font-serif underline">U</u></button>
                                            <div className="w-px h-4 bg-gray-300 mx-1"></div>
                                            <button type="button" className="p-1 text-gray-600 hover:bg-gray-200 rounded dark:text-gray-300 dark:hover:bg-gray-600">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                                            </button>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={handleAIAssist}
                                            disabled={isAiLoading}
                                            className="px-3 py-1 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 text-xs font-bold rounded-md hover:bg-teal-100 flex items-center gap-1 transition-colors"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
                                            {isAiLoading ? 'Writing...' : 'AI Assist'}
                                        </button>
                                    </div>
                                    <textarea
                                        value={taskForm.description}
                                        onChange={e => setTaskForm({...taskForm, description: e.target.value})}
                                        className="w-full p-3 h-32 text-sm focus:outline-none dark:bg-gray-700 dark:text-white resize-none"
                                        placeholder="Add more details about this task..."
                                    ></textarea>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add Collaborative Annotation</label>
                                <input
                                    type="text"
                                    value={taskForm.annotations}
                                    onChange={e => setTaskForm({...taskForm, annotations: e.target.value})}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                    placeholder="Add Collaborative Annotation"
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
                                <button type="submit" className="btn-primary" disabled={!taskForm.title.trim()}>
                                    {editingTaskId ? 'Save Changes' : 'Create Task'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {viewMode === 'board' ? (
                <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                    <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '20px' }}>
                        <TaskColumn id="todo" title={t(language, 'toDo')} color="#f59e0b" tasks={todoTasks} onEdit={handleOpenEditForm} onDelete={deleteTask} />
                        <TaskColumn id="in-progress" title={t(language, 'inProgress')} color="#0b9f84" tasks={inProgressTasks} onEdit={handleOpenEditForm} onDelete={deleteTask} />
                        <TaskColumn id="completed" title={t(language, 'completed')} color="#10b981" tasks={completedTasks} onEdit={handleOpenEditForm} onDelete={deleteTask} />
                    </div>
                </DndContext>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {/* Calendar Header */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm font-medium shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                                Today
                            </button>
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                    </div>
                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-2">
                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                    </div>
                    <div className="grid grid-cols-7 auto-rows-[120px]">
                        {(() => {
                            const year = currentDate.getFullYear();
                            const month = currentDate.getMonth();
                            const firstDay = new Date(year, month, 1);
                            const lastDay = new Date(year, month + 1, 0);
                            const daysInMonth = lastDay.getDate();
                            const startingDay = firstDay.getDay(); // 0 = Sun
                            const cells = [];

                            // Empty cells for days before the 1st
                            for (let i = 0; i < startingDay; i++) {
                                cells.push(<div key={`empty-${i}`} className="border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30"></div>);
                            }

                            // Cells for days of the month
                            for (let i = 1; i <= daysInMonth; i++) {
                                const currentCellDate = new Date(year, month, i);
                                // Local date string in YYYY-MM-DD format based on local timezone
                                const dateString = new Date(currentCellDate.getTime() - (currentCellDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

                                const isToday = new Date().toISOString().split('T')[0] === dateString;
                                const dayTasks = tasks.filter(t => t.date === dateString);

                                cells.push(
                                    <div key={`day-${i}`} className={`border-b border-r border-gray-200 dark:border-gray-700 p-2 flex flexDirection-column ${isToday ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}>{i}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-1 mt-1 pr-1 custom-scrollbar">
                                            {dayTasks.map(task => (
                                                <div key={task.id} className="text-[10px] truncate px-1.5 py-1 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm" title={task.title}>
                                                    <span style={{ color: task.status === 'completed' ? '#10b981' : task.status === 'in-progress' ? '#0b9f84' : '#f59e0b', marginRight: '4px' }}>•</span>
                                                    {task.title}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }
                            return cells;
                        })()}
                    </div>
                </div>
            )}

            {/* Ella Floating Button */}
            <button
                onClick={() => setIsEllaOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-40"
                title="Talk to Ella"
            >
                <div className="text-2xl">🧠</div>
            </button>

            {/* Ella Chat Panel */}
            <div className={`fixed top-0 right-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isEllaOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-200 dark:bg-emerald-800 flex items-center justify-center text-xl">🧠</div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white leading-tight">Ella</h3>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Life Architect</p>
                        </div>
                    </div>
                    <button onClick={() => setIsEllaOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Chat History */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {ellaHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm'}`}>
                                {msg.text.split('\\n').map((line, idx) => (
                                    <React.Fragment key={idx}>{line}<br/></React.Fragment>
                                ))}
                            </div>
                        </div>
                    ))}
                    {isAiLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"></div>
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{animationDelay: '0.2s'}}></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input form */}
                <form onSubmit={handleEllaSubmit} className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <div className="relative">
                        <input
                            type="text"
                            value={ellaInput}
                            onChange={(e) => setEllaInput(e.target.value)}
                            placeholder="Delegate a task to Ella..."
                            className="w-full pl-4 pr-12 py-3 bg-gray-100 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white"
                        />
                        <button
                            type="submit"
                            disabled={!ellaInput.trim() || isAiLoading}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TasksMap;
