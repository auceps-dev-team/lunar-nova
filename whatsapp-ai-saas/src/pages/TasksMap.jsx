import React from 'react';

const TasksMap = () => {
    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Task Management</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Organize your workflow and follow up on client requests.</p>
                </div>
                <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    New Task
                </button>
            </div>

            <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '20px' }}>
                {/* To Do Column */}
                <div style={{ minWidth: '320px', flex: 1, background: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></div>
                            <span style={{ fontWeight: 600 }}>To Do</span>
                        </div>
                        <span style={{ background: 'var(--bg-color)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>2</span>
                    </div>
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '400px' }}>

                        {/* Task Card */}
                        <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'grab' }}>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Development</div>
                            <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '8px', lineHeight: '1.4' }}>Implement @dnd-kit/core for this exact board format</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Oct 24</div>
                                <div style={{ width: '24px', height: '24px', borderRadius: '12px', background: 'var(--primary-color)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>EJ</div>
                            </div>
                        </div>

                        {/* Task Card */}
                        <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'grab' }}>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Legal</div>
                            <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '8px', lineHeight: '1.4' }}>Review contract drafted by AI Agent</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Oct 25</div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* In Progress Column */}
                <div style={{ minWidth: '320px', flex: 1, background: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }}></div>
                            <span style={{ fontWeight: 600 }}>In Progress</span>
                        </div>
                        <span style={{ background: 'var(--bg-color)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>1</span>
                    </div>
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '400px' }}>
                        {/* Task Card */}
                        <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'grab' }}>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Design</div>
                            <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '8px', lineHeight: '1.4' }}>Build React UI layouts for Phase 2 expansion</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Today</div>
                                <div style={{ width: '24px', height: '24px', borderRadius: '12px', background: 'var(--primary-color)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>AI</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Completed Column */}
                <div style={{ minWidth: '320px', flex: 1, background: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', opacity: 0.8 }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Completed</span>
                        </div>
                        <span style={{ background: 'var(--bg-color)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>0</span>
                    </div>
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '400px', alignItems: 'center', justifyContent: 'center' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No completed tasks yet.</p>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TasksMap;
