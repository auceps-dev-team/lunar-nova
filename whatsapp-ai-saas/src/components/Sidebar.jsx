import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/global.css';

const Sidebar = ({ instances, activeId, onSelect, onAdd, onRemove, currentPath }) => {
    return (
        <aside className="flex w-[260px] flex-col bg-sidebar-dark rounded-lg shadow-soft overflow-hidden shrink-0 text-white">
            <div className="p-5 flex items-center gap-3 border-b border-white/10">
                <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-green-900/20">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                    </svg>
                </div>
                <h1 className="font-display font-bold text-lg tracking-tight text-white">WhatsAI</h1>
            </div>

            <nav className="flex-1 overflow-y-auto sidebar-scroll py-4 px-3 space-y-1">
                <div className="text-xs font-semibold text-gray-400 px-3 mb-2 uppercase tracking-wider">Main</div>

                <Link to="/dashboard" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/dashboard' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    <span className="text-sm font-medium">Dashboard</span>
                </Link>

                <Link to="/whatsapp-hub" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/whatsapp-hub' || currentPath === '/' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    <span className="text-sm font-medium">WhatsApp Hub</span>
                </Link>

                <Link to="/agents" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/agents' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>
                    <span className="text-sm font-medium">AI Agents Hub</span>
                </Link>

                <Link to="/tasks" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/tasks' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                    <span className="text-sm font-medium">Tasks</span>
                </Link>

                <Link to="/invoice-builder" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/invoice-builder' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                    <span className="text-sm font-medium">Invoice Builder</span>
                </Link>

                <Link to="/tools" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${currentPath === '/tools' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                    <span className="text-sm font-medium">Tools</span>
                </Link>

                <div className="text-xs font-semibold text-gray-400 px-3 mt-6 mb-2 uppercase tracking-wider flex items-center justify-between">
                    <span>Instances</span>
                    <button className="text-gray-400 hover:text-white transition-colors" onClick={onAdd} title="New Instance">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                </div>

                {instances.map((instance) => (
                    <div
                        key={instance.id}
                        className={`group flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${activeId === instance.id
                            ? 'bg-white/5 border-white/5 text-white'
                            : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-white'
                            }`}
                        onClick={() => {
                            if (currentPath !== '/whatsapp-hub' && currentPath !== '/') {
                                // Instead of a normal Link, we trigger the click, but the user expects to stay on the route or go to hub?
                                // Usually selecting an instance forces you to the hub or simply activates it.
                                // We'll let the user decide but standard is activation.
                            }
                            onSelect(instance.id);
                        }}
                    >
                        <Link
                            to="/whatsapp-hub"
                            className="flex items-center gap-3 flex-1 min-w-0"
                            onClick={(e) => {
                                // Default Link behavior works, just ensure we trigger selection
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            <span className="text-sm font-medium truncate">{instance.name}</span>
                        </Link>

                        <div className="flex items-center gap-2">
                            {activeId === instance.id && (
                                <span className="size-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                            )}
                            <button
                                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(instance.id);
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    </div>
                ))}
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
    );
};

export default Sidebar;
