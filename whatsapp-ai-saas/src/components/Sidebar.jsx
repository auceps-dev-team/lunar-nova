import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/global.css';

const Sidebar = ({ instances, activeId, onSelect, onAdd, onRemove }) => {
    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <div style={{
                    width: 28, height: 28, borderRadius: 14, background: '#10b981',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                </div>
                <h1>WhatsAI</h1>
            </div>

            <div className="sidebar-section">
                <div className="section-label">Main</div>
                <div className="sidebar-menu">
                    <Link to="/dashboard" className="menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        Dashboard
                    </Link>
                    <Link to="/whatsapp-hub" className="menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        WhatsApp Hub
                    </Link>
                    <Link to="/agents" className="menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                        AI Agents Hub
                    </Link>
                    <Link to="/tasks" className="menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        Tasks
                    </Link>
                    <Link to="/invoice-builder" className="menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                        Invoice Builder
                    </Link>
                    <Link to="/tools" className="menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                        Tools
                    </Link>
                </div>
            </div>

            <div className="sidebar-section" style={{ flex: 1 }}>
                <div className="section-label">
                    <span>Instances</span>
                    <button className="btn-icon" onClick={onAdd} title="New Instance">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                </div>
                <div className="sidebar-menu" style={{ marginTop: '8px' }}>
                    {instances.map((instance) => (
                        <Link
                            to="/whatsapp-hub"
                            key={instance.id}
                            style={{ textDecoration: 'none' }}
                            className={`instance-item ${activeId === instance.id ? 'active' : ''}`}
                            onClick={() => onSelect(instance.id)}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                {instance.name}
                            </div>
                            <button
                                className="delete-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(instance.id);
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                            </button>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="sidebar-footer">
                <Link to="/profile" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="user-profile">
                        <div className="user-avatar">U</div>
                        <div className="user-info">
                            <span className="user-email">ecrabetjoas31@gmail.com</span>
                            <span className="user-plan">Free Plan</span>
                        </div>
                    </div>
                </Link>
                <div className="sign-out">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Sign Out
                </div>
            </div>
        </div >
    );
};

export default Sidebar;
