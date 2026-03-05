import React, { useState } from 'react';
import useAppStore from '../store';
import { getTranslation as t } from '../locales';
import { DndContext, closestCorners, TouchSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Sortable Task Item Component ---
const SortableTask = ({ task, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none'
    };

    const getTagColor = (tag) => {
        const colors = {
            'Development': '#3b82f6',
            'Legal': '#10b981',
            'Design': '#8b5cf6',
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
            className="group"
            style={{
                ...style,
                background: 'var(--bg-color)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                cursor: 'grab',
                position: 'relative'
            }}
        >
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                style={{ zIndex: 10 }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div style={{ fontSize: '10px', fontWeight: 600, color: getTagColor(task.tag), textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                {task.tag}
            </div>
            <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '8px', lineHeight: '1.4' }}>{task.title}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{task.date}</div>
            </div>
        </div>
    );
};

// --- Task Column Component ---
const TaskColumn = ({ id, title, defaultCount, color, tasks, onDelete }) => {
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
                        <SortableTask key={task.id} task={task} onDelete={onDelete} />
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
    const deleteTask = useAppStore(state => state.deleteTask);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskTag, setNewTaskTag] = useState('Development');
    const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split('T')[0]);
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

    const handleCreateTask = (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        addTask({
            title: newTaskTitle,
            tag: newTaskTag,
            date: newTaskDate,
            status: 'todo'
        });

        setIsFormOpen(false);
        setNewTaskTitle('');
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
                    <button className="btn-primary" onClick={() => setIsFormOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        {t(language, 'newTask')}
                    </button>
                </div>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t(language, 'newTask')}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <form onSubmit={handleCreateTask} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={e => setNewTaskTitle(e.target.value)}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                    placeholder="Task title..."
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tag</label>
                                    <select
                                        value={newTaskTag}
                                        onChange={e => setNewTaskTag(e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="Development">Development</option>
                                        <option value="Design">Design</option>
                                        <option value="Legal">Legal</option>
                                        <option value="Marketing">Marketing</option>
                                        <option value="Sales">Sales</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        value={newTaskDate}
                                        onChange={e => setNewTaskDate(e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                <button type="submit" className="btn-primary" disabled={!newTaskTitle.trim()}>Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {viewMode === 'board' ? (
                <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                    <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '20px' }}>
                        <TaskColumn id="todo" title={t(language, 'toDo')} color="#f59e0b" tasks={todoTasks} onDelete={deleteTask} />
                        <TaskColumn id="in-progress" title={t(language, 'inProgress')} color="#3b82f6" tasks={inProgressTasks} onDelete={deleteTask} />
                        <TaskColumn id="completed" title={t(language, 'completed')} color="#10b981" tasks={completedTasks} onDelete={deleteTask} />
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
                                                    <span style={{ color: task.status === 'completed' ? '#10b981' : task.status === 'in-progress' ? '#3b82f6' : '#f59e0b', marginRight: '4px' }}>•</span>
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
        </div>
    );
};

export default TasksMap;
