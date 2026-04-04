import React, { useMemo } from 'react';
import useAppStore from '../store';
import { getTranslation as t } from '../locales';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const C = {
    primary:   '#0b9f84',
    primary2:  '#10b981',
    accent:    '#6366f1',
    amber:     '#f59e0b',
    red:       '#ef4444',
    blue:      '#3b82f6',
    purple:    '#8b5cf6',
    gray100:   '#f1f5f9',
    gray200:   '#e2e8f0',
    gray400:   '#94a3b8',
    gray500:   '#64748b',
    gray700:   '#334155',
    textPrimary: 'var(--text-primary, #0f172a)',
    textSecondary: 'var(--text-secondary, #64748b)',
    panelBg:   'var(--panel-bg, #fff)',
    borderColor: 'var(--border-color, #e2e8f0)',
};

const Icons = {
    bot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8V4H8"></path><rect x="4" y="8" width="16" height="12" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>,
    checkCircle: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="M22 4L12 14.01l-3-3"></path></svg>,
    phone: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>,
    fileText: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
};

function KPICard({ icon, label, value, sub, color }) {
    return (
        <div style={{
            background: C.panelBg,
            border: `1px solid ${C.borderColor}`,
            borderRadius: 16,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            position: 'relative',
            overflow: 'hidden',
        }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '16px 16px 0 0' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: color + '18', color: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                }}>{icon}</div>
            </div>

            <div style={{ minWidth: 0 }}>
                <div title={value} style={{ fontSize: 24, fontWeight: 800, color: C.textPrimary, letterSpacing: '-0.5px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {value}
                </div>
                <div title={label} style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                {sub && <div title={sub} style={{ fontSize: 11, color: C.gray400, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
            </div>
        </div>
    );
}

// Custom Tooltip
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#1e293b', border: 'none', borderRadius: 10,
            padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,.25)',
            fontSize: 12, color: '#e2e8f0',
        }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: '#fff' }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color || '#10b981' }}>
                    {p.name}: <strong>{p.value}</strong>
                </div>
            ))}
        </div>
    );
};

const Dashboard = () => {
    const [contactAnalytics, setContactAnalytics] = React.useState(null);

    React.useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/wa/analytics');
                const data = await res.json();
                if (data.status === 'success') {
                    setContactAnalytics(data.data);
                }
            } catch (err) {
                console.error("Failed to fetch contact analytics", err);
            }
        };
        fetchAnalytics();
    }, []);

    const instances = useAppStore(state => state.instances) || [];
    const copilotCount = useAppStore(state => state.copilotRepliesGenerated) || 0;
    const tasks = useAppStore(state => state.tasks) || [];
    const invoices = useAppStore(state => state.invoices) || [];
    const userProfile = useAppStore(state => state.userProfile) || {};
    const language = useAppStore(state => state.appSettings?.language) || 'en';

    const activeInstancesCount = instances.filter(i => i.status !== 'offline').length || instances.length;

    const completedTasksCount = tasks.filter(t => t.status === 'completed').length;
    const totalTasksCount = tasks.length;
    const completedPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

    const mockChartData = useMemo(() => {
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayName = days[d.getDay()];
            const val = i === 0 ? copilotCount : Math.floor(Math.random() * 20) + 5;
            data.push({ name: dayName, replies: val });
        }
        return data;
    }, [copilotCount]);

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', animation: 'fadeIn 0.3s ease-in-out' }}>
            <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: '-0.5px' }}>
                        {t(language, 'welcomeBack')} {userProfile?.firstName || 'Ecrabet'} 👋
                    </h1>
                    <p style={{ color: C.textSecondary, fontSize: 13, margin: '5px 0 0' }}>
                        Voici un rapide aperçu de votre espace de travail.
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                <KPICard 
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>} 
                    label="Contacts Total" 
                    value={(contactAnalytics?.totalContacts || 0).toLocaleString()} 
                    sub="Dans la base de données" 
                    color={C.primary2} 
                />
                <KPICard 
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><circle cx="12" cy="10" r="3"></circle></svg>} 
                    label="Messages Envoyés" 
                    value={(contactAnalytics?.totalMessagesSent || 0).toLocaleString()} 
                    sub="Initiés via la plateforme" 
                    color={C.accent} 
                />
                <KPICard 
                    icon={Icons.phone} 
                    label={t(language, 'activeInstances') || 'Instances WhatsApp'} 
                    value={activeInstancesCount} 
                    sub="Instances connectées" 
                    color={C.primary} 
                />
                <KPICard 
                    icon={Icons.bot} 
                    label={t(language, 'copilotReplies') || 'Réponses Copilot'} 
                    value={copilotCount.toLocaleString()} 
                    sub="Interactions suggérées" 
                    color={C.accent} 
                />
                <KPICard 
                    icon={Icons.fileText} 
                    label={t(language, 'automatedInvoices') || 'Factures Générées'} 
                    value={invoices.length.toString()} 
                    sub="Factures créées" 
                    color={C.blue} 
                />
                <KPICard 
                    icon={Icons.checkCircle} 
                    label={t(language, 'tasksCompleted') || 'Tâches Complétées'} 
                    value={completedTasksCount.toString()} 
                    sub={`${completedPercentage}% progression (${totalTasksCount} au total)`} 
                    color={C.amber} 
                />
            </div>

            <div style={{
                background: C.panelBg,
                border: `1px solid ${C.borderColor}`,
                borderRadius: 16,
                padding: '24px',
            }}>
                <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
                        {t(language, 'recentActivity') || 'Activité Récente du Copilot'}
                    </h2>
                    <p style={{ fontSize: 12, color: C.textSecondary, margin: '3px 0 0' }}>
                        Évolution des réponses générées sur les 7 derniers jours
                    </p>
                </div>
                
                <div style={{ width: '100%' }}>
                    <ResponsiveContainer width="100%" height={280} minWidth={0}>
                        <AreaChart data={mockChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={C.primary} stopOpacity={0.35} />
                                    <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.gray200} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: C.gray400 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: C.gray400 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="replies" name="Réponses" stroke={C.primary} strokeWidth={3} fillOpacity={1} fill="url(#colorReplies)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
