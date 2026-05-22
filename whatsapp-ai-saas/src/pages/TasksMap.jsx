import React, { useState, useRef, useEffect } from 'react';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';
import {
    DndContext,
    closestCorners,
    DragOverlay,
    TouchSensor,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// --- Tag colour mapping ---
const TAG_COLORS = {
    'Development': '#10b981',
    'Legal': '#0b9f84',
    'Design': '#0d9488',
    'Marketing': '#f59e0b',
    'Sales': '#ef4444'
};
const getTagColor = (tag) => TAG_COLORS[tag] || '#64748b';

// --- Sortable Task Card ---
const SortableTask = ({ task, onEdit, onDelete, t }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 200ms ease',
        opacity: isDragging ? 0 : 1,
        touchAction: 'none',
        userSelect: 'none',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="group bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-grab relative hover:shadow-md transition-shadow"
        >
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10 bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
                    title={t('editTask')}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    title={t('deleteTask')}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: getTagColor(task.tag) }}>
                {task.tag}
            </div>
            <div className="font-semibold text-gray-900 dark:text-white text-sm mb-2 leading-snug pr-12">{task.title}</div>

            {task.description && (
                <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                    {task.description}
                </div>
            )}

            {task.annotations && (
                <div className="flex flex-wrap gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 text-[10px] font-medium px-2 py-0.5 rounded-md">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        {t('note')}
                    </span>
                </div>
            )}

            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50 dark:border-gray-700/50">
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    {task.date || '—'}
                </div>
                <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-700 border border-white dark:border-gray-800">
                    JO
                </div>
            </div>
        </div>
    );
};

// Ghost card shown during overlay (non-sortable copy)
const TaskGhost = ({ task }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-xl border-2 border-emerald-400 opacity-95 rotate-2"
        style={{ minWidth: 200, maxWidth: 280 }}>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: getTagColor(task.tag) }}>{task.tag}</div>
        <div className="font-semibold text-gray-900 dark:text-white text-sm">{task.title}</div>
    </div>
);

// --- Droppable Column ---
const TaskColumn = ({ id, title, color, tasks, onEdit, onDelete, t }) => {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div style={{
            minWidth: '300px', flex: 1,
            background: isOver ? 'color-mix(in srgb, var(--panel-bg) 85%, #10b981 15%)' : 'var(--panel-bg)',
            borderRadius: '12px',
            border: isOver ? '2px solid #10b98166' : '1px solid var(--border-color)',
            display: 'flex', flexDirection: 'column',
            transition: 'background 0.15s ease, border-color 0.15s ease'
        }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }}></div>
                    <span style={{ fontWeight: 600 }}>{title}</span>
                </div>
                <span style={{ background: 'var(--bg-color)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {tasks.length}
                </span>
            </div>
            <div
                ref={setNodeRef}
                style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '400px', flex: 1 }}
            >
                <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy} id={id}>
                    {tasks.map(task => (
                        <SortableTask key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} t={t} />
                    ))}
                    {tasks.length === 0 && (
                        <div style={{ width: '100%', flex: 1, minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('noTasksHere')}</span>
                        </div>
                    )}
                </SortableContext>
            </div>
        </div>
    );
};

