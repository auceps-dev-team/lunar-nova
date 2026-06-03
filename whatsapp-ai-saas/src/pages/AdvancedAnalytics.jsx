import React, { useMemo, useState, useEffect } from 'react';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { API_BASE_URL } from '../config';

// ── Palette cohérente avec le projet ──────────────────────────────
const C = {
    primary: '#0b9f84',
    primary2: '#10b981',
    accent: '#6366f1',
    amber: '#f59e0b',
    red: '#ef4444',
    blue: '#3b82f6',
    purple: '#8b5cf6',
    gray100: '#f1f5f9',
    gray200: '#e2e8f0',
    gray400: '#94a3b8',
    gray500: '#64748b',
    gray700: '#334155',
    gray900: '#0f172a',
    panelBg: 'var(--panel-bg, #fff)',
    borderColor: 'var(--border-color, #e2e8f0)',
    textPrimary: 'var(--text-primary, #0f172a)',
    textSecondary: 'var(--text-secondary, #64748b)',
};

// ── Icons ─────────────────────────────────────────────────────────
const Icons = {
    message: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><circle cx="12" cy="10" r="3"></circle></svg>,
    bot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8V4H8"></path><rect x="4" y="8" width="16" height="12" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>,
    money: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path></svg>,
    checkCircle: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="M22 4L12 14.01l-3-3"></path></svg>,
    phone: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>,
    image: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg>,
    users: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    archive: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>,
    fileText: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
    clock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
    edit: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
    list: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>,
    play: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>,
    database: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>,
    key: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>,
    euro: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 10h12"></path><path d="M4 14h9"></path><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"></path></svg>
};

// ── Helpers ───────────────────────────────────────────────────────
const fmt = (n, cur = 'XOF') =>
    n.toLocaleString('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 0 });

const pct = (a, b) => (b === 0 ? 0 : Math.round((a / b) * 100));

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function buildMonthlyRevenue(invoices) {
    const d = MONTHS.map(name => ({ name, rev: 0, count: 0 }));
    (invoices || []).forEach(inv => {
        if (!inv.createdAt) return;
        const m = new Date(inv.createdAt).getMonth();
        const items = inv.items || [];
        const sub = items.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);
        const total = sub * (1 + (inv.taxRate || 0) / 100);
        d[m].rev += total;
        d[m].count += 1;
    });
    return d;
}

function buildAgentActivity(conversations) {
    if (!conversations || typeof conversations !== 'object') return [];
    return Object.entries(conversations)
        .map(([id, msgs]) => ({
            id,
            name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            messages: Array.isArray(msgs) ? msgs.length : 0,
            userMsgs: Array.isArray(msgs) ? msgs.filter(m => m.role === 'user').length : 0,
        }))
        .filter(a => a.messages > 0)
        .sort((a, b) => b.messages - a.messages)
        .slice(0, 8);
}

function buildTaskStats(tasks) {
    const todo = (tasks || []).filter(t => t.status === 'todo').length;
    const inProgress = (tasks || []).filter(t => t.status === 'in-progress').length;
    const completed = (tasks || []).filter(t => t.status === 'completed').length;
    const total = todo + inProgress + completed;
    const byTag = {};
    (tasks || []).forEach(t => { byTag[t.tag] = (byTag[t.tag] || 0) + 1; });
    return { todo, inProgress, completed, total, byTag };
}

// ── Sub-components ────────────────────────────────────────────────

function KPICard({ icon, label, value, sub, color, trend, trendUp }) {
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
            {/* Accent bar top */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '16px 16px 0 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: color + '18', color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                }}>{icon}</div>
                {trend && (
                    <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: trendUp ? C.primary2 : C.red,
                        background: (trendUp ? C.primary2 : C.red) + '15',
                        padding: '3px 8px', borderRadius: 20,
                    }}>
                        {trendUp ? '↑' : '↓'} {trend}
                    </span>
                )}
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

function SectionTitle({ children, sub }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{children}</h2>
            {sub && <p style={{ fontSize: 12, color: C.textSecondary, margin: '3px 0 0' }}>{sub}</p>}
        </div>
    );
}

