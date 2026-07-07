import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import useAppStore from '../store';
import { API_BASE_URL } from '../config';
import { C, Ico, KPICard, StatusBadge, TabBtn, Card, CardHeader, Field, Input, EmptyState, Skeleton, Spin } from '../components/wordpress/WPUI';
import JarvisChat from '../components/wordpress/JarvisChat';

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WordPressBridge() {
    const { t } = useTranslation();
    const showAppNotification = useAppStore(s => s.showAppNotification);

    const [tab, setTab] = useState('connection');
    const [connections, setConnections] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [form, setForm] = useState({ name: '', site_url: '', wp_username: '', app_password: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(null);
    const [isDeleting, setIsDeleting] = useState(null);
    const [stats, setStats] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [analyticsPeriod, setAnalyticsPeriod] = useState('this_month');
    const [productModal, setProductModal] = useState(null);
    const [posts, setPosts] = useState([]);
    const [products, setProducts] = useState([]);
    const [logs, setLogs] = useState([]);
    const [logsPagination, setLogsPagination] = useState({ total: 0, pages: 1, per_page: 25, current_page: 1 });
    const [logsFilters, setLogsFilters] = useState({ status: '', page: 1, per_page: 25 });
    const [isLogsLoading, setIsLogsLoading] = useState(false);
    const [productsMeta, setProductsMeta] = useState({ categories: [], brands: [], types: [] });
    const [productsPagination, setProductsPagination] = useState({ total: 0, pages: 1, per_page: 25, current_page: 1 });
    const [productFilters, setProductFilters] = useState({ search: '', category: '', type: '', stock_status: '', brand: '', page: 1, per_page: 25 });
    const [isProductsLoading, setIsProductsLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const selected = connections.find(c => c.id === selectedId);

    // Fetch connections list
    const loadConnections = useCallback(async () => {
        try {
            const res = await fetch(API_BASE_URL + '/api/wp/connections');
            const d = await res.json();
            if (d.status === 'success') {
                setConnections(d.data);
                if (!selectedId && d.data.length > 0) setSelectedId(d.data[0].id);
            }
        } catch (e) { /* silent */ }
    }, [selectedId]);

    useEffect(() => { loadConnections(); }, [loadConnections]);

    // ── Dedicated logs loader (handles filters + pagination) ──
    const loadLogs = useCallback(async (filters, connId) => {
        if (!connId) return;
        setIsLogsLoading(true);
        try {
            const offset = (filters.page - 1) * filters.per_page;
            const r = await fetch(`${API_BASE_URL}/api/wp/${connId}/logs?limit=${filters.per_page}&offset=${offset}&status=${filters.status}`);
            const d = await r.json();
            if (d.status === 'success') {
                setLogs(d.data || []);
                if (d.pagination) setLogsPagination(d.pagination);
            }
        } catch (e) { /* silent */ }
        setIsLogsLoading(false);
    }, []);

    // ── Dedicated product loader (handles filters + pagination) ──
    const loadProducts = useCallback(async (filters, connId) => {
        if (!connId) return;
        setIsProductsLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('per_page', filters.per_page || 25);
            params.set('page', filters.page || 1);
            if (filters.search)       params.set('search', filters.search);
            if (filters.category)     params.set('category', filters.category);
            if (filters.type)         params.set('type', filters.type);
            if (filters.stock_status) params.set('stock_status', filters.stock_status);
            if (filters.brand)        params.set('brand', filters.brand);
            const r = await fetch(`${API_BASE_URL}/api/wp/${connId}/products?${params.toString()}`);
            const d = await r.json();
            if (d.status === 'success') {
                setProducts(d.data?.data || []);
                setProductsPagination({
                    total: d.data?.total || 0,
                    pages: d.data?.pages || 1,
                    per_page: d.data?.per_page || 25,
                    current_page: d.data?.current_page || 1,
                });
            }
        } catch (e) { /* silent */ }
        setIsProductsLoading(false);
    }, []);

    // ── Fetch data per tab ──
    useEffect(() => {
        if (!selectedId || tab === 'connection') return;
        setIsLoading(true);
        const load = async () => {
            try {
                if (tab === 'overview') {
                    let d_start = ''; let d_end = '';
                    const now = new Date();
                    if (analyticsPeriod === 'this_month') {
                        d_start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                        d_end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                    } else if (analyticsPeriod === 'last_month') {
                        d_start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
                        d_end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                    } else if (analyticsPeriod === 'this_year') {
                        d_start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                        d_end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
                    }
                    const [rStats, rAna] = await Promise.all([
                        fetch(`${API_BASE_URL}/api/wp/${selectedId}/stats`),
                        fetch(`${API_BASE_URL}/api/wp/${selectedId}/analytics?date_start=${d_start} 00:00:00&date_end=${d_end} 23:59:59`)
                    ]);
                    const dStats = await rStats.json();
                    const dAna = await rAna.json();
                    if (dStats.status === 'success') setStats(dStats.data);
                    if (dAna.status === 'success') setAnalytics(dAna.data);
                } else if (tab === 'posts') {
                    const r = await fetch(`${API_BASE_URL}/api/wp/${selectedId}/posts?limit=20`);
                    const d = await r.json();
                    if (d.status === 'success') setPosts(d.data?.data || []);
                } else if (tab === 'shop') {
                    // Reset filters when switching site or tab, load products + meta + orders in parallel
                    const resetFilters = { search: '', category: '', type: '', stock_status: '', brand: '', page: 1, per_page: 25 };
                    setProductFilters(resetFilters);
                    const [metaR, orderR] = await Promise.all([
                        fetch(`${API_BASE_URL}/api/wp/${selectedId}/products/meta`),
                        fetch(`${API_BASE_URL}/api/wp/${selectedId}/orders?limit=15`),
                    ]);
                    const metaD = await metaR.json();
                    const od = await orderR.json();
                    if (metaD.status === 'success') setProductsMeta(metaD.data || { categories: [], brands: [], types: [] });
                    if (od.status === 'success') setOrders(od.data?.data || []);
                    await loadProducts(resetFilters, selectedId);
                } else if (tab === 'logs') {
                    // Reset filters when switching to logs tab
                    const resetFilters = { status: '', page: 1, per_page: 25 };
                    setLogsFilters(resetFilters);
                    await loadLogs(resetFilters, selectedId);
                }
            } catch (e) { /* silent */ }
            setIsLoading(false);
        };
        load();
    }, [selectedId, tab, analyticsPeriod, loadProducts, loadLogs]);

    const handleAdd = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await fetch(API_BASE_URL + '/api/wp/connections', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const d = await res.json();
            if (d.status === 'success') {
                showAppNotification(t('wpSiteConnectedSuccess'), 'success');
                setForm({ name: '', site_url: '', wp_username: '', app_password: '' });
                await loadConnections();
                setSelectedId(d.data.id);
            } else throw new Error(d.error);
        } catch (e) { showAppNotification(t('wpErrorPrefix') + e.message, 'error'); }
        setIsSaving(false);
    };

    const handleTest = async (id) => {
        setIsTesting(id);
        try {
            const res = await fetch(`${API_BASE_URL}/api/wp/connections/${id}/test`, { method: 'POST' });
            const d = await res.json();
            if (d.status === 'success') showAppNotification(`✅ ${d.site_name} (WP ${d.wp_version})`, 'success');
            else showAppNotification('❌ ' + d.error, 'error');
        } catch (e) { showAppNotification(t('wpErrorPrefix') + e.message, 'error'); }
        setIsTesting(null);
    };

    const handleDelete = async (id) => {
        setIsDeleting(id);
        try {
            await fetch(`${API_BASE_URL}/api/wp/connections/${id}`, { method: 'DELETE' });
            showAppNotification(t('wpSiteDeletedSuccess'), 'success');
            if (selectedId === id) setSelectedId(null);
            await loadConnections();
        } catch (e) { showAppNotification(t('wpErrorPrefix') + e.message, 'error'); }
        setIsDeleting(null);
    };

    return (
        <>
            {/* CSS animations */}
            <style>{`
                @keyframes shimmer { to { background-position: -200% 0; } }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes bounce { 0%, 100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-6px); opacity: 1; } }
                
                .dark {
                    --text-primary: #f8fafc;
                    --text-secondary: #a1a1aa;
                    --panel-bg: #27272a;
                    --border-color: #3f3f46;
                    --input-bg: #18181b;
                }
            `}</style>

            <div style={{ maxWidth: 1060, margin: '0 auto', animation: 'fadeUp 0.3s ease' }}>

                {/* ── Page Header ── */}
                <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                            width: 46, height: 46, borderRadius: 14,
                            background: `linear-gradient(135deg, ${C.primary}, ${C.accent})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', boxShadow: `0 4px 20px ${C.primary}40`, flexShrink: 0,
                        }}>
                            {Ico.wp}
                        </div>
                        <div>
                            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.5px' }}>{t('wordpressBridge')}</h1>
                            <p style={{ fontSize: 13, color: C.textSub, margin: '3px 0 0' }}>{t('wpHeaderSubtitle')}</p>
                        </div>
                    </div>

                    {/* Site Selector */}
                    {connections.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: C.textSub, fontWeight: 600 }}>{t('wpActiveSite')}</span>
                            <select
                                value={selectedId || ''}
                                onChange={e => setSelectedId(Number(e.target.value))}
                                style={{
                                    background: C.panel, border: `1px solid ${C.border}`,
                                    color: C.text, borderRadius: 10, padding: '6px 12px',
                                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                    outline: 'none',
                                }}
                            >
                                {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* ── Tabs ── */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 24, padding: '4px', background: C.border + '50', borderRadius: 14, width: 'fit-content' }}>
                    <TabBtn active={tab === 'connection'} icon={Ico.plug}  label={t('wpTabConnection')} onClick={() => setTab('connection')} />
                    <TabBtn active={tab === 'overview'}   icon={Ico.chart} label={t('wpTabOverview')}   onClick={() => setTab('overview')} />
                    <TabBtn active={tab === 'posts'}      icon={Ico.file}  label={t('wpTabPosts')}      onClick={() => setTab('posts')} />
                    <TabBtn active={tab === 'shop'}       icon={Ico.bag}   label={t('wpTabShop')}       onClick={() => setTab('shop')} />
                    <TabBtn active={tab === 'logs'}       icon={Ico.shield} label={t('wpTabLogs')}      onClick={() => setTab('logs')} />
                </div>

                {/* ══ TAB: CONNEXION ══════════════════════════════════════════ */}
                {tab === 'connection' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                        {/* Add form */}
                        <Card>
                            <CardHeader
                                title={t('wpAddSiteTitle')}
                                sub={t('wpAddSiteSub')}
                            />
                            <form onSubmit={handleAdd} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <Field label={t('wpFieldSiteName')}>
                                    <Input required type="text" placeholder={t('wpPlaceholderSiteName')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                                </Field>
                                <Field label={t('wpFieldSiteUrl')}>
                                    <Input required type="url" placeholder="https://ma-boutique.com" value={form.site_url} onChange={e => setForm({ ...form, site_url: e.target.value })} />
                                </Field>
                                <Field label={t('wpFieldWpUsername')} hint={t('wpHintWpUsername')}>
                                    <Input required mono type="text" placeholder="admin" value={form.wp_username} onChange={e => setForm({ ...form, wp_username: e.target.value })} />
                                </Field>
                                <Field label={t('wpFieldAppPassword')} hint={t('wpHintAppPassword')}>
                                    <Input required mono type="password" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" value={form.app_password} onChange={e => setForm({ ...form, app_password: e.target.value })} />
                                </Field>
                                <button type="submit" disabled={isSaving} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    padding: '10px 20px', borderRadius: 10, border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer',
                                    background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                                    color: '#fff', fontSize: 13, fontWeight: 700,
                                    boxShadow: `0 2px 12px ${C.primary}50`,
                                    opacity: isSaving ? 0.7 : 1, transition: 'all 0.18s',
                                }}>
                                    {isSaving ? <><Spin /> {t('wpConnecting')}</> : t('wpConnectSite')}
                                </button>
                            </form>

                            {/* App Password hint */}
                            <div style={{ margin: '0 22px 22px', padding: '12px 16px', background: C.primary + '0d', border: `1px solid ${C.primary}25`, borderRadius: 10 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 6 }}>{t('wpGenAppPasswordTitle')}</div>
                                <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7 }}>
                                    <strong>1.</strong> {t('wpGenStep1')}<br/>
                                    <strong>2.</strong> {t('wpGenStep2')}<br/>
                                    <strong>3.</strong> {t('wpGenStep3')}<br/>
                                    <strong>4.</strong> {t('wpGenStep4')}
                                </div>
                            </div>
                        </Card>

                        {/* Connected sites */}
                        <Card>
                            <CardHeader title={t('wpConnectedSitesTitle', { count: connections.length })} sub={t('wpConnectedSitesSub')} />
                            <div style={{ padding: connections.length === 0 ? 0 : '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {connections.length === 0 ? (
                                    <EmptyState icon={Ico.wp} title={t('wpNoSiteTitle')} sub={t('wpNoSiteSub')} />
                                ) : connections.map(conn => {
                                    const isSelected = selectedId === conn.id;
                                    return (
                                        <div key={conn.id} onClick={() => setSelectedId(conn.id)} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                                            border: `1px solid ${isSelected ? C.primary + '40' : C.border}`,
                                            background: isSelected ? C.primary + '0d' : 'transparent',
                                            transition: 'all 0.18s',
                                        }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                                background: isSelected ? C.primary + '25' : C.border + '80',
                                                color: isSelected ? C.primary : C.textSub,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                {Ico.wp}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conn.name}</div>
                                                <div style={{ fontSize: 11, color: C.textSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conn.site_url}</div>
                                            </div>
                                            {/* Actions */}
                                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleTest(conn.id); }}
                                                    disabled={isTesting === conn.id}
                                                    title={t('wpTestConnection')}
                                                    style={{ padding: '5px 8px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: C.textSub, display: 'flex', alignItems: 'center' }}
                                                >
                                                    {isTesting === conn.id ? <Spin /> : Ico.link}
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleDelete(conn.id); }}
                                                    disabled={isDeleting === conn.id}
                                                    title={t('delete')}
                                                    style={{ padding: '5px 8px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
                                                >
                                                    {Ico.trash}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    </div>
                )}

                {/* ══ TAB: OVERVIEW ══════════════════════════════════════════ */}
                {tab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {!selected && <EmptyState icon={Ico.wp} title={t('wpNoSiteSelectedTitle')} sub={t('wpNoSiteSelectedSub')} />}
                        {selected && isLoading && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                                    {[1,2,3,4].map(k => <div key={k} style={{ padding: 22, borderRadius: 16, border: `1px solid ${C.border}` }}><Skeleton h={60} /></div>)}
                                </div>
                            </div>
                        )}
                        {selected && !isLoading && stats && (
                            <>
                                {/* Site identity */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.primary}, ${C.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                                        {Ico.globe}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{stats.site_name}</div>
                                        <div style={{ fontSize: 12, color: C.textSub }}>{stats.site_url} · WordPress {stats.wp_version}</div>
                                    </div>
                                    {/* Plugin badges */}
                                    <div style={{ display: 'flex', gap: 6, marginLeft: 8, flexWrap: 'wrap' }}>
                                        {stats.plugins?.woocommerce && <span style={{ background: '#7c3aed18', color: '#7c3aed', border: '1px solid #7c3aed25', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999 }}>🛒 WooCommerce</span>}
                                        {stats.plugins?.aio_seo    && <span style={{ background: '#2563eb18', color: '#2563eb', border: '1px solid #2563eb25', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999 }}>🔍 AIO SEO</span>}
                                        {stats.plugins?.yoast_seo  && <span style={{ background: '#dc262618', color: '#dc2626', border: '1px solid #dc262625', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999 }}>🏆 Yoast</span>}
                                    </div>
                                </div>

                                {/* KPI Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                                    <KPICard icon={Ico.file} label={t('wpKpiPosts')}  value={stats.total_posts}    sub={t('wpKpiPostsSub')} color={C.primary2} />
                                    <KPICard icon={Ico.globe} label={t('wpKpiPages')}            value={stats.total_pages}    sub={t('wpKpiPagesSub')}   color={C.blue} />
                                    <KPICard icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>} label={t('wpKpiComments')} value={stats.total_comments} sub={t('wpKpiCommentsSub')} color={C.accent} />
                                    {stats.woocommerce && <KPICard icon={Ico.bag} label={t('products')} value={stats.woocommerce.total_products} sub="WooCommerce" color={C.purple} />}
                                    {stats.woocommerce && <KPICard icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>} label={t('wpKpiOrders')} value={stats.woocommerce.total_orders} sub={t('wpKpiOrdersSub')} color={C.amber} />}
                                </div>

                                {/* Performances (WooCommerce Analytics) */}
                                {analytics && stats.woocommerce && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {/* ── NATIVE-LIKE WOO KPI ROW ── */}
                                        <Card>
                                            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{t('wpPerformances')}</div>
                                                </div>
                                                <select value={analyticsPeriod} onChange={e => setAnalyticsPeriod(e.target.value)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, outline: 'none', cursor: 'pointer', background: '#f8fafc', fontWeight: 600 }}>
                                                    <option value="this_month">{t('wpPeriodThisMonth')}</option>
                                                    <option value="last_month">{t('wpPeriodLastMonth')}</option>
                                                    <option value="this_year">{t('wpPeriodThisYear')}</option>
                                                </select>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
                                                {/* Total des ventes */}
                                                <div style={{ padding: '24px 22px', borderRight: `1px solid ${C.border}` }}>
                                                    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8, fontWeight: 500 }}>{t('wpTotalSales')}</div>
                                                    <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{analytics.currency}{(analytics.total_sales||0).toLocaleString('fr-FR')}</div>
                                                </div>
                                                {/* Ventes nettes */}
                                                <div style={{ padding: '24px 22px', borderRight: `1px solid ${C.border}` }}>
                                                    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8, fontWeight: 500 }}>{t('wpNetSales')}</div>
                                                    <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{analytics.currency}{(analytics.net_sales||0).toLocaleString('fr-FR')}</div>
                                                </div>
                                                {/* Commandes */}
                                                <div style={{ padding: '24px 22px', borderRight: `1px solid ${C.border}` }}>
                                                    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8, fontWeight: 500 }}>{t('wpKpiOrders')}</div>
                                                    <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{analytics.orders_count || 0}</div>
                                                </div>
                                                {/* Produits vendus */}
                                                <div style={{ padding: '24px 22px', borderRight: `1px solid ${C.border}` }}>
                                                    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8, fontWeight: 500 }}>{t('wpProductsSold')}</div>
                                                    <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{analytics.products_sold || 0}</div>
                                                </div>
                                                {/* Taxes (Replaces variations) */}
                                                <div style={{ padding: '24px 22px' }}>
                                                    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8, fontWeight: 500 }}>{t('wpTaxesCollected')}</div>
                                                    <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{analytics.currency}{(analytics.taxes||0).toLocaleString('fr-FR')}</div>
                                                </div>
                                            </div>
                                        </Card>

                                        {/* ── TABLEAUX (Side by Side Charts) ── */}
                                        <div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12 }}>{t('wpTablesTitle')}</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20 }}>
                                                
                                                {/* Ventes Nettes Chart */}
                                                <Card>
                                                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 14 }}>
                                                        {t('wpNetSales')}
                                                    </div>
                                                    <div style={{ padding: 20, height: 280, width: '100%' }}>
                                                        {analytics.chart_data && analytics.chart_data.length > 0 ? (
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <LineChart data={analytics.chart_data}>
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                                                                    <XAxis dataKey="date" tickFormatter={str => str.substring(8, 10)} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: C.textSub }} dy={10} />
                                                                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: C.textSub }} dx={-10} tickFormatter={val => `${val}`} />
                                                                    <Tooltip
                                                                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}
                                                                        labelStyle={{ color: C.textSub, marginBottom: 4 }}
                                                                        formatter={(value) => [`${analytics.currency}${value.toLocaleString('fr-FR')}`, t('wpNetSales')]}
                                                                        labelFormatter={label => t('wpDayLabel', { day: label })}
                                                                    />
                                                                    <Line type="monotone" dataKey="net_sales" stroke={C.primary} strokeWidth={3} dot={{ r: 3, fill: C.primary, strokeWidth: 0 }} activeDot={{ r: 6, fill: C.primary }} />
                                                                </LineChart>
                                                            </ResponsiveContainer>
                                                        ) : (
                                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 13 }}>
                                                                {t('wpNoChartData')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </Card>

                                                {/* Commandes Chart */}
                                                <Card>
                                                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 14 }}>
                                                        {t('wpKpiOrders')}
                                                    </div>
                                                    <div style={{ padding: 20, height: 280, width: '100%' }}>
                                                        {analytics.chart_data && analytics.chart_data.length > 0 ? (
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <LineChart data={analytics.chart_data}>
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                                                                    <XAxis dataKey="date" tickFormatter={str => str.substring(8, 10)} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: C.textSub }} dy={10} />
                                                                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: C.textSub }} dx={-10} allowDecimals={false} />
                                                                    <Tooltip
                                                                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}
                                                                        labelStyle={{ color: C.textSub, marginBottom: 4 }}
                                                                        formatter={(value) => [value, t('wpKpiOrders')]}
                                                                        labelFormatter={label => t('wpDayLabel', { day: label })}
                                                                    />
                                                                    <Line type="monotone" dataKey="orders" stroke={C.blue} strokeWidth={3} dot={{ r: 3, fill: C.blue, strokeWidth: 0 }} activeDot={{ r: 6, fill: C.blue }} />
                                                                </LineChart>
                                                            </ResponsiveContainer>
                                                        ) : (
                                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 13 }}>
                                                                {t('wpNoChartData')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </Card>

                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ══ TAB: POSTS ══════════════════════════════════════════════ */}
                {tab === 'posts' && (
                    <div>
                        {!selected && <EmptyState icon={Ico.file} title={t('wpNoSiteSelectedTitle')} sub={t('wpSelectSiteSub')} />}
                        {selected && isLoading && <Card><div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3,4,5].map(k => <Skeleton key={k} h={60} />)}</div></Card>}
                        {selected && !isLoading && (
                            <Card>
                                <CardHeader title={t('wpPostsTitle', { site: selected.name })} sub={t('wpPostsLoadedCount', { count: posts.length })} />
                                <div>
                                    {posts.length === 0 && <EmptyState icon={Ico.file} title={t('wpNoPostsTitle')} sub={t('wpNoPostsSub')} />}
                                    {posts.map((post, i) => (
                                        <div key={post.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                                            borderBottom: i < posts.length - 1 ? `1px solid ${C.border}` : 'none',
                                            transition: 'background 0.15s',
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {post.thumbnail
                                                ? <img src={post.thumbnail} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: C.border }} />
                                                : <div style={{ width: 48, height: 48, borderRadius: 10, background: C.border + '80', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, flexShrink: 0 }}>{Ico.file}</div>
                                            }
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>{post.title}</span>
                                                    <StatusBadge status={post.status} />
                                                </div>
                                                <div style={{ fontSize: 11, color: C.textSub, marginTop: 3, display: 'flex', gap: 8 }}>
                                                    <span>{new Date(post.date).toLocaleDateString('fr-FR')}</span>
                                                    <span>·</span>
                                                    <span>{post.author}</span>
                                                    {post.categories?.length > 0 && <><span>·</span><span>{post.categories.join(', ')}</span></>}
                                                </div>
                                            </div>
                                            <a href={post.url} target="_blank" rel="noreferrer" style={{ color: C.textSub, display: 'flex', padding: 6, borderRadius: 8, transition: 'color 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.color = C.primary}
                                                onMouseLeave={e => e.currentTarget.style.color = C.textSub}>
                                                {Ico.link}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>
                )}

                {/* ══ TAB: SHOP ═══════════════════════════════════════════════ */}
                {tab === 'shop' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {!selected && <EmptyState icon={Ico.bag} title={t('wpNoSiteSelectedTitle')} sub={t('wpSelectSiteSub')} />}
                        {selected && isLoading && <Card><div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3].map(k => <Skeleton key={k} h={60} />)}</div></Card>}
                        {selected && !isLoading && (
                            <>
                                {/* ── Filter Bar (WooCommerce-style) ── */}
                                <Card>
                                    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {/* Row 1: search + per page */}
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                            {/* Search */}
                                            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
                                                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textSub, pointerEvents: 'none', display: 'flex' }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                                                </span>
                                                <input
                                                    id="wp-product-search"
                                                    type="text"
                                                    value={productFilters.search}
                                                    onChange={e => setProductFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
                                                    onKeyDown={e => e.key === 'Enter' && loadProducts({ ...productFilters, page: 1 }, selectedId)}
                                                    placeholder={t('wpSearchProductPlaceholder')}
                                                    style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px 8px 32px', fontSize: 13, outline: 'none', background: '#f8fafc', color: C.text, boxSizing: 'border-box' }}
                                                />
                                            </div>

                                            {/* Category */}
                                            {productsMeta.categories.length > 0 && (
                                                <select id="wp-filter-cat" value={productFilters.category}
                                                    onChange={e => setProductFilters(f => ({ ...f, category: e.target.value, page: 1 }))}
                                                    style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#f8fafc', color: C.text, cursor: 'pointer', minWidth: 170 }}>
                                                    <option value="">{t('wpSelectCategory')}</option>
                                                    {productsMeta.categories.map(c => <option key={c.slug} value={c.slug}>{c.name} ({c.count})</option>)}
                                                </select>
                                            )}

                                            {/* Product type */}
                                            {productsMeta.types.length > 0 && (
                                                <select id="wp-filter-type" value={productFilters.type}
                                                    onChange={e => setProductFilters(f => ({ ...f, type: e.target.value, page: 1 }))}
                                                    style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#f8fafc', color: C.text, cursor: 'pointer', minWidth: 170 }}>
                                                    <option value="">{t('wpFilterType')}</option>
                                                    {productsMeta.types.map(pt => <option key={pt.slug} value={pt.slug}>{pt.name} ({pt.count})</option>)}
                                                </select>
                                            )}

                                            {/* Stock status */}
                                            <select id="wp-filter-stock" value={productFilters.stock_status}
                                                onChange={e => setProductFilters(f => ({ ...f, stock_status: e.target.value, page: 1 }))}
                                                style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#f8fafc', color: C.text, cursor: 'pointer', minWidth: 190 }}>
                                                <option value="">{t('wpFilterStock')}</option>
                                                <option value="instock">{t('wpStockIn')}</option>
                                                <option value="outofstock">{t('wpStockOut')}</option>
                                                <option value="onbackorder">{t('wpStockBackorder')}</option>
                                            </select>

                                            {/* Brand */}
                                            {productsMeta.brands.length > 0 && (
                                                <select id="wp-filter-brand" value={productFilters.brand}
                                                    onChange={e => setProductFilters(f => ({ ...f, brand: e.target.value, page: 1 }))}
                                                    style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#f8fafc', color: C.text, cursor: 'pointer', minWidth: 150 }}>
                                                    <option value="">{t('wpFilterBrand')}</option>
                                                    {productsMeta.brands.map(b => <option key={b.slug} value={b.slug}>{b.name} ({b.count})</option>)}
                                                </select>
                                            )}

                                            {/* Apply + Reset buttons */}
                                            <button id="wp-filter-apply"
                                                onClick={() => loadProducts({ ...productFilters, page: 1 }, selectedId)}
                                                style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'opacity 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                                {t('wpApplyFilter')}
                                            </button>
                                            {(productFilters.search || productFilters.category || productFilters.type || productFilters.stock_status || productFilters.brand) && (
                                                <button id="wp-filter-reset"
                                                    onClick={() => {
                                                        const reset = { search: '', category: '', type: '', stock_status: '', brand: '', page: 1, per_page: productFilters.per_page };
                                                        setProductFilters(reset);
                                                        loadProducts(reset, selectedId);
                                                    }}
                                                    style={{ background: 'transparent', color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                    {t('wpResetFilter')}
                                                </button>
                                            )}
                                        </div>

                                        {/* Row 2: total + per page selector */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                            <span style={{ fontSize: 12, color: C.textSub, fontWeight: 500 }}>
                                                {isProductsLoading ? t('loading') : t('wpItemsFound', { count: productsPagination.total })}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: 12, color: C.textSub }}>{t('wpShowPerPage')}</span>
                                                {[25, 50, 100].map(n => (
                                                    <button key={n} onClick={() => {
                                                        const f = { ...productFilters, per_page: n, page: 1 };
                                                        setProductFilters(f);
                                                        loadProducts(f, selectedId);
                                                    }} style={{
                                                        background: productFilters.per_page === n ? C.primary : 'transparent',
                                                        color: productFilters.per_page === n ? '#fff' : C.textSub,
                                                        border: `1px solid ${productFilters.per_page === n ? C.primary : C.border}`,
                                                        borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                                                    }}>{n}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                {/* ── Products Table ── */}
                                <Card>
                                    <div style={{ overflowX: 'auto' }}>
                                        {isProductsLoading ? (
                                            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {[1,2,3,4,5].map(k => <Skeleton key={k} h={52} />)}
                                            </div>
                                        ) : products.length === 0 ? (
                                            <EmptyState icon={Ico.bag} title={t('wpNoProductsTitle')} sub={t('wpNoProductsSub')} />
                                        ) : (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', color: C.textSub }}>
                                                        <th style={{ width: 44, padding: '10px 14px' }}></th>
                                                        {[t('name'), t('wpColSku'), t('wpColType'), t('wpColStock'), t('price'), t('wpColCategories'), t('wpColBrands'), t('status'), ''].map(h => (
                                                            <th key={h} style={{ padding: '10px 14px', fontWeight: 700, fontSize: 11, textAlign: 'left', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {products.map((p, i) => (
                                                        <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                            {/* Thumbnail */}
                                                            <td style={{ padding: '10px 8px 10px 14px' }}>
                                                                {p.thumbnail
                                                                    ? <img src={p.thumbnail} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', display: 'block', background: C.border }} />
                                                                    : <div style={{ width: 40, height: 40, borderRadius: 8, background: C.border + '80', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub }}>{Ico.bag}</div>
                                                                }
                                                            </td>
                                                            {/* Name */}
                                                            <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                                                                <div style={{ fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                                            </td>
                                                            {/* SKU */}
                                                            <td style={{ padding: '10px 14px', color: C.textSub, fontFamily: 'monospace', fontSize: 12 }}>{p.sku || '—'}</td>
                                                            {/* Type */}
                                                            <td style={{ padding: '10px 14px' }}>
                                                                <span style={{ background: '#e0e7ff', color: '#3730a3', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>
                                                                    {{ simple: t('wpTypeSimple'), variable: t('wpTypeVariable'), grouped: t('wpTypeGrouped'), external: t('wpTypeExternal') }[p.type] || p.type}
                                                                </span>
                                                            </td>
                                                            {/* Stock */}
                                                            <td style={{ padding: '10px 14px' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                    <span style={{
                                                                        fontSize: 11, fontWeight: 700,
                                                                        color: p.stock_status === 'instock' ? '#16a34a' : p.stock_status === 'outofstock' ? '#dc2626' : '#d97706',
                                                                    }}>
                                                                        {{ instock: t('wpStockInShort'), outofstock: t('wpStockOutShort'), onbackorder: t('wpStockBackorderShort') }[p.stock_status] || p.stock_status}
                                                                    </span>
                                                                    {p.stock_quantity != null && <span style={{ fontSize: 11, color: C.textSub }}>{t('wpQtyLabel', { qty: p.stock_quantity })}</span>}
                                                                </div>
                                                            </td>
                                                            {/* Price */}
                                                            <td style={{ padding: '10px 14px', fontWeight: 800, color: C.text, whiteSpace: 'nowrap' }}>
                                                                {p.sale_price ? (
                                                                    <div>
                                                                        <span style={{ textDecoration: 'line-through', color: C.textSub, fontWeight: 400, marginRight: 6 }}>{p.regular_price}</span>
                                                                        <span style={{ color: '#dc2626' }}>{p.sale_price}</span>
                                                                    </div>
                                                                ) : (p.price || '—')}
                                                            </td>
                                                            {/* Categories */}
                                                            <td style={{ padding: '10px 14px', maxWidth: 160 }}>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                                    {(p.categories || []).map(c => (
                                                                        <span key={c.id} style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '1px 7px', borderRadius: 999 }}>{c.name}</span>
                                                                    ))}
                                                                    {(!p.categories || p.categories.length === 0) && <span style={{ color: C.textSub }}>—</span>}
                                                                </div>
                                                            </td>
                                                            {/* Brands */}
                                                            <td style={{ padding: '10px 14px', maxWidth: 140 }}>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                                    {(p.brands || []).map(b => (
                                                                        <span key={b.id} style={{ fontSize: 11, background: '#fce7f3', color: '#be185d', padding: '1px 7px', borderRadius: 999 }}>{b.name}</span>
                                                                    ))}
                                                                    {(!p.brands || p.brands.length === 0) && <span style={{ color: C.textSub }}>—</span>}
                                                                </div>
                                                            </td>
                                                            {/* Status */}
                                                            <td style={{ padding: '10px 14px' }}><StatusBadge status={p.status} /></td>
                                                            {/* Actions */}
                                                            <td style={{ padding: '10px 14px' }}>
                                                                <div style={{ display: 'flex', gap: 6 }}>
                                                                    <button onClick={() => setProductModal(p)} title={t('wpViewDescription')}
                                                                        style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: C.textSub, transition: 'color 0.15s, border-color 0.15s' }}
                                                                        onMouseEnter={e => { e.currentTarget.style.color = C.primary; e.currentTarget.style.borderColor = C.primary; }}
                                                                        onMouseLeave={e => { e.currentTarget.style.color = C.textSub; e.currentTarget.style.borderColor = C.border; }}>
                                                                        {Ico.eye}
                                                                    </button>
                                                                    <a href={p.url} target="_blank" rel="noreferrer" title={t('wpViewOnSite')}
                                                                        style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: C.textSub, textDecoration: 'none', transition: 'color 0.15s, border-color 0.15s' }}
                                                                        onMouseEnter={e => { e.currentTarget.style.color = C.primary; e.currentTarget.style.borderColor = C.primary; }}
                                                                        onMouseLeave={e => { e.currentTarget.style.color = C.textSub; e.currentTarget.style.borderColor = C.border; }}>
                                                                        {Ico.link}
                                                                    </a>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>

                                    {/* ── Pagination ── */}
                                    {!isProductsLoading && productsPagination.pages > 1 && (
                                        <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                                            <span style={{ fontSize: 12, color: C.textSub }}>
                                                {t('wpProductsPageInfo', { current: productsPagination.current_page, total: productsPagination.pages, count: productsPagination.total })}
                                            </span>
                                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                                                {/* Prev */}
                                                <button disabled={productsPagination.current_page <= 1}
                                                    onClick={() => {
                                                        const f = { ...productFilters, page: productsPagination.current_page - 1 };
                                                        setProductFilters(f); loadProducts(f, selectedId);
                                                    }}
                                                    style={{ border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 12px', fontSize: 13, cursor: productsPagination.current_page <= 1 ? 'default' : 'pointer', background: 'transparent', color: productsPagination.current_page <= 1 ? C.textSub : C.text, opacity: productsPagination.current_page <= 1 ? 0.4 : 1 }}>
                                                    ‹
                                                </button>
                                                {/* Page numbers */}
                                                {Array.from({ length: Math.min(productsPagination.pages, 7) }, (_, k) => {
                                                    const total = productsPagination.pages;
                                                    const cur = productsPagination.current_page;
                                                    let pg;
                                                    if (total <= 7) pg = k + 1;
                                                    else if (k === 0) pg = 1;
                                                    else if (k === 6) pg = total;
                                                    else if (cur <= 4) pg = k + 1;
                                                    else if (cur >= total - 3) pg = total - 6 + k;
                                                    else pg = cur - 2 + k;
                                                    const isActive = pg === cur;
                                                    return (
                                                        <button key={pg} onClick={() => {
                                                            const f = { ...productFilters, page: pg };
                                                            setProductFilters(f); loadProducts(f, selectedId);
                                                        }}
                                                            style={{ border: `1px solid ${isActive ? C.primary : C.border}`, borderRadius: 7, padding: '5px 10px', fontSize: 13, cursor: 'pointer', background: isActive ? C.primary : 'transparent', color: isActive ? '#fff' : C.text, fontWeight: isActive ? 700 : 400, minWidth: 34 }}>
                                                            {pg}
                                                        </button>
                                                    );
                                                })}
                                                {/* Next */}
                                                <button disabled={productsPagination.current_page >= productsPagination.pages}
                                                    onClick={() => {
                                                        const f = { ...productFilters, page: productsPagination.current_page + 1 };
                                                        setProductFilters(f); loadProducts(f, selectedId);
                                                    }}
                                                    style={{ border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 12px', fontSize: 13, cursor: productsPagination.current_page >= productsPagination.pages ? 'default' : 'pointer', background: 'transparent', color: productsPagination.current_page >= productsPagination.pages ? C.textSub : C.text, opacity: productsPagination.current_page >= productsPagination.pages ? 0.4 : 1 }}>
                                                    ›
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </Card>

                                {/* Orders */}
                                <Card>
                                    <CardHeader title={t('wpRecentOrdersTitle')} sub={t('wpOrdersLoadedCount', { count: orders.length })} />
                                    {orders.length === 0 && <EmptyState icon={Ico.bag} title={t('wpNoOrdersTitle')} sub={t('wpNoOrdersSub')} />}
                                    <div style={{ overflowX: 'auto' }}>
                                        {orders.length > 0 && (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', color: C.textSub }}>
                                                        {[t('wpColNumber'), t('client'), t('status'), t('wpColTotal'), t('date')].map(h => (
                                                            <th key={h} style={{ padding: '10px 18px', fontWeight: 700, fontSize: 11, textAlign: 'left', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {orders.map((o) => (
                                                        <tr key={o.id} style={{ borderTop: `1px solid ${C.border}` }}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                            <td style={{ padding: '12px 18px', fontFamily: 'monospace', color: C.textSub }}>#{o.id}</td>
                                                            <td style={{ padding: '12px 18px' }}>
                                                                <div style={{ fontWeight: 600, color: C.text }}>{o.customer}</div>
                                                                <div style={{ fontSize: 11, color: C.textSub }}>{o.customer_email}</div>
                                                            </td>
                                                            <td style={{ padding: '12px 18px' }}><StatusBadge status={o.status} /></td>
                                                            <td style={{ padding: '12px 18px', fontWeight: 800, color: C.text }}>{o.currency} {parseFloat(o.total).toFixed(2)}</td>
                                                            <td style={{ padding: '12px 18px', color: C.textSub, whiteSpace: 'nowrap' }}>{o.date ? new Date(o.date).toLocaleDateString('fr-FR') : '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </Card>
                            </>
                        )}
                    </div>
                )}
                {/* ══ TAB: LOGS ══════════════════════════════════════════ */}
                {tab === 'logs' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {!selected && <EmptyState icon={Ico.file} title={t('wpNoSiteSelectedTitle')} sub={t('wpSelectSiteSub')} />}
                        {selected && (
                            <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Ico.shield /> {t('wpAuditLogTitle')}</h3>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <select
                                            value={logsFilters.status}
                                            onChange={e => {
                                                const f = { ...logsFilters, status: e.target.value, page: 1 };
                                                setLogsFilters(f);
                                                loadLogs(f, selectedId);
                                            }}
                                            style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, outline: 'none', background: '#f8fafc', fontSize: 13, color: C.text }}
                                        >
                                            <option value="">{t('wpAllStatuses')}</option>
                                            <option value="EXECUTED">{t('wpStatusExecuted')}</option>
                                            <option value="REJECTED">{t('wpStatusRejected')}</option>
                                            <option value="PENDING">{t('pending')}</option>
                                        </select>
                                    </div>
                                </div>
                                {isLoading ? <div style={{ padding: 40, textAlign: 'center', color: C.textSub }}>{t('wpLoadingLogs')}</div> : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${C.border}` }}>
                                                    <th style={{ padding: '12px 16px', fontWeight: 600, color: C.textSub }}>{t('date')}</th>
                                                    <th style={{ padding: '12px 16px', fontWeight: 600, color: C.textSub }}>{t('wpColAction')}</th>
                                                    <th style={{ padding: '12px 16px', fontWeight: 600, color: C.textSub }}>{t('status')}</th>
                                                    <th style={{ padding: '12px 16px', fontWeight: 600, color: C.textSub }}>{t('wpColDetails')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {logs.length === 0 ? (
                                                    <tr><td colSpan="4" style={{ padding: 20, textAlign: 'center', color: C.textSub }}>{t('wpNoLogsFound')}</td></tr>
                                                ) : logs.map(l => (
                                                    <tr key={l.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                                                        <td style={{ padding: '12px 16px' }}>{new Date(l.created_at).toLocaleString()}</td>
                                                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{l.action_type}</td>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <span style={{ 
                                                                padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                                                background: l.status === 'EXECUTED' ? '#dcfce7' : l.status === 'REJECTED' ? '#fee2e2' : '#fef9c3',
                                                                color: l.status === 'EXECUTED' ? '#166534' : l.status === 'REJECTED' ? '#991b1b' : '#854d0e'
                                                            }}>
                                                                {l.status}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px 16px', color: C.textSub, fontSize: 12 }}>
                                                            <div style={{ maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.context}>
                                                                {l.context}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        
                                        {/* Pagination Controls */}
                                        {logsPagination.pages > 1 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                                            <div style={{ fontSize: 13, color: C.textSub }}>
                                                {t('wpTotalLogsCount', { count: logsPagination.total })}
                                            </div>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                {/* Prev */}
                                                <button disabled={logsPagination.current_page <= 1}
                                                    onClick={() => {
                                                        const f = { ...logsFilters, page: logsPagination.current_page - 1 };
                                                        setLogsFilters(f); loadLogs(f, selectedId);
                                                    }}
                                                    style={{ border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 12px', fontSize: 13, cursor: logsPagination.current_page <= 1 ? 'default' : 'pointer', background: 'transparent', color: logsPagination.current_page <= 1 ? C.textSub : C.text, opacity: logsPagination.current_page <= 1 ? 0.4 : 1 }}>
                                                    &larr;
                                                </button>
                                                {/* Page numbers */}
                                                {Array.from({ length: Math.min(logsPagination.pages, 7) }, (_, k) => {
                                                    const total = logsPagination.pages;
                                                    const cur = logsPagination.current_page;
                                                    let pg;
                                                    if (total <= 7) pg = k + 1;
                                                    else if (k === 0) pg = 1;
                                                    else if (k === 6) pg = total;
                                                    else if (cur <= 4) pg = k + 1;
                                                    else if (cur >= total - 3) pg = total - 6 + k;
                                                    else pg = cur - 2 + k;
                                                    const isActive = pg === cur;
                                                    return (
                                                        <button key={pg} onClick={() => {
                                                            const f = { ...logsFilters, page: pg };
                                                            setLogsFilters(f); loadLogs(f, selectedId);
                                                        }}
                                                            style={{ border: `1px solid ${isActive ? C.primary : C.border}`, borderRadius: 7, padding: '5px 10px', fontSize: 13, cursor: 'pointer', background: isActive ? C.primary : 'transparent', color: isActive ? '#fff' : C.text, fontWeight: isActive ? 700 : 400, minWidth: 34 }}>
                                                            {pg}
                                                        </button>
                                                    );
                                                })}
                                                {/* Next */}
                                                <button disabled={logsPagination.current_page >= logsPagination.pages}
                                                    onClick={() => {
                                                        const f = { ...logsFilters, page: logsPagination.current_page + 1 };
                                                        setLogsFilters(f); loadLogs(f, selectedId);
                                                    }}
                                                    style={{ border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 12px', fontSize: 13, cursor: logsPagination.current_page >= logsPagination.pages ? 'default' : 'pointer', background: 'transparent', color: logsPagination.current_page >= logsPagination.pages ? C.textSub : C.text, opacity: logsPagination.current_page >= logsPagination.pages ? 0.4 : 1 }}>
                                                    &rarr;
                                                </button>
                                            </div>
                                        </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            {/* ── Modal Description Produit ── */}
                {productModal && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(2px)' }} onClick={() => setProductModal(null)}>
                        <div style={{ background: C.panel, borderRadius: 16, width: 640, maxWidth: '90%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'fadeUp 0.2s ease', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
                            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>{productModal.name}</div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <StatusBadge status={productModal.status} />
                                        <span style={{ fontSize: 14, fontWeight: 700 }}>{productModal.price}</span>
                                        {productModal.sku && <span style={{ fontSize: 11, background: C.border+'60', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>{t('wpSkuLabel', { sku: productModal.sku })}</span>}
                                    </div>
                                </div>
                                <button onClick={() => setProductModal(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: C.textSub, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            </div>
                            <div style={{ padding: '24px', overflowY: 'auto' }}>
                                <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, fontFamily: 'system-ui, sans-serif' }} dangerouslySetInnerHTML={{ __html: productModal.description || productModal.short_description || `<div style="color: #94a3b8; font-style: italic;">${t('wpNoDescriptionAvailable')}</div>` }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <JarvisChat selectedId={selectedId} selected={selected} />
        </>
    );
}
