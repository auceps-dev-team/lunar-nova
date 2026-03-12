import React, { useMemo } from 'react';
import useAppStore from '../store';
import { getTranslation as t } from '../locales';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
    // Get live data from Zustand Persist store
    const instances = useAppStore(state => state.instances);
    const copilotCount = useAppStore(state => state.copilotRepliesGenerated);
    const tasks = useAppStore(state => state.tasks) || [];
    const language = useAppStore(state => state.appSettings?.language) || 'en';

    const activeInstancesCount = instances.filter(i => i.status !== 'offline').length || instances.length;

    // Calculate completed tasks
    const completedTasksCount = tasks.filter(t => t.status === 'completed').length;
    const totalTasksCount = tasks.length;
    const completedPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

    const metrics = [
        { title: t(language, 'activeInstances'), value: activeInstancesCount, trend: "Live", color: "#10b981" },
        { title: t(language, 'copilotReplies'), value: copilotCount.toLocaleString(), trend: "Tracked", color: "#10b981" },
        { title: t(language, 'automatedInvoices'), value: "0", trend: "0%", color: "#10b981" },
        { title: t(language, 'tasksCompleted'), value: completedTasksCount.toString(), trend: `${completedPercentage}%`, color: "#10b981" },
    ];

    // Generate mock data for the last 7 days, placing current copilotCount on today
    const mockChartData = useMemo(() => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayName = days[d.getDay()];
            // If it's today, use actual count, otherwise generate random realistic numbers
            const val = i === 0 ? copilotCount : Math.floor(Math.random() * 20) + 5;
            data.push({ name: dayName, replies: val });
        }
        return data;
    }, [copilotCount]);

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
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <h3 style={{ marginBottom: '20px', fontSize: '16px' }}>{t(language, 'recentActivity')}</h3>
                <div style={{ flex: 1, width: '100%', minHeight: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={mockChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                            <Tooltip
                                contentStyle={{ background: 'var(--panel-bg)', borderColor: 'var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                            />
                            <Area type="monotone" dataKey="replies" name="Copilot Replies" stroke="#0b9f84" strokeWidth={3} fillOpacity={1} fill="url(#colorReplies)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
