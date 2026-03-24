import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../store';
import { getTranslation as t } from '../locales';
import '../styles/global.css';

const INSTANCE_ICONS = {
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>,
    briefcase: <path d="M20 7h-4V5l-2-2h-4L8 5v2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-6 0h-4V5h4v2z"></path>,
    user: <g><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></g>,
    star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>,
    message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
};

const INSTANCE_COLORS = [
    { name: 'green', value: '#22c55e', shadow: 'rgba(34,197,94,0.6)' },
    { name: 'blue', value: '#3b82f6', shadow: 'rgba(59,130,246,0.6)' },
    { name: 'purple', value: '#a855f7', shadow: 'rgba(168,85,247,0.6)' },
    { name: 'orange', value: '#f97316', shadow: 'rgba(249,115,22,0.6)' },
    { name: 'pink', value: '#ec4899', shadow: 'rgba(236,72,153,0.6)' }
];

const Sidebar = ({ instances, activeId, onSelect, onAdd, onRemove, onUpdate, currentPath }) => {
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', color: '', icon: '' });
    const language = useAppStore(state => state.appSettings?.language) || 'en';
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [isResizing, setIsResizing] = useState(false);

    // Dropdown states
    const [fashionStudioExpanded, setFashionStudioExpanded] = useState(false);
    const [whatsappMenuExpanded, setWhatsappMenuExpanded] = useState(false);

    const startResizing = (mouseDownEvent) => {
        mouseDownEvent.preventDefault();
        setIsResizing(true);
        const startWidth = sidebarWidth;
        const startX = mouseDownEvent.clientX;

        const onMouseMove = (mouseMoveEvent) => {
            const newWidth = Math.max(180, Math.min(450, startWidth + (mouseMoveEvent.clientX - startX)));
            setSidebarWidth(newWidth);
        };

        const onMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleEditClick = (e, instance) => {
        e.stopPropagation();
        setEditingId(instance.id);
        setEditForm({
            name: instance.name || '',
            color: instance.color || 'green',
            icon: instance.icon || 'phone'
        });
    };

    const handleSaveEdit = (e, id) => {
        e.stopPropagation();
        onUpdate(id, editForm);
        setEditingId(null);
    };

    return (
        <div className="flex relative h-full shrink-0 group/sidebar" style={{ width: `${sidebarWidth}px`, transition: 'width 0.1s' }}>
            <aside className="w-full flex-col bg-sidebar-dark rounded-lg shadow-soft overflow-hidden shrink-0 text-white flex h-full">
                <div className="p-5 flex items-center gap-3 border-b border-white/10">
                    <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-green-900/20">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                        </svg>
                    </div>
                    <h1 className="font-display font-bold text-lg tracking-tight text-white">WhatsAI</h1>
                </div>

                <nav className="flex-1 overflow-y-auto scrollbar-hide py-4 px-3 space-y-1">
                    <div className="text-xs font-semibold text-gray-400 px-3 mb-2 uppercase tracking-wider">Main</div>


                    <Link to="/dashboard" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/dashboard' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        <span className="text-sm font-medium">{t(language, 'dashboard') || 'Tableau de bord'}</span>
                    </Link>

                    <Link to="/whatsapp-hub" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/whatsapp-hub' || currentPath === '/' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        <span className="text-sm font-medium">{t(language, 'whatsappHub')}</span>
                    </Link>

                    <Link to="/analytics" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/analytics' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>
                        <span className="text-sm font-medium">Analytics</span>
                    </Link>

                    {/* AI Fashion Studio Dropdown */}
                    <div>
                        <button
                            onClick={() => setFashionStudioExpanded(!fashionStudioExpanded)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors group ${currentPath.includes('/fashion') ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                        >
                            <div className="flex items-center gap-3">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a8.86 8.86 0 0 1-5 0 8.86 8.86 0 0 1-5 0L1.62 3.46A2 2 0 0 0 0 5.34v.53a3 3 0 0 0 2 2.82v10.3A3 3 0 0 0 5 22h14a3 3 0 0 0 3-3V8.69a3 3 0 0 0 2-2.82v-.53a2 2 0 0 0-1.62-1.88z"></path><path d="M12 2v6"></path><path d="M9 12h6"></path><path d="M9 16h6"></path></svg>
                                <span className="text-sm font-medium">AI Fashion Studio</span>
                            </div>
                            <svg className={`w-4 h-4 transition-transform ${fashionStudioExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <div className={`overflow-hidden transition-all duration-300 pl-11 pr-3 space-y-1 ${fashionStudioExpanded ? 'max-h-96 py-1' : 'max-h-0 py-0'}`}>
                            <Link to="/agents" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentPath === '/agents' ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>
                                <span className="truncate text-sm">Product Photo</span>
                            </Link>
                            <Link to="/fashion/photoshoot" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentPath === '/fashion/photoshoot' ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                <span className="truncate text-sm">Photo Shoot</span>
                            </Link>
                            <Link to="/fashion/edit" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentPath === '/fashion/edit' ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                <span className="truncate text-sm">Edit Image</span>
                            </Link>
                        </div>
                    </div>

                    <Link to="/ai-chat" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/ai-chat' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        <span className="text-sm font-medium">AI Chat</span>
                    </Link>

                    <Link to="/ai-writer" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/ai-writer' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        <span className="text-sm font-medium">AI Writer</span>
                    </Link>

                    {/* WhatsApp Specialized Dropdown */}
                    <div>
                        <button
                            onClick={() => setWhatsappMenuExpanded(!whatsappMenuExpanded)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors group ${currentPath.includes('/wa/') ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                        >
                            <div className="flex items-center gap-3">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                <span className="text-sm font-medium">Whatsapp</span>
                            </div>
                            <svg className={`w-4 h-4 transition-transform ${whatsappMenuExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <div className={`overflow-hidden transition-all duration-300 pl-11 pr-3 space-y-1 ${whatsappMenuExpanded ? 'max-h-40 py-1' : 'max-h-0 py-0'}`}>
                            <Link to="/wa/contact-lists" className={`flex items-center px-3 py-2 rounded-lg transition-colors ${currentPath === '/wa/contact-lists' ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                <span className="truncate text-sm">Contact Lists</span>
                            </Link>
                            <Link to="/wa/segments" className={`flex items-center px-3 py-2 rounded-lg transition-colors ${currentPath === '/wa/segments' ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                <span className="truncate text-sm">Segments</span>
                            </Link>
                            <Link to="/wa/contacts" className={`flex items-center px-3 py-2 rounded-lg transition-colors ${currentPath === '/wa/contacts' ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                <span className="truncate text-sm">Contacts</span>
                            </Link>
                            <Link to="/wa/orders" className={`flex items-center px-3 py-2 rounded-lg transition-colors ${currentPath === '/wa/orders' ? 'bg-amber-500/10 text-amber-500 font-medium' : 'text-gray-400 hover:text-amber-400 hover:bg-white/5'}`}>
                                <span className="truncate text-sm">Ordres & Commandes</span>
                            </Link>
                        </div>
                    </div>

                    <Link to="/support" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/support' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        <span className="text-sm font-medium">{t(language, 'support') || 'Support'}</span>
                    </Link>

                    <Link to="/tasks" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/tasks' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        <span className="text-sm font-medium">{t(language, 'tasks')}</span>
                    </Link>

                    <Link to="/invoice-builder" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/invoice-builder' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                        <span className="text-sm font-medium">{t(language, 'invoiceBuilder')}</span>
                    </Link>

                    <Link to="/tools" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/tools' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                        <span className="text-sm font-medium">{t(language, 'tools')}</span>
                    </Link>

                    <div className="text-xs font-semibold text-gray-400 px-3 mt-6 mb-2 uppercase tracking-wider flex items-center justify-between">
                        <span>{t(language, 'instances')}</span>
                        <button className="text-gray-400 hover:text-white transition-colors" onClick={onAdd} title="New Instance">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                    </div>

                    {instances.map((instance) => {
                        const isEditing = editingId === instance.id;
                        const activeColorObj = INSTANCE_COLORS.find(c => c.name === (instance.color || 'green')) || INSTANCE_COLORS[0];
                        const IconPath = INSTANCE_ICONS[instance.icon || 'phone'] || INSTANCE_ICONS.phone;

                        if (isEditing) {
                            return (
                                <div key={instance.id} className="bg-white/10 p-3 rounded-lg border border-white/20 flex flex-col gap-3">
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        className="bg-sidebar-dark border border-white/20 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary w-full"
                                        placeholder="Instance Name"
                                    />
                                    <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
                                        <div className="flex flex-wrap gap-2">
                                            {INSTANCE_COLORS.map(c => (
                                                <div
                                                    key={c.name}
                                                    onClick={() => setEditForm({ ...editForm, color: c.name })}
                                                    className={`size-4 rounded-full cursor-pointer transition-transform ${editForm.color === c.name ? 'scale-125 ring-2 ring-white shadow-soft' : 'opacity-50 hover:opacity-100'}`}
                                                    style={{ backgroundColor: c.value }}
                                                />
                                            ))}
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {Object.keys(INSTANCE_ICONS).map(iconName => (
                                                <div
                                                    key={iconName}
                                                    onClick={() => setEditForm({ ...editForm, icon: iconName })}
                                                    className={`p-1 rounded cursor-pointer transition-colors ${editForm.icon === iconName ? 'bg-white/20 text-white shadow-soft' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        {INSTANCE_ICONS[iconName]}
                                                    </svg>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="flex-1 py-1 text-xs text-gray-300 hover:bg-white/10 rounded">Cancel</button>
                                        <button onClick={(e) => handleSaveEdit(e, instance.id)} className="flex-1 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90">Save</button>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={instance.id}
                                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${activeId === instance.id
                                    ? 'bg-white/5 border-white/5 text-white'
                                    : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                                onClick={() => {
                                    onSelect(instance.id);
                                }}
                            >
                                <Link
                                    to="/whatsapp-hub"
                                    className="flex items-center gap-3 flex-1 min-w-0"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                        {IconPath}
                                    </svg>
                                    <span className="text-sm font-medium truncate">{instance.name}</span>
                                </Link>

                                <div className="flex items-center gap-2">
                                    {activeId === instance.id && (
                                        <span className="size-2 rounded-full" style={{ backgroundColor: activeColorObj.value, boxShadow: `0 0 8px ${activeColorObj.shadow}` }}></span>
                                    )}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            className="text-gray-500 hover:text-white transition-colors p-[2px]"
                                            onClick={(e) => handleEditClick(e, instance)}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                        </button>
                                        <button
                                            className="text-gray-500 hover:text-red-400 transition-colors p-[2px]"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemove(instance.id);
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-white/10 mt-auto">
                    <Link to="/profile" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-white">
                        <div className="size-9 border-2 border-white/10 rounded-full bg-primary flex flex-col items-center justify-center font-bold text-sm">
                            JO
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">Auceps Digital</p>
                            <p className="text-xs text-gray-400 truncate">SaaS License</p>
                        </div>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </Link>
                </div>
            </aside>

            {/* Resizer Handler */}
            <div
                className={`w-2 cursor-col-resize shrink-0 transition-colors flex items-center justify-center z-20 group -ml-1 absolute right-[-4px] top-0 bottom-0 ${isResizing ? 'bg-white/20' : 'hover:bg-white/10'}`}
                onMouseDown={startResizing}
                title="Drag to resize sidebar"
            >
                <div className={`w-1 h-8 rounded-full transition-colors ${isResizing ? 'bg-white' : 'bg-gray-500 group-hover:bg-white'}`} />
            </div>

            {/* Invisible overlay to block iframe mouse events while dragging */}
            {isResizing && <div className="fixed inset-0 z-50 cursor-col-resize select-none" />}
        </div>
    );
};

export default Sidebar;
