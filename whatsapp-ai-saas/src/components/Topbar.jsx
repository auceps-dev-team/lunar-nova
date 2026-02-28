import React from 'react';
import '../styles/global.css';

const Topbar = ({ activeInstance, currentTitle }) => {
    const getFormattedTitle = () => {
        if (!currentTitle || currentTitle === '/') return 'WhatsApp Hub';
        if (currentTitle === '/whatsapp-hub') return activeInstance ? activeInstance.name : 'WhatsApp Hub';
        if (currentTitle === '/dashboard') return 'Dashboard & Analytics';
        if (currentTitle === '/agents') return 'AI Agents Hub';
        if (currentTitle === '/tasks') return 'Task Management';
        if (currentTitle === '/invoice-builder') return 'Invoice Builder';
        if (currentTitle === '/tools') return 'Tools';
        if (currentTitle === '/profile') return 'Account Strategy & Billing';
        return 'Workspace';
    };

    return (
        <header className="h-[72px] px-6 flex items-center justify-between border-b border-gray-100 bg-white z-10 shrink-0">
            <div className="flex items-center gap-4">
                {activeInstance && (currentTitle === '/whatsapp-hub' || currentTitle === '/') && (
                    <div className="relative">
                        <div className="size-11 rounded-full bg-cover bg-center ring-2 ring-gray-50 bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {activeInstance.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-white rounded-full"></span>
                    </div>
                )}
                <div>
                    <h2 className="font-display font-bold text-text-main text-lg leading-tight">
                        {getFormattedTitle()}
                    </h2>
                    {activeInstance && (currentTitle === '/whatsapp-hub' || currentTitle === '/') && (
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-text-muted">Personal WhatsApp</span>
                            <span className="size-1 bg-gray-300 rounded-full"></span>
                            <span className="text-xs text-green-600 font-medium bg-green-50 px-1.5 rounded">Connected</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm bg-white">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Settings
                </button>
            </div>
        </header>
    );
};

export default Topbar;
