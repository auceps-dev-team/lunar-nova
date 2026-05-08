import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import useAppStore from '../store';

// ─── Design tokens (aligned with WaCopilote branding) ────────────────────────
const C = {
    primary:     '#0b9f84',
    primary2:    '#10b981',
    primaryDark: '#047857',
    accent:      '#6366f1',
    blue:        '#3b82f6',
    purple:      '#8b5cf6',
    amber:       '#f59e0b',
    red:         '#ef4444',
    text:        'var(--text-primary, #0f172a)',
    textSub:     'var(--text-secondary, #64748b)',
    panel:       'var(--panel-bg, #fff)',
    border:      'var(--border-color, #e2e8f0)',
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Ico = {
    wp:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h4M18 12h4M12 2v4M12 18v4"/><path d="m4.93 4.93 2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>,
    link:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
    check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    bag:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    file:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    chart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
    globe: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    plug:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
    eye:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
};

// ─── KPI Card (matched to Dashboard.jsx pattern) ─────────────────────────────
function KPICard({ icon, label, value, sub, color }) {
    return (
        <div style={{
            background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: '20px 22px', display: 'flex', flexDirection: 'column',
            gap: 10, position: 'relative', overflow: 'hidden',
        }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '16px 16px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '18', color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                </div>
            </div>
            <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: '-0.5px', lineHeight: 1.2 }}>{value ?? '—'}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textSub, marginTop: 4 }}>{label}</div>
                {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
            </div>
        </div>
    );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const map = {
        publish:    { label: 'Publié',     bg: '#d1fae5', color: '#065f46' },
        draft:      { label: 'Brouillon',  bg: '#fef9c3', color: '#78350f' },
        completed:  { label: 'Complétée', bg: '#d1fae5', color: '#065f46' },
        processing: { label: 'En cours',   bg: '#dbeafe', color: '#1e3a8a' },
        pending:    { label: 'En attente', bg: '#fef9c3', color: '#78350f' },
        cancelled:  { label: 'Annulée',   bg: '#fee2e2', color: '#7f1d1d' },
    };
    const s = map[status] || { label: status, bg: '#f1f5f9', color: '#334155' };
    return (
        <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999 }}>
            {s.label}
        </span>
    );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabBtn({ active, icon, label, onClick }) {
    return (
        <button onClick={onClick} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 10,
            border: active ? `1px solid ${C.primary}30` : '1px solid transparent',
            background: active ? C.primary + '18' : 'transparent',
            color: active ? C.primary : C.textSub,
            fontSize: 13, fontWeight: active ? 700 : 500,
            cursor: 'pointer', transition: 'all 0.18s',
        }}>
            {icon}{label}
        </button>
    );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
    return (
        <div style={{
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 16, overflow: 'hidden', ...style,
        }}>
            {children}
        </div>
    );
}

function CardHeader({ title, sub }) {
    return (
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
            {sub && <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{sub}</div>}
        </div>
    );
}

// ─── Field Input ─────────────────────────────────────────────────────────────
function Field({ label, children, hint }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>{label}</label>
            {children}
            {hint && <span style={{ fontSize: 11, color: '#94a3b8' }}>{hint}</span>}
        </div>
    );
}