function Panel({ children, style = {} }) {
    return (
        <div style={{
            background: C.panelBg,
            border: `1px solid ${C.borderColor}`,
            borderRadius: 16,
            padding: '20px 22px',
            ...style,
        }}>
            {children}
        </div>
    );
}

// ── Custom Tooltip ────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, format }) => {
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
                    {p.name}: <strong>{format === 'currency' ? fmt(p.value) : p.value}</strong>
                </div>
            ))}
        </div>
    );
};

// ── Zustand Cache Inspector ───────────────────────────────────────
function ZustandInspector({ storeData }) {
    const [expanded, setExpanded] = useState({});
    const toggle = key => setExpanded(p => ({ ...p, [key]: !p[key] }));

    const entries = Object.entries(storeData).map(([key, value]) => {
        let type = typeof value;
        let preview = '';
        let size = null;
        if (Array.isArray(value)) { type = 'array'; size = value.length; preview = `[${value.length} items]`; }
        else if (value === null) { type = 'null'; preview = 'null'; }
        else if (type === 'object') { size = Object.keys(value).length; preview = `{${size} keys}`; }
        else if (type === 'string') { preview = value.length > 50 ? value.slice(0, 50) + '…' : value; }
        else { preview = String(value); }
        return { key, value, type, preview, size };
    });

    const typeColor = {
        array: C.accent, object: C.blue, string: C.primary2,
        number: C.amber, boolean: C.purple, null: C.gray400,
    };

    return (
        <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {entries.map(({ key, value, type, preview }) => (
                <div key={key} style={{ marginBottom: 4 }}>
                    <div
                        onClick={() => (type === 'array' || type === 'object') && toggle(key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 10px', borderRadius: 8,
                            cursor: (type === 'array' || type === 'object') ? 'pointer' : 'default',
                            background: expanded[key] ? '#f0fdf4' : 'transparent',
                            transition: 'background .15s',
                        }}
                        onMouseEnter={e => { if (!expanded[key]) e.currentTarget.style.background = C.gray100; }}
                        onMouseLeave={e => { if (!expanded[key]) e.currentTarget.style.background = 'transparent'; }}
                    >
                        {(type === 'array' || type === 'object') && (
                            <span style={{ color: C.gray400, fontSize: 10 }}>{expanded[key] ? '▼' : '▶'}</span>
                        )}
                        <span style={{ color: C.gray700, fontWeight: 600, minWidth: 160 }}>{key}</span>
                        <span style={{
                            padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                            background: (typeColor[type] || C.gray400) + '20',
                            color: typeColor[type] || C.gray400,
                        }}>{type}</span>
                        <span style={{ color: C.gray500, fontSize: 11 }}>{preview}</span>
                    </div>

                    {expanded[key] && (
                        <div style={{
                            marginLeft: 24, padding: '8px 12px',
                            background: '#f8fafc', borderRadius: 8,
                            border: `1px solid ${C.gray200}`,
                            maxHeight: 200, overflowY: 'auto',
                            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                            color: C.gray700, fontSize: 11,
                            marginBottom: 4,
                        }}>
                            {JSON.stringify(value, null, 2)}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────

export default function AdvancedAnalytics() {
    const { t } = useTranslation();

    // Pull everything from Zustand
    const tasks = useAppStore(s => s.tasks) || [];
    const invoices = useAppStore(s => s.invoices) || [];
    const instances = useAppStore(s => s.instances) || [];
    const agentHistory = useAppStore(s => s.agentHistory) || [];
    const conversations = useAppStore(s => s.aiChatConversations) || {};
    const sessions = useAppStore(s => s.aiChatSessions) || {};
    const copilotCount = useAppStore(s => s.copilotRepliesGenerated) || 0;
    const appSettings = useAppStore(s => s.appSettings) || {};
    const userProfile = useAppStore(s => s.userProfile) || {};
    const language = appSettings.language || 'en';

    const [activeTab, setActiveTab] = useState('overview');
    const [contactAnalytics, setContactAnalytics] = useState(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const res = await fetch(API_BASE_URL + '/api/wa/analytics');
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

    // ── Computed metrics ──────────────────────────────────────────
    const taskStats = useMemo(() => buildTaskStats(tasks), [tasks]);
    const monthlyRev = useMemo(() => buildMonthlyRevenue(invoices), [invoices]);
    const agentActivity = useMemo(() => buildAgentActivity(conversations), [conversations]);

    const totalRevenue = useMemo(() =>
        invoices.reduce((sum, inv) => {
            const items = inv.items || [];
            const sub = items.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);
            return sum + sub * (1 + (inv.taxRate || 0) / 100);
        }, 0), [invoices]);

    const paidInvoices = invoices.filter(i => i.status === 'paid').length;
    const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').length;

    const totalMessages = useMemo(() =>
        Object.values(conversations).reduce((s, msgs) => s + (Array.isArray(msgs) ? msgs.length : 0), 0),
        [conversations]);

    const totalSessions = useMemo(() =>
        Object.values(sessions).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0),
        [sessions]);

    // Segments WhatsApp (from agentHistory product types)
    const productTypes = useMemo(() => {
        const counts = {};
        agentHistory.forEach(h => {
            if (h.productType) counts[h.productType] = (counts[h.productType] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [agentHistory]);

    // Task distribution for pie
    const taskPieData = [
        { name: t('toDo'), value: taskStats.todo, color: C.amber },
        { name: t('inProgress'), value: taskStats.inProgress, color: C.primary },
        { name: t('completed'), value: taskStats.completed, color: C.primary2 },
    ].filter(d => d.value > 0);

    // Invoice status pie
    const invoicePie = [
        { name: t('paidInvoices'), value: paidInvoices, color: C.primary2 },
        { name: t('pending'), value: pendingInvoices, color: C.amber },
        { name: t('drafts'), value: invoices.filter(i => i.status === 'draft').length, color: C.gray400 },
    ].filter(d => d.value > 0);

    // Full Zustand state snapshot for inspector
    const fullStore = useAppStore.getState ? useAppStore.getState() : {};

    // ── Tabs ──────────────────────────────────────────────────────
    const TABS = [
        { id: 'overview', label: t('overview') },
        { id: 'audience', label: t('waAudience') },
        { id: 'agents', label: t('aiAgents') },
        { id: 'revenue', label: t('revenue') },
        { id: 'tasks', label: t('tasks') },
        { id: 'cache', label: `🗄 ${t('storeCache')}` },
    ];

    const tabStyle = (id) => ({
        padding: '8px 18px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        border: 'none',
        background: activeTab === id ? C.primary : 'transparent',
        color: activeTab === id ? '#fff' : C.textSecondary,
        transition: 'all .15s',
    });

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', animation: 'fadeIn .3s ease' }}>

            {/* ── Header ── */}
            <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: '-0.5px' }}>
                        {t('advancedAnalytics')}
                    </h1>
                    <p style={{ color: C.textSecondary, fontSize: 13, margin: '5px 0 0' }}>
                        {t('workspaceOverview')} — {new Date().toLocaleDateString(language === 'en' ? 'en-US' : language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                {userProfile?.firstName && (
                    <div style={{ fontSize: 13, color: C.textSecondary }}>
                        {t('greetingHello')} <strong style={{ color: C.textPrimary }}>{userProfile.firstName}</strong>
                    </div>
                )}
            </div>

            {/* ── Tabs ── */}
            <div style={{
                display: 'flex', gap: 4, marginBottom: 28,
                background: C.gray100, padding: 5, borderRadius: 12,
                width: 'fit-content',
            }}>
                {TABS.map(tItem => (
                    <button key={tItem.id} style={tabStyle(tItem.id)} onClick={() => setActiveTab(tItem.id)}>
                        {tItem.label}
                    </button>
                ))}
            </div>

            {/* ════════════ TAB: OVERVIEW ════════════ */}
            {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* KPI Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        <KPICard icon={Icons.message} label={t('totalAiMessages')} value={totalMessages} color={C.primary} sub={`${totalSessions} ${t('archivedSessions')}`} />
                        <KPICard icon={Icons.bot} label={t('copilotReplies')} value={copilotCount} color={C.accent} sub={t('allInstances')} />
                        <KPICard icon={Icons.money} label={t('totalRevenue')} value={fmt(totalRevenue)} color={C.primary2} sub={`${invoices.length} ${t('invoicesCount')}`} />
                        <KPICard icon={Icons.checkCircle} label={t('tasksCompleted')} value={`${taskStats.completed}/${taskStats.total}`} color={C.amber} sub={`${pct(taskStats.completed, taskStats.total)}% ${t('completionRate').toLowerCase()}`} />
                        <KPICard icon={Icons.phone} label={t('instances')} value={instances.length} color={C.blue} sub={t('activeInWorkspace')} />
                        <KPICard icon={Icons.image} label={t('imageGenerations')} value={agentHistory.length} color={C.purple} sub={t('visualAgents')} />
                    </div>

                    {/* Revenue mini chart + Task donut */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
                        <Panel>
                            <SectionTitle sub={t('monthlyRevenueEvo')}>{t('monthlyRevenue')}</SectionTitle>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={monthlyRev} margin={{ left: -10, right: 10 }}>
                                    <defs>
                                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={C.primary} stopOpacity={0.35} />
                                            <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={C.gray200} vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.gray400 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: C.gray400 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip format="currency" />} />
                                    <Area type="monotone" dataKey="rev" name={t('revenue')} stroke={C.primary} strokeWidth={2.5} fill="url(#revGrad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Panel>

                        <Panel>
                            <SectionTitle sub={t('taskStatusDist')}>{t('tasks')}</SectionTitle>
                            {taskPieData.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="100%" height={160}>
                                        <PieChart>
                                            <Pie data={taskPieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                                                {taskPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                                        {taskPieData.map(d => (
                                            <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                                                    <span style={{ color: C.textSecondary }}>{d.name}</span>
                                                </div>
                                                <span style={{ fontWeight: 700, color: C.textPrimary }}>{d.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: C.gray400, fontSize: 13 }}>{t('noTasks')}</div>
                            )}
                        </Panel>
                    </div>
                </div>
            )}

            {/* ════════════ TAB: AUDIENCE WA ════════════ */}
            {activeTab === 'audience' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        <KPICard icon={Icons.users} label={t('totalContacts')} value={(contactAnalytics?.totalContacts || 0).toLocaleString()} color={C.primary2} />
                        <KPICard icon={Icons.message} label={t('messagesSent')} value={(contactAnalytics?.totalMessagesSent || 0).toLocaleString()} color={C.accent} />
                        <KPICard icon={Icons.checkCircle} label={t('validContacts')} value={(contactAnalytics?.byStatus?.find(s => s.name === 'valid')?.count || 0).toLocaleString()} color={C.blue} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                        <Panel>
                            <SectionTitle sub={t('globalAudienceDistribution')}>{t('contactsBySegment')}</SectionTitle>
                            {contactAnalytics?.bySegment?.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={contactAnalytics.bySegment} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="count" nameKey="name">
                                            {contactAnalytics.bySegment.map((e, i) => <Cell key={i} fill={[C.primary2, C.accent, C.blue, C.amber, C.purple, C.gray500][i % 6]} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: C.gray400, fontSize: 13 }}>{t('noData')}</div>
                            )}
                        </Panel>

                        <Panel>
                            <SectionTitle sub={t('volumeByMailingList')}>{t('contactsByList')}</SectionTitle>
                            {contactAnalytics?.byList?.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={contactAnalytics.byList} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.gray200} />
                                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.gray400 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: C.gray400 }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name={t('contacts')} fill={C.blue} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: C.gray400, fontSize: 13 }}>{t('noData')}</div>
                            )}
                        </Panel>

                        <Panel>
                            <SectionTitle sub={t('databaseHealth')}>{t('numberVerification')}</SectionTitle>
                            {contactAnalytics?.byStatus?.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={contactAnalytics.byStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="count" nameKey="name">
                                            {contactAnalytics.byStatus.map((e, i) => <Cell key={i} fill={e.name === 'valid' ? C.primary2 : (e.name === 'invalid' ? C.red : C.gray400)} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: C.gray400, fontSize: 13 }}>{t('noData')}</div>
                            )}
                        </Panel>
                    </div>
                </div>
            )}

            {/* ════════════ TAB: AGENTS IA ════════════ */}
            {activeTab === 'agents' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        <KPICard icon={Icons.message} label={t('exchangedMessages')} value={totalMessages} color={C.primary} />
                        <KPICard icon={Icons.archive} label={t('archivedSessions')} value={totalSessions} color={C.accent} />
                        <KPICard icon={Icons.users} label={t('usedAgents')} value={Object.keys(conversations).filter(k => (conversations[k]?.length || 0) > 0).length} color={C.blue} />
                        <KPICard icon={Icons.image} label={t('visualGenerations')} value={agentHistory.length} color={C.purple} />
                    </div>

                    <Panel>
                        <SectionTitle sub={t('messagesPerAgent')}>{t('agentActivity')}</SectionTitle>
                        {agentActivity.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={agentActivity} layout="vertical" margin={{ left: 10, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C.gray200} />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: C.gray400 }} axisLine={false} tickLine={false} />
                                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: C.gray700 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="messages" name={t('totalMessages')} fill={C.primary} radius={[0, 6, 6, 0]} />
                                    <Bar dataKey="userMsgs" name={t('userMessages')} fill={C.accent} radius={[0, 6, 6, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '60px 0', color: C.gray400, fontSize: 13 }}>
                                {t('noSavedConversationsChat')}
                            </div>
                        )}
                    </Panel>

                    {/* Agent history table */}
                    <Panel>
                        <SectionTitle sub={t('latestProductAnalyses')}>{t('visualGenerationHistory')}</SectionTitle>
                        {agentHistory.length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ borderBottom: `2px solid ${C.gray200}` }}>
                                            {[t('image'), t('product'), t('ambiance'), t('agent'), t('date')].map(h => (
                                                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: C.gray400, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {agentHistory.slice(0, 10).map(h => (
                                            <tr key={h.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                                                <td style={{ padding: '8px 12px' }}>
                                                    {h.image?.data ? (
                                                        <img src={h.image.data} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                                                    ) : (
                                                        <div style={{ width: 36, height: 36, background: C.gray100, borderRadius: 6 }} />
                                                    )}
                                                </td>
                                                <td style={{ padding: '8px 12px', color: C.textPrimary, fontWeight: 600 }}>{h.productType || '—'}</td>
                                                <td style={{ padding: '8px 12px', color: C.textSecondary }}>{h.targetAmbiance || h.selectedBackground?.name || '—'}</td>
                                                <td style={{ padding: '8px 12px' }}>
                                                    <span style={{ background: C.primary + '18', color: C.primary, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                                                        {h.agentId}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '8px 12px', color: C.gray400, fontSize: 11 }}>
                                                    {h.date ? new Date(h.date).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: C.gray400, fontSize: 13 }}>
                                {t('noImageGenerationSaved')}
                            </div>
                        )}
                    </Panel>
                </div>
            )}

            {/* ════════════ TAB: REVENUS ════════════ */}
            {activeTab === 'revenue' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        <KPICard icon={Icons.euro} label={t('totalCa')} value={fmt(totalRevenue)} color={C.primary2} />
                        <KPICard icon={Icons.checkCircle} label={t('paidInvoices')} value={paidInvoices} color={C.primary} sub={`${t('outOf')} ${invoices.length} ${t('total').toLowerCase()}`} />
                        <KPICard icon={Icons.clock} label={t('pending')} value={pendingInvoices} color={C.amber} />
                        <KPICard icon={Icons.edit} label={t('drafts')} value={invoices.filter(i => i.status === 'draft').length} color={C.gray400} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
                        <Panel>
                            <SectionTitle sub={t('invoicesPerMonth')}>{t('monthlyInvoices')}</SectionTitle>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={monthlyRev} margin={{ left: -10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.gray200} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.gray400 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: C.gray400 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip format="currency" />} />
                                    <Bar dataKey="rev" name={t('revenue')} radius={[6, 6, 0, 0]}>
                                        {monthlyRev.map((_, i) => (
                                            <Cell key={i} fill={i === new Date().getMonth() ? C.primary : C.primary + '60'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </Panel>

                        <Panel>
                            <SectionTitle sub={t('statusDistribution')}>{t('invoiceStatuses')}</SectionTitle>
                            {invoicePie.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="100%" height={160}>
                                        <PieChart>
                                            <Pie data={invoicePie} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={4} dataKey="value">
                                                {invoicePie.map((e, i) => <Cell key={i} fill={e.color} />)}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                                        {invoicePie.map(d => (
                                            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                                                    <span style={{ color: C.textSecondary }}>{d.name}</span>
                                                </div>
                                                <span style={{ fontWeight: 700, color: C.textPrimary }}>{d.value} ({pct(d.value, invoices.length)}%)</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: C.gray400, fontSize: 13 }}>{t('noInvoice')}</div>
                            )}
                        </Panel>
                    </div>

                    {/* Recent invoices table */}
                    <Panel>
                        <SectionTitle sub={t('last10Invoices')}>{t('recentInvoicesDetails')}</SectionTitle>
                        {invoices.length > 0 ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: `2px solid ${C.gray200}` }}>
                                        {[t('number'), t('client'), t('amount'), t('status'), t('date')].map(h => (
                                            <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: C.gray400, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...invoices].reverse().slice(0, 10).map(inv => {
                                        const items = inv.items || [];
                                        const sub = items.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);
                                        const total = sub * (1 + (inv.taxRate || 0) / 100);
                                        const statusColors = { paid: C.primary2, pending: C.amber, overdue: C.red, draft: C.gray400 };
                                        const statusLabels = { paid: t('paid'), pending: t('pending'), overdue: t('overdue'), draft: t('draft') };
                                        return (
                                            <tr key={inv.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                                                <td style={{ padding: '10px 12px', color: C.textPrimary, fontWeight: 600 }}>{inv.invoiceNumber}</td>
                                                <td style={{ padding: '10px 12px', color: C.textSecondary }}>{inv.clientName || '—'}</td>
                                                <td style={{ padding: '10px 12px', fontWeight: 700, color: C.textPrimary }}>{fmt(total, inv.currency)}</td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <span style={{
                                                        background: (statusColors[inv.status] || C.gray400) + '20',
                                                        color: statusColors[inv.status] || C.gray400,
                                                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                                    }}>{statusLabels[inv.status] || inv.status}</span>
                                                </td>
                                                <td style={{ padding: '10px 12px', color: C.gray400, fontSize: 11 }}>
                                                    {inv.issueDate || '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: C.gray400, fontSize: 13 }}>
                                {t('noInvoiceCreated')}
                            </div>
                        )}
                    </Panel>
                </div>
            )}

            {/* ════════════ TAB: TÂCHES ════════════ */}
            {activeTab === 'tasks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        <KPICard icon={Icons.list} label={t('totalTasks')} value={taskStats.total} color={C.primary} />
                        <KPICard icon={Icons.fileText} label={t('toDo')} value={taskStats.todo} color={C.amber} />
                        <KPICard icon={Icons.play} label={t('inProgress')} value={taskStats.inProgress} color={C.blue} />
                        <KPICard icon={Icons.checkCircle} label={t('completed')} value={taskStats.completed} color={C.primary2} sub={`${t('completionRate')}: ${pct(taskStats.completed, taskStats.total)}%`} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
                        <Panel>
                            <SectionTitle sub={t('tasksByCategory')}>{t('distributionByTag')}</SectionTitle>
                            {Object.keys(taskStats.byTag).length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart
                                        data={Object.entries(taskStats.byTag).map(([name, value]) => ({ name, value }))}
                                        margin={{ left: -10 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.gray200} />
                                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.gray400 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: C.gray400 }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="value" name={t('tasks')} fill={C.accent} radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '60px 0', color: C.gray400, fontSize: 13 }}>{t('noTasks')}</div>
                            )}
                        </Panel>

                        <Panel>
                            <SectionTitle sub={t('globalProgress')}>{t('completionRate')}</SectionTitle>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
                                <div style={{ position: 'relative', width: 120, height: 120 }}>
                                    <svg width="120" height="120" viewBox="0 0 120 120">
                                        <circle cx="60" cy="60" r="50" fill="none" stroke={C.gray200} strokeWidth="10" />
                                        <circle
                                            cx="60" cy="60" r="50"
                                            fill="none"
                                            stroke={C.primary2}
                                            strokeWidth="10"
                                            strokeLinecap="round"
                                            strokeDasharray={`${2 * Math.PI * 50}`}
                                            strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct(taskStats.completed, taskStats.total) / 100)}`}
                                            transform="rotate(-90 60 60)"
                                        />
                                    </svg>
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                        <span style={{ fontSize: 24, fontWeight: 800, color: C.textPrimary }}>{pct(taskStats.completed, taskStats.total)}%</span>
                                        <span style={{ fontSize: 10, color: C.gray400 }}>{t('complete')}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20, width: '100%' }}>
                                    {[
                                        { label: t('toDo'), value: taskStats.todo, color: C.amber },
                                        { label: t('inProgress'), value: taskStats.inProgress, color: C.primary },
                                        { label: t('completed'), value: taskStats.completed, color: C.primary2 },
                                    ].map(item => (
                                        <div key={item.label}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                                <span style={{ color: C.textSecondary }}>{item.label}</span>
                                                <span style={{ fontWeight: 700, color: C.textPrimary }}>{item.value}</span>
                                            </div>
                                            <div style={{ background: C.gray100, borderRadius: 4, height: 5, overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${pct(item.value, taskStats.total)}%`,
                                                    background: item.color, height: '100%', borderRadius: 4,
                                                    transition: 'width .5s ease',
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Panel>
                    </div>

                    {/* Recent tasks list */}
                    <Panel>
                        <SectionTitle sub={t('last10Tasks')}>{t('taskLog')}</SectionTitle>
                        {tasks.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {[...tasks].reverse().slice(0, 10).map(tItem => {
                                    const tagColors = { Development: C.primary2, Design: C.primary, Legal: C.accent, Marketing: C.amber, Sales: C.red };
                                    const statusDots = { 'todo': C.amber, 'in-progress': C.primary, 'completed': C.primary2 };
                                    return (
                                        <div key={tItem.id} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '10px 14px', borderRadius: 10,
                                            background: C.gray100, gap: 12,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusDots[tItem.status] || C.gray400, flexShrink: 0 }} />
                                                <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tItem.title}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                <span style={{
                                                    background: (tagColors[tItem.tag] || C.gray400) + '20',
                                                    color: tagColors[tItem.tag] || C.gray400,
                                                    padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                                                }}>{tItem.tag}</span>
                                                <span style={{ fontSize: 11, color: C.gray400 }}>{tItem.date}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: C.gray400, fontSize: 13 }}>
                                {t('noTaskCreated')}
                            </div>
                        )}
                    </Panel>
                </div>
            )}

            {/* ════════════ TAB: STORE CACHE ════════════ */}
            {activeTab === 'cache' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        <KPICard icon={Icons.key} label={t('keysInStore')} value={Object.keys(fullStore).length} color={C.accent} />
                        <KPICard icon={Icons.database} label={t('storedTasks')} value={tasks.length} color={C.primary} />
                        <KPICard icon={Icons.message} label={t('aiConversations')} value={Object.keys(conversations).length} color={C.blue} />
                        <KPICard icon={Icons.archive} label={t('archivedSessions')} value={totalSessions} color={C.purple} />
                    </div>

                    <Panel>
                        <SectionTitle sub={t('zustandStoreState')}>{t('cacheStoreInspector')}</SectionTitle>

                        <div style={{ marginBottom: 14, padding: '10px 14px', background: C.amber + '18', border: `1px solid ${C.amber}40`, borderRadius: 10, fontSize: 12, color: C.gray700 }}>
                            {t('zustandRealTimeWarning')}
                        </div>

                        <ZustandInspector storeData={fullStore} />
                    </Panel>

                    {/* Settings snapshot */}
                    <Panel>
                        <SectionTitle sub={t('currentAppConfig')}>{t('appSettings')}</SectionTitle>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                            {Object.entries(appSettings).map(([k, v]) => (
                                <div key={k} style={{
                                    padding: '10px 14px', background: C.gray100, borderRadius: 10,
                                    display: 'flex', flexDirection: 'column', gap: 4,
                                }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: C.gray400, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, wordBreak: 'break-all' }}>{String(v)}</span>
                                </div>
                            ))}
                            {Object.keys(appSettings).length === 0 && (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '24px', color: C.gray400, fontSize: 13 }}>
                                    {t('noParametersConfigured')}
                                </div>
                            )}
                        </div>
                    </Panel>
                </div>
            )}
        </div>
    );
}