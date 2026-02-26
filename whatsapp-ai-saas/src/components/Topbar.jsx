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
        <div className="topbar">
            <div className="topbar-left">
                <h2 className="topbar-title">
                    {getFormattedTitle()}
                </h2>
                {activeInstance && (currentTitle === '/whatsapp-hub' || currentTitle === '/') && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Personal WhatsApp
                    </div>
                )}
            </div>

            <div className="topbar-right">
                <button className="btn-outline">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Settings
                </button>
            </div>
        </div>
    );
};

export default Topbar;