function Input({ mono, ...props }) {
    return (
        <input {...props} style={{
            width: '100%', padding: '9px 12px',
            border: `1px solid ${C.border}`, borderRadius: 10,
            background: 'var(--input-bg, #f8fafc)',
            color: C.text, fontSize: 13,
            fontFamily: mono ? 'monospace' : 'inherit',
            outline: 'none', transition: 'border-color 0.18s',
            boxSizing: 'border-box',
        }}
            onFocus={e => e.target.style.borderColor = C.primary}
            onBlur={e => e.target.style.borderColor = C.border}
        />
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: C.primary + '18', color: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</div>
            {sub && <div style={{ fontSize: 12, color: C.textSub, textAlign: 'center', maxWidth: 240 }}>{sub}</div>}
        </div>
    );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function Skeleton({ h = 16, w = '100%', r = 8 }) {
    return <div style={{ height: h, width: w, borderRadius: r, background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spin() {
    return <span style={{ display: 'inline-block', width: 14, height: 14, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WordPressBridge() {
    const showAppNotification = useAppStore(s => s.showAppNotification);

    const [tab, setTab] = useState('connection');
    const [connections, setConnections] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [form, setForm] = useState({ name: '', site_url: '', token: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(null);
    const [isDeleting, setIsDeleting] = useState(null);
    const [stats, setStats] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [analyticsPeriod, setAnalyticsPeriod] = useState('this_month');
    const [productModal, setProductModal] = useState(null);
    const [posts, setPosts] = useState([]);
    const [products, setProducts] = useState([]);
    const [productsMeta, setProductsMeta] = useState({ categories: [], brands: [], types: [] });
    const [productsPagination, setProductsPagination] = useState({ total: 0, pages: 1, per_page: 25, current_page: 1 });
    const [productFilters, setProductFilters] = useState({ search: '', category: '', type: '', stock_status: '', brand: '', page: 1, per_page: 25 });
    const [isProductsLoading, setIsProductsLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // ── Jarvis WP Agent State ──
    const [isJarvisOpen, setIsJarvisOpen] = useState(false);
    const [jarvisInput, setJarvisInput] = useState('');
    const [isJarvisLoading, setIsJarvisLoading] = useState(false);
    const jarvisBottomRef = useRef(null);
    const [jarvisHistory, setJarvisHistory] = useState([
        { sender: 'agent', text: '👋 Bonjour ! Je suis Jarvis WP, votre agent WordPress.\n\nJe peux créer des produits WooCommerce et des articles de blog directement sur vos sites connectés.\n\nDites-moi simplement ce que vous souhaitez créer ! Par exemple :\n• "Crée un produit Tournevis Électrique à 29€"\n• "Écris un article de blog sur les outils de bricolage"' }
    ]);

    useEffect(() => {
        if (jarvisBottomRef.current) {
            jarvisBottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [jarvisHistory, isJarvisLoading]);

    const extractJSON = (str) => {
        const start = str.indexOf('{');
        const end = str.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) return null;
        try { return JSON.parse(str.substring(start, end + 1)); } catch { return null; }
    };

    const handleJarvisSubmit = async (e) => {
        e.preventDefault();
        if (!jarvisInput.trim()) return;
        if (!selectedId) {
            setJarvisHistory(prev => [...prev, { sender: 'agent', text: `⚠️ Veuillez d'abord sélectionner un site WordPress connecté dans les paramètres avant d'utiliser l'agent.` }]);
            return;
        }

        const userMessage = jarvisInput.trim();
        setJarvisHistory(prev => [...prev, { sender: 'user', text: userMessage }]);
        setJarvisInput('');
        setIsJarvisLoading(true);

        try {
            const siteContext = selected ? `[SITE_CONTEXT]: Site "${selected.name}" (URL: ${selected.site_url})` : '';
            const prompt = `${siteContext}\n\nDemande de l'utilisateur : ${userMessage}`;

            const res = await fetch('http://127.0.0.1:3000/api/ai/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: prompt, persona: 'wordpress_agent', promptFormat: 'json' })
            });
            const data = await res.json();

            let replyText = data.response || `Désolé, je n'ai pas pu traiter votre demande.`;
            const parsed = extractJSON(replyText);

            if (parsed) {
                if (parsed.text) replyText = parsed.text;

                if (parsed.actions && Array.isArray(parsed.actions)) {
                    for (const action of parsed.actions) {
                        try {
                            if (action.type === 'CREATE_PRODUCT' && action.payload) {
                                const r = await fetch(`http://localhost:3000/api/wp/${selectedId}/products`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(action.payload)
                                });
                                const d = await r.json();
                                if (d.status === 'success') {
                                    replyText += `\n\n✅ Produit créé avec succès ! [Voir le brouillon](${d.data?.url || '#'})`;
                                    showAppNotification('Produit créé sur WordPress !', 'success');
                                    // Refresh products list if on shop tab
                                    if (tab === 'shop') {
                                        const pr = await fetch(`http://localhost:3000/api/wp/${selectedId}/products?limit=15`);
                                        const pd = await pr.json();
                                        if (pd.status === 'success') setProducts(pd.data?.data || []);
                                    }
                                } else {
                                    replyText += `\n\n❌ Erreur lors de la création : ${d.error}`;
                                }
                            } else if (action.type === 'CREATE_POST' && action.payload) {
                                const r = await fetch(`http://localhost:3000/api/wp/${selectedId}/posts`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(action.payload)
                                });
                                const d = await r.json();
                                if (d.status === 'success') {
                                    replyText += `\n\n✅ Article créé avec succès ! [Voir le brouillon](${d.data?.url || '#'})`;
                                    showAppNotification('Article créé sur WordPress !', 'success');
                                    // Refresh posts if on posts tab
                                    if (tab === 'posts') {
                                        const rp = await fetch(`http://localhost:3000/api/wp/${selectedId}/posts?limit=20`);
                                        const dp = await rp.json();
                                        if (dp.status === 'success') setPosts(dp.data?.data || []);
                                    }
                                } else {
                                    replyText += `\n\n❌ Erreur lors de la création : ${d.error}`;
                                }
                            }
                        } catch (actionErr) {
                            replyText += `\n\n❌ Erreur technique : ${actionErr.message}`;
                        }
                    }
                }
            }

            setJarvisHistory(prev => [...prev, { sender: 'agent', text: replyText }]);
        } catch (err) {
            setJarvisHistory(prev => [...prev, { sender: 'agent', text: `❌ Erreur de connexion à l'agent. Vérifiez que le backend WaCopilote est bien démarré.` }]);
        } finally {
            setIsJarvisLoading(false);
        }
    };

    const selected = connections.find(c => c.id === selectedId);

    // Fetch connections list
    const loadConnections = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3000/api/wp/connections');
            const d = await res.json();
            if (d.status === 'success') {
                setConnections(d.data);
                if (!selectedId && d.data.length > 0) setSelectedId(d.data[0].id);
            }
        } catch (e) { /* silent */ }
    }, [selectedId]);

    useEffect(() => { loadConnections(); }, [loadConnections]);

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
            const r = await fetch(`http://localhost:3000/api/wp/${connId}/products?${params.toString()}`);
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
                        fetch(`http://localhost:3000/api/wp/${selectedId}/stats`),
                        fetch(`http://localhost:3000/api/wp/${selectedId}/analytics?date_start=${d_start} 00:00:00&date_end=${d_end} 23:59:59`)
                    ]);
                    const dStats = await rStats.json();
                    const dAna = await rAna.json();
                    if (dStats.status === 'success') setStats(dStats.data);
                    if (dAna.status === 'success') setAnalytics(dAna.data);
                } else if (tab === 'posts') {
                    const r = await fetch(`http://localhost:3000/api/wp/${selectedId}/posts?limit=20`);
                    const d = await r.json();
                    if (d.status === 'success') setPosts(d.data?.data || []);
                } else if (tab === 'shop') {
                    // Reset filters when switching site or tab, load products + meta + orders in parallel
                    const resetFilters = { search: '', category: '', type: '', stock_status: '', brand: '', page: 1, per_page: 25 };
                    setProductFilters(resetFilters);
                    const [metaR, orderR] = await Promise.all([
                        fetch(`http://localhost:3000/api/wp/${selectedId}/products/meta`),
                        fetch(`http://localhost:3000/api/wp/${selectedId}/orders?limit=15`),
                    ]);
                    const metaD = await metaR.json();
                    const od = await orderR.json();
                    if (metaD.status === 'success') setProductsMeta(metaD.data || { categories: [], brands: [], types: [] });
                    if (od.status === 'success') setOrders(od.data?.data || []);
                    await loadProducts(resetFilters, selectedId);
                }
            } catch (e) { /* silent */ }
            setIsLoading(false);
        };
        load();
    }, [selectedId, tab, analyticsPeriod, loadProducts]);

    const handleAdd = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await fetch('http://localhost:3000/api/wp/connections', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const d = await res.json();
            if (d.status === 'success') {
                showAppNotification('Site WordPress connecté !', 'success');
                setForm({ name: '', site_url: '', token: '' });
                await loadConnections();
                setSelectedId(d.data.id);
            } else throw new Error(d.error);
        } catch (e) { showAppNotification('Erreur : ' + e.message, 'error'); }
        setIsSaving(false);
    };

    const handleTest = async (id) => {
        setIsTesting(id);
        try {
            const res = await fetch(`http://localhost:3000/api/wp/connections/${id}/test`, { method: 'POST' });
            const d = await res.json();
            if (d.status === 'success') showAppNotification(`✅ ${d.site_name} (WP ${d.wp_version})`, 'success');
            else showAppNotification('❌ ' + d.error, 'error');
        } catch (e) { showAppNotification('Erreur : ' + e.message, 'error'); }
        setIsTesting(null);
    };

    const handleDelete = async (id) => {
        setIsDeleting(id);
        try {
            await fetch(`http://localhost:3000/api/wp/connections/${id}`, { method: 'DELETE' });
            showAppNotification('Site supprimé.', 'success');
            if (selectedId === id) setSelectedId(null);
            await loadConnections();
        } catch (e) { showAppNotification('Erreur : ' + e.message, 'error'); }
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
                            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.5px' }}>WordPress Bridge</h1>
                            <p style={{ fontSize: 13, color: C.textSub, margin: '3px 0 0' }}>Gérez vos sites WordPress directement depuis WaCopilote</p>
                        </div>
                    </div>

                    {/* Site Selector */}
                    {connections.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: C.textSub, fontWeight: 600 }}>Site actif :</span>
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
                    <TabBtn active={tab === 'connection'} icon={Ico.plug}  label="Connexion"      onClick={() => setTab('connection')} />
                    <TabBtn active={tab === 'overview'}   icon={Ico.chart} label="Vue d'ensemble" onClick={() => setTab('overview')} />
                    <TabBtn active={tab === 'posts'}      icon={Ico.file}  label="Articles"        onClick={() => setTab('posts')} />
                    <TabBtn active={tab === 'shop'}       icon={Ico.bag}   label="Boutique"        onClick={() => setTab('shop')} />
                </div>

                {/* ══ TAB: CONNEXION ══════════════════════════════════════════ */}
                {tab === 'connection' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                        {/* Add form */}
                        <Card>
                            <CardHeader
                                title="Ajouter un site WordPress"
                                sub="Installez le plugin WaCopilote Bridge, puis copiez les informations depuis Réglages > WaCopilote Bridge"
                            />
                            <form onSubmit={handleAdd} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <Field label="NOM DU SITE">
                                    <Input required type="text" placeholder="ex: Boutique Abidjan" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                                </Field>
                                <Field label="URL DU SITE">
                                    <Input required type="url" placeholder="https://ma-boutique.com" value={form.site_url} onChange={e => setForm({ ...form, site_url: e.target.value })} />
                                </Field>
                                <Field label="TOKEN DE SÉCURITÉ" hint="Disponible dans Réglages > WaCopilote Bridge sur votre WordPress">
                                    <Input required mono type="text" placeholder="Collez le token du plugin ici" value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} />
                                </Field>
                                <button type="submit" disabled={isSaving} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    padding: '10px 20px', borderRadius: 10, border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer',
                                    background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                                    color: '#fff', fontSize: 13, fontWeight: 700,
                                    boxShadow: `0 2px 12px ${C.primary}50`,
                                    opacity: isSaving ? 0.7 : 1, transition: 'all 0.18s',
                                }}>
                                    {isSaving ? <><Spin /> Connexion en cours...</> : '+ Connecter le site'}
                                </button>
                            </form>

                            {/* Plugin install hint */}
                            <div style={{ margin: '0 22px 22px', padding: '12px 16px', background: C.primary + '0d', border: `1px solid ${C.primary}25`, borderRadius: 10 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 4 }}>📦 Installer le plugin</div>
                                <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>
                                    WordPress Admin → <strong>Extensions → Ajouter → Envoyer</strong> → uploadez <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>wacopilote-bridge.zip</code>
                                </div>
                            </div>
                        </Card>

                        {/* Connected sites */}
                        <Card>
                            <CardHeader title={`Sites connectés (${connections.length})`} sub="Sélectionnez un site pour explorer ses données" />
                            <div style={{ padding: connections.length === 0 ? 0 : '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {connections.length === 0 ? (
                                    <EmptyState icon={Ico.wp} title="Aucun site connecté" sub="Ajoutez votre premier site WordPress à l'aide du formulaire." />
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
                                                    title="Tester la connexion"
                                                    style={{ padding: '5px 8px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: C.textSub, display: 'flex', alignItems: 'center' }}
                                                >
                                                    {isTesting === conn.id ? <Spin /> : Ico.link}
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleDelete(conn.id); }}
                                                    disabled={isDeleting === conn.id}
                                                    title="Supprimer"
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
                        {!selected && <EmptyState icon={Ico.wp} title="Aucun site sélectionné" sub="Ajoutez et sélectionnez un site dans l'onglet Connexion." />}
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
                                    <KPICard icon={Ico.file} label="Articles publiés"  value={stats.total_posts}    sub="Post status: publish" color={C.primary2} />
                                    <KPICard icon={Ico.globe} label="Pages"            value={stats.total_pages}    sub="Pages WordPress"   color={C.blue} />
                                    <KPICard icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>} label="Commentaires" value={stats.total_comments} sub="Approuvés" color={C.accent} />
                                    {stats.woocommerce && <KPICard icon={Ico.bag} label="Produits" value={stats.woocommerce.total_products} sub="WooCommerce" color={C.purple} />}
                                    {stats.woocommerce && <KPICard icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>} label="Commandes" value={stats.woocommerce.total_orders} sub="Toutes périodes" color={C.amber} />}
                                </div>

                                {/* Performances (WooCommerce Analytics) */}
                                {analytics && stats.woocommerce && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {/* ── NATIVE-LIKE WOO KPI ROW ── */}
                                        <Card>
                                            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Performances</div>
                                                </div>
                                                <select value={analyticsPeriod} onChange={e => setAnalyticsPeriod(e.target.value)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, outline: 'none', cursor: 'pointer', background: '#f8fafc', fontWeight: 600 }}>
                                                    <option value="this_month">Mois en cours</option>
                                                    <option value="last_month">Mois précédent</option>
                                                    <option value="this_year">Cette année</option>
                                                </select>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
                                                {/* Total des ventes */}
                                                <div style={{ padding: '24px 22px', borderRight: `1px solid ${C.border}` }}>
                                                    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8, fontWeight: 500 }}>Total des ventes</div>
                                                    <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{analytics.currency}{(analytics.total_sales||0).toLocaleString('fr-FR')}</div>
                                                </div>
                                                {/* Ventes nettes */}
                                                <div style={{ padding: '24px 22px', borderRight: `1px solid ${C.border}` }}>
                                                    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8, fontWeight: 500 }}>Ventes nettes</div>
                                                    <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{analytics.currency}{(analytics.net_sales||0).toLocaleString('fr-FR')}</div>
                                                </div>
                                                {/* Commandes */}
                                                <div style={{ padding: '24px 22px', borderRight: `1px solid ${C.border}` }}>
                                                    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8, fontWeight: 500 }}>Commandes</div>
                                                    <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{analytics.orders_count || 0}</div>
                                                </div>
                                                {/* Produits vendus */}
                                                <div style={{ padding: '24px 22px', borderRight: `1px solid ${C.border}` }}>
                                                    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8, fontWeight: 500 }}>Produits vendus</div>
                                                    <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{analytics.products_sold || 0}</div>
                                                </div>
                                                {/* Taxes (Replaces variations) */}
                                                <div style={{ padding: '24px 22px' }}>
                                                    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8, fontWeight: 500 }}>Taxes perçues</div>
                                                    <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{analytics.currency}{(analytics.taxes||0).toLocaleString('fr-FR')}</div>
                                                </div>
                                            </div>
                                        </Card>

                                        {/* ── TABLEAUX (Side by Side Charts) ── */}
                                        <div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12 }}>Tableaux</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20 }}>
                                                
                                                {/* Ventes Nettes Chart */}
                                                <Card>
                                                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 14 }}>
                                                        Ventes nettes
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
                                                                        formatter={(value) => [`${analytics.currency}${value.toLocaleString('fr-FR')}`, 'Ventes nettes']}
                                                                        labelFormatter={label => `Jour: ${label}`}
                                                                    />
                                                                    <Line type="monotone" dataKey="net_sales" stroke={C.primary} strokeWidth={3} dot={{ r: 3, fill: C.primary, strokeWidth: 0 }} activeDot={{ r: 6, fill: C.primary }} />
                                                                </LineChart>
                                                            </ResponsiveContainer>
                                                        ) : (
                                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 13 }}>
                                                                Aucune donnée pour la plage de dates sélectionnée
                                                            </div>
                                                        )}
                                                    </div>
                                                </Card>

                                                {/* Commandes Chart */}
                                                <Card>
                                                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 14 }}>
                                                        Commandes
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
                                                                        formatter={(value) => [value, 'Commandes']}
                                                                        labelFormatter={label => `Jour: ${label}`}
                                                                    />
                                                                    <Line type="monotone" dataKey="orders" stroke={C.blue} strokeWidth={3} dot={{ r: 3, fill: C.blue, strokeWidth: 0 }} activeDot={{ r: 6, fill: C.blue }} />
                                                                </LineChart>
                                                            </ResponsiveContainer>
                                                        ) : (
                                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, fontSize: 13 }}>
                                                                Aucune donnée pour la plage de dates sélectionnée
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
                        {!selected && <EmptyState icon={Ico.file} title="Aucun site sélectionné" sub="Sélectionnez un site dans l'onglet Connexion." />}
                        {selected && isLoading && <Card><div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3,4,5].map(k => <Skeleton key={k} h={60} />)}</div></Card>}
                        {selected && !isLoading && (
                            <Card>
                                <CardHeader title={`Articles — ${selected.name}`} sub={`${posts.length} articles chargés`} />
                                <div>
                                    {posts.length === 0 && <EmptyState icon={Ico.file} title="Aucun article" sub="Aucun article trouvé sur ce site." />}
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
                        {!selected && <EmptyState icon={Ico.bag} title="Aucun site sélectionné" sub="Sélectionnez un site dans l'onglet Connexion." />}
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
                                                    placeholder="Rechercher un produit..."
                                                    style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px 8px 32px', fontSize: 13, outline: 'none', background: '#f8fafc', color: C.text, boxSizing: 'border-box' }}
                                                />
                                            </div>

                                            {/* Category */}
                                            {productsMeta.categories.length > 0 && (
                                                <select id="wp-filter-cat" value={productFilters.category}
                                                    onChange={e => setProductFilters(f => ({ ...f, category: e.target.value, page: 1 }))}
                                                    style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#f8fafc', color: C.text, cursor: 'pointer', minWidth: 170 }}>
                                                    <option value="">Sélectionner une catégorie</option>
                                                    {productsMeta.categories.map(c => <option key={c.slug} value={c.slug}>{c.name} ({c.count})</option>)}
                                                </select>
                                            )}

                                            {/* Product type */}
                                            {productsMeta.types.length > 0 && (
                                                <select id="wp-filter-type" value={productFilters.type}
                                                    onChange={e => setProductFilters(f => ({ ...f, type: e.target.value, page: 1 }))}
                                                    style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#f8fafc', color: C.text, cursor: 'pointer', minWidth: 170 }}>
                                                    <option value="">Filtrer par type de produit</option>
                                                    {productsMeta.types.map(t => <option key={t.slug} value={t.slug}>{t.name} ({t.count})</option>)}
                                                </select>
                                            )}

                                            {/* Stock status */}
                                            <select id="wp-filter-stock" value={productFilters.stock_status}
                                                onChange={e => setProductFilters(f => ({ ...f, stock_status: e.target.value, page: 1 }))}
                                                style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#f8fafc', color: C.text, cursor: 'pointer', minWidth: 190 }}>
                                                <option value="">Filtrer par état du stock</option>
                                                <option value="instock">En stock</option>
                                                <option value="outofstock">Rupture de stock</option>
                                                <option value="onbackorder">En réapprovisionnement</option>
                                            </select>

                                            {/* Brand */}
                                            {productsMeta.brands.length > 0 && (
                                                <select id="wp-filter-brand" value={productFilters.brand}
                                                    onChange={e => setProductFilters(f => ({ ...f, brand: e.target.value, page: 1 }))}
                                                    style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#f8fafc', color: C.text, cursor: 'pointer', minWidth: 150 }}>
                                                    <option value="">Filtrer par marque</option>
                                                    {productsMeta.brands.map(b => <option key={b.slug} value={b.slug}>{b.name} ({b.count})</option>)}
                                                </select>
                                            )}

                                            {/* Apply + Reset buttons */}
                                            <button id="wp-filter-apply"
                                                onClick={() => loadProducts({ ...productFilters, page: 1 }, selectedId)}
                                                style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'opacity 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                                Filtrer
                                            </button>
                                            {(productFilters.search || productFilters.category || productFilters.type || productFilters.stock_status || productFilters.brand) && (
                                                <button id="wp-filter-reset"
                                                    onClick={() => {
                                                        const reset = { search: '', category: '', type: '', stock_status: '', brand: '', page: 1, per_page: productFilters.per_page };
                                                        setProductFilters(reset);
                                                        loadProducts(reset, selectedId);
                                                    }}
                                                    style={{ background: 'transparent', color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                    ✕ Réinitialiser
                                                </button>
                                            )}
                                        </div>

                                        {/* Row 2: total + per page selector */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                            <span style={{ fontSize: 12, color: C.textSub, fontWeight: 500 }}>
                                                {isProductsLoading ? 'Chargement…' : `${productsPagination.total} élément${productsPagination.total !== 1 ? 's' : ''} trouvé${productsPagination.total !== 1 ? 's' : ''}`}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: 12, color: C.textSub }}>Afficher :</span>
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
                                            <EmptyState icon={Ico.bag} title="Aucun produit" sub="Aucun produit ne correspond aux filtres sélectionnés." />
                                        ) : (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', color: C.textSub }}>
                                                        <th style={{ width: 44, padding: '10px 14px' }}></th>
                                                        {['Nom', 'UGS', 'Type', 'Stock', 'Prix', 'Catégories', 'Marques', 'Statut', ''].map(h => (
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
                                                                    {{ simple: 'Simple', variable: 'Variable', grouped: 'Groupé', external: 'Externe' }[p.type] || p.type}
                                                                </span>
                                                            </td>
                                                            {/* Stock */}
                                                            <td style={{ padding: '10px 14px' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                    <span style={{
                                                                        fontSize: 11, fontWeight: 700,
                                                                        color: p.stock_status === 'instock' ? '#16a34a' : p.stock_status === 'outofstock' ? '#dc2626' : '#d97706',
                                                                    }}>
                                                                        {{ instock: '● En stock', outofstock: '● Rupture', onbackorder: '● Réappro.' }[p.stock_status] || p.stock_status}
                                                                    </span>
                                                                    {p.stock_quantity != null && <span style={{ fontSize: 11, color: C.textSub }}>Qté: {p.stock_quantity}</span>}
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
                                                                    <button onClick={() => setProductModal(p)} title="Voir description"
                                                                        style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: C.textSub, transition: 'color 0.15s, border-color 0.15s' }}
                                                                        onMouseEnter={e => { e.currentTarget.style.color = C.primary; e.currentTarget.style.borderColor = C.primary; }}
                                                                        onMouseLeave={e => { e.currentTarget.style.color = C.textSub; e.currentTarget.style.borderColor = C.border; }}>
                                                                        {Ico.eye}
                                                                    </button>
                                                                    <a href={p.url} target="_blank" rel="noreferrer" title="Voir sur le site"
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
                                                Page {productsPagination.current_page} sur {productsPagination.pages}
                                                &nbsp;·&nbsp;{productsPagination.total} produits
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
                                    <CardHeader title="📦 Dernières Commandes" sub={`${orders.length} commandes chargées`} />
                                    {orders.length === 0 && <EmptyState icon={Ico.bag} title="Aucune commande" sub="Aucune commande WooCommerce trouvée." />}
                                    <div style={{ overflowX: 'auto' }}>
                                        {orders.length > 0 && (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', color: C.textSub }}>
                                                        {['N°', 'Client', 'Statut', 'Total', 'Date'].map(h => (
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
                                        {productModal.sku && <span style={{ fontSize: 11, background: C.border+'60', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>UGS: {productModal.sku}</span>}
                                    </div>
                                </div>
                                <button onClick={() => setProductModal(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: C.textSub, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            </div>
                            <div style={{ padding: '24px', overflowY: 'auto' }}>
                                <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, fontFamily: 'system-ui, sans-serif' }} dangerouslySetInnerHTML={{ __html: productModal.description || productModal.short_description || '<div style="color: #94a3b8; font-style: italic;">Aucune description disponible pour ce produit.</div>' }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* ── Jarvis WP Floating Button ── */}
            <button
                onClick={() => setIsJarvisOpen(true)}
                title="Ouvrir Jarvis WP - Agent IA"
                style={{
                    position: 'fixed', bottom: 24, right: 24,
                    width: 56, height: 56,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${C.primary}, ${C.accent})`,
                    border: 'none', cursor: 'pointer', color: '#fff',
                    boxShadow: `0 6px 24px ${C.primary}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, zIndex: 40,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = `0 8px 30px ${C.primary}80`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 6px 24px ${C.primary}55`; }}
            >
                🤖
            </button>

            {/* ── Jarvis WP Chat Panel ── */}
            <div style={{
                position: 'fixed', top: 0, right: 0, height: '100vh', width: 400,
                background: 'var(--panel-bg, #fff)',
                borderLeft: `1px solid ${C.border}`,
                boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
                zIndex: 50, display: 'flex', flexDirection: 'column',
                transform: isJarvisOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: `1px solid ${C.border}`,
                    background: `linear-gradient(135deg, ${C.primary}15, ${C.accent}10)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            background: `linear-gradient(135deg, ${C.primary}, ${C.accent})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18, color: '#fff',
                        }}>🤖</div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Jarvis WP</div>
                            <div style={{ fontSize: 11, color: C.primary, fontWeight: 600 }}>Agent WordPress IA</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {selected && (
                            <div style={{ fontSize: 11, color: C.textSub, background: C.border + '40', padding: '3px 8px', borderRadius: 6 }}>
                                🌐 {selected.name}
                            </div>
                        )}
                        <button onClick={() => setIsJarvisOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSub, display: 'flex', padding: 4 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {jarvisHistory.map((msg, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                            <div style={{
                                maxWidth: '88%', padding: '10px 14px', borderRadius: 16,
                                fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                                ...(msg.sender === 'user' ? {
                                    background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                                    color: '#fff', borderBottomRightRadius: 4,
                                } : {
                                    background: 'var(--bg-color, #f8fafc)',
                                    border: `1px solid ${C.border}`,
                                    color: C.text, borderBottomLeftRadius: 4,
                                })
                            }}>{msg.text}</div>
                        </div>
                    ))}
                    {isJarvisLoading && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <div style={{ background: 'var(--bg-color, #f8fafc)', border: `1px solid ${C.border}`, padding: '12px 16px', borderRadius: 16, borderBottomLeftRadius: 4, display: 'flex', gap: 5, alignItems: 'center' }}>
                                {[0, 150, 300].map(delay => (
                                    <div key={delay} style={{ width: 7, height: 7, borderRadius: '50%', background: C.primary, animation: 'bounce 1.2s infinite', animationDelay: `${delay}ms` }} />
                                ))}
                            </div>
                        </div>
                    )}
                    <div ref={jarvisBottomRef} />
                </div>

                {/* Quick Actions */}
                <div style={{ padding: '8px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 6, flexWrap: 'wrap', background: 'var(--bg-color, #f8fafc)' }}>
                    {[
                        '🛒 Créer un produit',
                        '📝 Créer un article',
                        '📦 Publier directement',
                    ].map(s => (
                        <button key={s} onClick={() => setJarvisInput(s)} style={{
                            fontSize: 11, padding: '4px 10px', borderRadius: 20,
                            border: `1px solid ${C.border}`, background: C.panel,
                            color: C.textSub, cursor: 'pointer', transition: 'all 0.15s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
                        >{s}</button>
                    ))}
                </div>

                {/* Input */}
                <form onSubmit={handleJarvisSubmit} style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.panel, flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            value={jarvisInput}
                            onChange={e => setJarvisInput(e.target.value)}
                            placeholder="Ex: Crée un produit Tournevis à 29.99€…"
                            disabled={isJarvisLoading}
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                padding: '11px 48px 11px 16px',
                                border: `1.5px solid ${C.border}`, borderRadius: 12,
                                background: 'var(--input-bg, #f8fafc)', color: C.text,
                                fontSize: 13, outline: 'none',
                                opacity: isJarvisLoading ? 0.6 : 1,
                            }}
                            onFocus={e => e.target.style.borderColor = C.primary}
                            onBlur={e => e.target.style.borderColor = C.border}
                        />
                        <button type="submit" disabled={!jarvisInput.trim() || isJarvisLoading} style={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                            width: 32, height: 32, borderRadius: 9,
                            background: jarvisInput.trim() && !isJarvisLoading ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` : '#e2e8f0',
                            border: 'none', cursor: jarvisInput.trim() && !isJarvisLoading ? 'pointer' : 'not-allowed',
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s',
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
