import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useAppStore from '../store';
import { API_BASE_URL } from '../config';
import { TabBtn } from '../components/wordpress/WPUI';
import { C, Ico } from '../components/wordpress/WPTheme';
import JarvisChat from '../components/wordpress/JarvisChat';
import WpTabConnection from '../components/wordpress/WpTabConnection';
import WpTabOverview from '../components/wordpress/WpTabOverview';
import WpTabPosts from '../components/wordpress/WpTabPosts';
import WpTabShop from '../components/wordpress/WpTabShop';
import WpTabLogs from '../components/wordpress/WpTabLogs';
import WpProductModal from '../components/wordpress/WpProductModal';

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
    const [, setIsLogsLoading] = useState(false);
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
        } catch { /* silent */ }
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
        } catch { /* silent */ }
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
        } catch { /* silent */ }
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
            } catch { /* silent */ }
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
                {/* ══ Onglets extraits en composants dédiés (refactor de découpage) ══ */}
                {tab === 'connection' && <WpTabConnection
                    connections={connections}
                    form={form}
                    handleAdd={handleAdd}
                    handleDelete={handleDelete}
                    handleTest={handleTest}
                    isDeleting={isDeleting}
                    isSaving={isSaving}
                    isTesting={isTesting}
                    selectedId={selectedId}
                    setForm={setForm}
                    setSelectedId={setSelectedId} />}

                {tab === 'overview' && <WpTabOverview
                    analytics={analytics}
                    analyticsPeriod={analyticsPeriod}
                    isLoading={isLoading}
                    selected={selected}
                    setAnalyticsPeriod={setAnalyticsPeriod}
                    stats={stats} />}

                {tab === 'posts' && <WpTabPosts
                    isLoading={isLoading}
                    posts={posts}
                    selected={selected} />}

                {tab === 'shop' && <WpTabShop
                    isLoading={isLoading}
                    isProductsLoading={isProductsLoading}
                    loadProducts={loadProducts}
                    orders={orders}
                    productFilters={productFilters}
                    products={products}
                    productsMeta={productsMeta}
                    productsPagination={productsPagination}
                    selected={selected}
                    selectedId={selectedId}
                    setProductFilters={setProductFilters}
                    setProductModal={setProductModal} />}

                {tab === 'logs' && <WpTabLogs
                    isLoading={isLoading}
                    loadLogs={loadLogs}
                    logs={logs}
                    logsFilters={logsFilters}
                    logsPagination={logsPagination}
                    selected={selected}
                    selectedId={selectedId}
                    setLogsFilters={setLogsFilters} />}

                {<WpProductModal
                    productModal={productModal}
                    setProductModal={setProductModal} />}
            </div>
            <JarvisChat selectedId={selectedId} selected={selected} />
        </>
    );
}
