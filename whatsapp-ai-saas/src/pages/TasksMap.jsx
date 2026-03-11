import React, { useState, useRef } from 'react';
import useAppStore from '../store';
import { getTranslation as t } from '../locales';


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
    const [ellaMode, setEllaMode] = useState('Planning');
    const [ellaInput, setEllaInput] = useState('');
    const [ellaHistory, setEllaHistory] = useState([
        { sender: 'agent', text: 'Bonjour ! Je suis Ella, votre Life Architect. Dites-moi ce que vous avez en tête, je m\'occupe de structurer tout ça dans votre planning.' }
    ]);

    const getLocalDateString = (d) => new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const defaultFormState = {
        title: '',
        tag: 'Development',
        date: getLocalDateString(new Date()),
        status: 'todo',
        description: '',
        annotations: '',
        attachments: []
    };
    
    const [taskForm, setTaskForm] = useState(defaultFormState);
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

    const [viewMode, setViewMode] = useState('board'); // 'board' or 'calendar'
    const [currentDate, setCurrentDate] = useState(new Date());

    // Dnd logic removed for redesign

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
            date: task.date || getLocalDateString(new Date()),
            status: task.status || 'todo',
            description: task.description || '',
            annotations: task.annotations || '',
            attachments: task.attachments || []
        });
        setEditingTaskId(task.id);
        setIsFormOpen(true);
    };

    const handleAIAssist = async () => {
        if (!taskForm.description) return;
        setIsAiLoading(true);
        try {
            const prompt = `Refine and expand the following task description to make it professional and clear. Here is the draft: \n\n${taskForm.description}`;
            const res = await fetch('http://localhost:3000/api/gemini/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: prompt, persona: 'ella' })
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

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('http://localhost:3000/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.status === 'success') {
                const newAttachment = { name: data.filename, url: data.url };
                setTaskForm(prev => ({
                    ...prev,
                    attachments: [...(prev.attachments || []), newAttachment]
                }));
            } else {
                alert('Upload failed: ' + data.error);
            }
        } catch (err) {
            console.error('File upload error:', err);
            alert('Upload error.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    
    const removeAttachment = (index) => {
        setTaskForm(prev => {
            const newAttachments = [...prev.attachments];
            newAttachments.splice(index, 1);
            return { ...prev, attachments: newAttachments };
        });
    };

    const handleEllaSubmit = async (e) => {
        e.preventDefault();
        if (!ellaInput.trim()) return;

        const userMessage = ellaInput.trim();
        setEllaHistory(prev => [...prev, { sender: 'user', text: userMessage }]);
        setEllaInput('');
        setIsAiLoading(true);

        try {
            const modeInstruction = ellaMode === 'Planning'
                ? 'IMPORTANT: Do NOT use ADD_TASK, UPDATE_TASK or DELETE_TASK. Instead, use PROPOSE_TASK for all task creations to ask for user approval first.'
                : 'IMPORTANT: Use ADD_TASK, UPDATE_TASK, and DELETE_TASK directly. Do not propose.';
            
            const promptContext = `[CURRENT_TASKS]: ${JSON.stringify(tasks)}\n\n[MODE INSTRUCTION]: ${modeInstruction}\n\nUser instruction: ${userMessage}`;
            const res = await fetch('http://localhost:3000/api/gemini/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: promptContext, persona: 'ella' })
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
                        } else if (action.type === 'PROPOSE_TASK') {
                            setEllaHistory(prev => [...prev, { sender: 'agent-proposal', action: action.payload }]);
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

    // Filter variables removed for redesign

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
                        <button
                            onClick={() => setViewMode('ai-conversations')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'ai-conversations' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                        >
                            AI Conversations
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
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    onChange={handleFileUpload} 
                                />
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer ${isUploading ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`mb-2 ${isUploading ? 'animate-bounce text-primary' : ''}`}>
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                    <p className="text-sm font-medium">{isUploading ? 'Uploading...' : 'Drag and drop files here or click to upload'}</p>
                                </div>
                                
                                {taskForm.attachments && taskForm.attachments.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {taskForm.attachments.map((file, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap overflow-hidden max-w-[200px]">
                                                <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="truncate hover:text-primary transition-colors flex-1">{file.name}</a>
                                                <button type="button" onClick={() => removeAttachment(idx)} className="text-gray-400 hover:text-red-500 ml-1">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
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

            {/* Redesigned Task View Wrapper (To be implemented) */}
            <div className="flex flex-col items-center justify-center p-12 mt-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-400 mb-4">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">Task View Redesign in Progress</h2>
                <p className="text-gray-500 mt-2">The layout is currently being rebuilt.</p>
            </div>

            {/* Ella Floating Button */}
            <button
                onClick={() => setIsEllaOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"
                title="Talk to Ella"
            >
                <div>
                    {/* Snapshot-like Magic wand icon */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16.5 6a2.5 2.5 0 0 1 3.5 3.5l-9.5 9.5a2.5 2.5 0 0 1-3.5-3.5l9.5-9.5zm-5.5 8.5a1 1 0 1 0-1.4 1.4 1 1 0 0 0 1.4-1.4z" />
                        <path d="M19 2l.8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8L19 2z" />
                        <path d="M9.5 6.5L10 8l1.5.5-1.5.5-.5 1.5-.5-1.5L7.5 8.5 9 8l.5-1.5z" />
                        <path d="M14.5 16l.4 1.1L16 17.5l-1.1.4-.4 1.1-.4-1.1L13 17.5l1.1-.4.4-1.1z" />
                    </svg>
                </div>
            </button>

            {/* Ella Chat Panel */}
            <div className={`fixed top-0 right-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isEllaOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-teal-50 dark:bg-teal-900/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16.5 6a2.5 2.5 0 0 1 3.5 3.5l-9.5 9.5a2.5 2.5 0 0 1-3.5-3.5l9.5-9.5zm-5.5 8.5a1 1 0 1 0-1.4 1.4 1 1 0 0 0 1.4-1.4z" />
                                <path d="M19 2l.8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8L19 2z" />
                                <path d="M9.5 6.5L10 8l1.5.5-1.5.5-.5 1.5-.5-1.5L7.5 8.5 9 8l.5-1.5z" />
                                <path d="M14.5 16l.4 1.1L16 17.5l-1.1.4-.4 1.1-.4-1.1L13 17.5l1.1-.4.4-1.1z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white leading-tight">Ella</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-teal-600 dark:text-teal-400 font-medium truncate">Life Architect</p>
                                <div className="flex bg-teal-200/50 dark:bg-teal-900/50 rounded-md p-0.5 ml-1">
                                    <button onClick={() => setEllaMode('Planning')} className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded ${ellaMode === 'Planning' ? 'bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-300 shadow-sm' : 'text-teal-600/70 dark:text-teal-400/70'}`}>Plan</button>
                                    <button onClick={() => setEllaMode('Fast')} className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded ${ellaMode === 'Fast' ? 'bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-300 shadow-sm' : 'text-teal-600/70 dark:text-teal-400/70'}`}>Fast</button>
                                </div>
                            </div>
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
                            {msg.sender === 'agent-proposal' ? (
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-teal-200 dark:border-teal-800 shadow-sm w-[85%] mt-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <svg width="14" height="14" className="text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">Proposed Task</p>
                                    </div>
                                    <p className="text-sm font-semibold mb-1 text-gray-900 dark:text-white leading-snug">{msg.action.title}</p>
                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => { addTask(msg.action); setEllaHistory(prev => prev.filter((_, idx) => idx !== i)); }} className="flex-1 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors">Approve</button>
                                        <button onClick={() => setEllaHistory(prev => prev.filter((_, idx) => idx !== i))} className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg transition-colors">Reject</button>
                                    </div>
                                </div>
                            ) : (
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.sender === 'user' ? 'bg-teal-600 text-white rounded-tr-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm'}`}>
                                    {msg.text.split('\\n').map((line, idx) => (
                                        <React.Fragment key={idx}>{line}<br/></React.Fragment>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {isAiLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                                <div className="w-2 h-2 rounded-full bg-teal-400 animate-bounce"></div>
                                <div className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                <div className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{animationDelay: '0.2s'}}></div>
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
                            className="w-full pl-4 pr-12 py-3 bg-gray-100 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-teal-500 dark:text-white"
                        />
                        <button
                            type="submit"
                            disabled={!ellaInput.trim() || isAiLoading}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