// --- Main Page ---
const TasksMap = () => {
    const { t } = useTranslation();
    const language = useAppStore(state => state.appSettings?.language) || 'en';
    const tasks = useAppStore(state => state.tasks) || [];
    const addTask = useAppStore(state => state.addTask);
    const updateTaskStatus = useAppStore(state => state.updateTaskStatus);
    const editTask = useAppStore(state => state.editTask);
    const deleteTask = useAppStore(state => state.deleteTask);
    const showAppNotification = useAppStore(state => state.showAppNotification);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [activeTask, setActiveTask] = useState(null); // for DragOverlay

    const [isEllaOpen, setIsEllaOpen] = useState(false);
    const [ellaInput, setEllaInput] = useState('');
    const ellaBottomRef = useRef(null);
    const [ellaHistory, setEllaHistory] = useState([
        { sender: 'agent', text: t('ellaGreeting') }
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
    const [viewMode, setViewMode] = useState('board');
    const [currentDate, setCurrentDate] = useState(new Date());

    // Auto-scroll Ella chat
    useEffect(() => {
        if (ellaBottomRef.current) {
            ellaBottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [ellaHistory, isAiLoading]);

    // D&D sensors — require 8px movement before activating (prevents accidental drags on button clicks)
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
    );

    const handleDragStart = (event) => {
        const task = tasks.find(t => t.id === event.active.id);
        setActiveTask(task || null);
    };

    const handleDragEnd = (event) => {
        setActiveTask(null);
        const { active, over } = event;
        if (!over) return;

        const taskId = active.id;
        let destContainerId = over.id;

        // If dropped over another task card, resolve its column
        const STATUS_IDS = ['todo', 'in-progress', 'completed'];
        if (!STATUS_IDS.includes(destContainerId)) {
            const overTask = tasks.find(t => t.id === destContainerId);
            if (overTask) destContainerId = overTask.status;
        }

        const task = tasks.find(t => t.id === taskId);
        if (task && STATUS_IDS.includes(destContainerId) && destContainerId !== task.status) {
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
        setEditingTaskId(null);
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
        if (!taskForm.description.trim()) {
            showAppNotification(t('errorEmptyTaskDesc'), 'error');
            return;
        }
        setIsAiLoading(true);
        try {
            const prompt = `Tu es un expert en gestion de projet. Reformule et améliore la description de tâche suivante pour la rendre professionnelle, claire et actionnable. Retourne uniquement le texte amélioré, sans introduction ni explication.

Description brouillon : "${taskForm.description}"`;
            const res = await fetch('http://127.0.0.1:3000/api/ai/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: prompt, 
                    persona: 'ella', 
                    promptFormat: 'text',
                    provider: useAppStore.getState().appSettings?.provider,
                    model: useAppStore.getState().appSettings?.model
                })
            });
            const data = await res.json();
            if (data.response) {
                // Strip any markdown code block wrappers if present
                let cleaned = data.response.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
                setTaskForm(prev => ({ ...prev, description: cleaned }));
            }
        } catch (error) {
            console.error('AI Assist error:', error);
        } finally {
            setIsAiLoading(false);
        }
    };

    // Robust JSON extractor: finds first { ... } blob in any response string
    const extractJSON = (str) => {
        const start = str.indexOf('{');
        const end = str.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) return null;
        try {
            return JSON.parse(str.substring(start, end + 1));
        } catch {
            return null;
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
                body: JSON.stringify({ 
                    message: promptContext, 
                    persona: 'ella', 
                    promptFormat: 'json',
                    provider: useAppStore.getState().appSettings?.provider,
                    model: useAppStore.getState().appSettings?.model
                })
            });
            const data = await res.json();

            let replyText = data.response || t('errorEllaUnderstand');
            const parsed = extractJSON(replyText);

            if (parsed) {
                if (parsed.text) replyText = parsed.text;

                if (parsed.actions && Array.isArray(parsed.actions)) {
                    parsed.actions.forEach(action => {
                        if (action.type === 'ADD_TASK' && action.payload) {
                            addTask(action.payload);
                        } else if (action.type === 'UPDATE_TASK' && action.payload?.id) {
                            editTask(action.payload.id, action.payload);
                        } else if (action.type === 'DELETE_TASK' && action.payload?.id) {
                            deleteTask(action.payload.id);
                        }
                    });
                }
            }

            setEllaHistory(prev => [...prev, { sender: 'agent', text: replyText }]);
        } catch (error) {
            console.error('Ella error:', error);
            setEllaHistory(prev => [...prev, { sender: 'agent', text: t('errorEllaConnection') }]);
        } finally {
            setIsAiLoading(false);
        }
    };

    const todoTasks = tasks.filter(t => t.status === 'todo');
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
    const completedTasks = tasks.filter(t => t.status === 'completed');

    return (
        <div className="flex-1 overflow-y-auto" style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>{t('taskManagement')}</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>{t('taskDesc')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex items-center">
                        <button
                            onClick={() => setViewMode('board')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'board' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >{t('board')}</button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >{t('calendar')}</button>
                    </div>
                    <button className="btn-primary" onClick={handleOpenAddForm} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        {t('newTask')}
                    </button>
                </div>
            </div>

            {/* Task Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingTaskId ? t('editTask') : t('newTask')}
                            </h3>
                            <button onClick={() => { setIsFormOpen(false); setEditingTaskId(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSaveTask} className="space-y-5">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('taskTitleRequired')}</label>
                                <input
                                    type="text"
                                    value={taskForm.title}
                                    onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                    placeholder={t('taskTitlePlaceholder')}
                                    autoFocus
                                    required
                                />
                            </div>

                            {/* Category / Status / Date */}
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('category')}</label>
                                    <select
                                        value={taskForm.tag}
                                        onChange={e => setTaskForm({ ...taskForm, tag: e.target.value })}
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
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('status')}</label>
                                    <select
                                        value={taskForm.status}
                                        onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="todo">{t('toDo')}</option>
                                        <option value="in-progress">{t('inProgress')}</option>
                                        <option value="completed">{t('completed')}</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dueDate')}</label>
                                    <input
                                        type="date"
                                        value={taskForm.date}
                                        onChange={e => setTaskForm({ ...taskForm, date: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Description + AI Assist */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('description')}</label>
                                    <button
                                        type="button"
                                        onClick={handleAIAssist}
                                        disabled={isAiLoading}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 text-xs font-bold rounded-md hover:bg-teal-100 transition-colors disabled:opacity-60"
                                    >
                                        {isAiLoading ? (
                                            <>
                                                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                                {t('generating')}
                                            </>
                                        ) : (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
                                                ✨ AI Refine
                                            </>
                                        )}
                                    </button>
                                </div>
                                <textarea
                                    value={taskForm.description}
                                    onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 h-28 text-sm focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white resize-none"
                                    placeholder={t('writeBriefDescriptionEnhance')}
                                />
                            </div>

                            {/* Notes / Annotations */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('notes')}</label>
                                <input
                                    type="text"
                                    value={taskForm.annotations}
                                    onChange={e => setTaskForm({ ...taskForm, annotations: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                    placeholder={t('addQuickNoteOrAnnotation')}
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => { setIsFormOpen(false); setEditingTaskId(null); }}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                >{t('cancel')}</button>
                                <button type="submit" className="btn-primary" disabled={!taskForm.title.trim()}>
                                    {editingTaskId ? t('saveChanges') : t('createTask')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Board / Calendar */}
            {viewMode === 'board' ? (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '20px', alignItems: 'flex-start' }}>
                        <TaskColumn id="todo" title={t('toDo')} color="#f59e0b" tasks={todoTasks} onEdit={handleOpenEditForm} onDelete={deleteTask} t={t} />
                        <TaskColumn id="in-progress" title={t('inProgress')} color="#0b9f84" tasks={inProgressTasks} onEdit={handleOpenEditForm} onDelete={deleteTask} t={t} />
                        <TaskColumn id="completed" title={t('completed')} color="#10b981" tasks={completedTasks} onEdit={handleOpenEditForm} onDelete={deleteTask} t={t} />
                    </div>

                    <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                        {activeTask ? <TaskGhost task={activeTask} /> : null}
                    </DragOverlay>
                </DndContext>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            {currentDate.toLocaleString(language === 'en' ? 'en-US' : language, { month: 'long' })} {currentDate.getFullYear()}
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm font-medium shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">{t('today')}</button>
                            <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-2">
                        {[t('daySun'), t('dayMon'), t('dayTue'), t('dayWed'), t('dayThu'), t('dayFri'), t('daySat')].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 auto-rows-[120px]">
                        {(() => {
                            const year = currentDate.getFullYear();
                            const month = currentDate.getMonth();
                            const startingDay = new Date(year, month, 1).getDay();
                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                            const todayStr = new Date().toISOString().split('T')[0];
                            const cells = [];
                            for (let i = 0; i < startingDay; i++) {
                                cells.push(<div key={`e-${i}`} className="border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30"></div>);
                            }
                            for (let i = 1; i <= daysInMonth; i++) {
                                const d = new Date(year, month, i);
                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                                const isToday = todayStr === dateStr;
                                const dayTasks = tasks.filter(t => t.date === dateStr);
                                cells.push(
                                    <div key={`d-${i}`} className={`border-b border-r border-gray-200 dark:border-gray-700 p-2 flex flex-col ${isToday ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}>{i}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-1 mt-1 pr-1 custom-scrollbar">
                                            {dayTasks.map(task => (
                                                <div key={task.id} onClick={() => handleOpenEditForm(task)} className="cursor-pointer text-[10px] truncate px-1.5 py-1 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm" title={task.title}>
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
                title={t('talkToElla')}
            >
                <div className="text-2xl">🧠</div>
            </button>

            {/* Ella Chat Panel */}
            <div className={`fixed top-0 right-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isEllaOpen ? 'translate-x-0' : 'translate-x-full'}`}>
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

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {ellaHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isAiLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-2xl rounded-tl-sm flex gap-1.5 items-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        </div>
                    )}
                    <div ref={ellaBottomRef} />
                </div>

                <form onSubmit={handleEllaSubmit} className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <div className="relative">
                        <input
                            type="text"
                            value={ellaInput}
                            onChange={(e) => setEllaInput(e.target.value)}
                            placeholder={t('delegateTaskToElla')}
                            disabled={isAiLoading}
                            className="w-full pl-4 pr-12 py-3 bg-gray-100 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white disabled:opacity-60"
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
