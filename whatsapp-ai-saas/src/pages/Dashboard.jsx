import React from 'react';
import useAppStore from '../store';
import { getTranslation as t } from '../locales';

const Dashboard = () => {
    // Get live data from Zustand Persist store
    const instances = useAppStore(state => state.instances);
    const copilotCount = useAppStore(state => state.copilotRepliesGenerated);
    const language = useAppStore(state => state.appSettings?.language) || 'en';

    const activeInstancesCount = instances.filter(i => i.status !== 'offline').length || instances.length;

    const metrics = [
        { title: t(language, 'activeInstances'), value: activeInstancesCount, trend: "Live", color: "#10b981" },
        { title: t(language, 'copilotReplies'), value: copilotCount.toLocaleString(), trend: "Tracked", color: "#3b82f6" },
        { title: t(language, 'automatedInvoices'), value: "0", trend: "0%", color: "#8b5cf6" },
        { title: t(language, 'tasksCompleted'), value: "0", trend: "0%", color: "#f59e0b" },
    ];

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.3s ease-in-out' }}>
            <h1 style={{ marginBottom: '8px', fontSize: '24px' }}>{t(language, 'welcomeBack')}</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>{t(language, 'workspaceSummary')}</p>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '20px',
                marginBottom: '40px'
            }}>
                {metrics.map((metric, idx) => (
                    <div key={idx} style={{
                        background: 'var(--panel-bg)',
                        padding: '20px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>{metric.title}</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                            <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)' }}>{metric.value}</div>
                            <div style={{ color: metric.color, fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{metric.trend}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{
                background: 'var(--panel-bg)',
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                minHeight: '300px'
            }}>
                <h3 style={{ marginBottom: '20px', fontSize: '16px' }}>{t(language, 'recentActivity')}</h3>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', marginTop: '60px' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: '16px' }}>
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    <p>{t(language, 'metricsGraph')}</p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
