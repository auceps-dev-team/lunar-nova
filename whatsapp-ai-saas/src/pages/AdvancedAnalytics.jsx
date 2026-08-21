import React, { useMemo, useState, useEffect } from 'react';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { API_BASE_URL } from '../config';
import {
    EMPTY_ARRAY, EMPTY_OBJECT, fmt, pct, MONTHS,
    buildMonthlyRevenue, buildAgentActivity, buildTaskStats,
    C, Icons,
} from '../utils/analyticsHelpers';
import { KPICard, SectionTitle, Panel, CustomTooltip, ZustandInspector } from '../components/analytics/AnalyticsUI';

// ── MAIN COMPONENT ────────────────────────────────────────────────

export default function AdvancedAnalytics() {
    const { t } = useTranslation();

    // Pull everything from Zustand
    const tasks = useAppStore(s => s.tasks) || EMPTY_ARRAY;
    const invoices = useAppStore(s => s.invoices) || EMPTY_ARRAY;
    const instances = useAppStore(s => s.instances) || EMPTY_ARRAY;
    const agentHistory = useAppStore(s => s.agentHistory) || EMPTY_ARRAY;
    const conversations = useAppStore(s => s.aiChatConversations) || EMPTY_OBJECT;
    const sessions = useAppStore(s => s.aiChatSessions) || EMPTY_OBJECT;
    const copilotCount = useAppStore(s => s.copilotRepliesGenerated) || 0;
    const appSettings = useAppStore(s => s.appSettings) || EMPTY_OBJECT;
    const userProfile = useAppStore(s => s.userProfile) || EMPTY_OBJECT;
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