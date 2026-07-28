import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useTranslation } from 'react-i18next';
import CustomSelect from '../components/CustomSelect';
import { API_BASE_URL } from '../config';



/* ═══════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════ */
const CURRENCIES = ['XOF', 'EUR', 'USD', 'GBP', 'CHF'];

const STATUS_MAP = {
    paid: { labelKey: 'paidState', dot: '#10b981', bg: '#ecfdf5', text: '#047857' },
    pending: { labelKey: 'pendingState', dot: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
    overdue: { labelKey: 'overdueState', dot: '#ef4444', bg: '#fef2f2', text: '#991b1b' },
    draft: { labelKey: 'draftState', dot: '#94a3b8', bg: '#f8fafc', text: '#475569' },
};

/* ═══════════════════════════════════════════════════════
   IMPORTS FROM HELPERS & COMPONENTS
   ═══════════════════════════════════════════════════════ */
import { calc, fmt, monthlyRevenue, freshInvoice } from '../components/invoice/helpers';
import LogoPicker from '../components/invoice/LogoPicker';
import SortableLine from '../components/invoice/SortableLine';
import { buildInvoiceHTML } from '../components/invoice/buildInvoiceHTML';
import KPI from '../components/invoice/KPI';
import TplThumb from '../components/invoice/TplThumb';
import { TPL_PREVIEWS } from '../components/invoice/templates';

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function InvoiceBuilder({ activeId }) {
    const { t } = useTranslation();
    const invoices = useAppStore(s => s.invoices) || [];
    const addInvoice = useAppStore(s => s.addInvoice);
    const updateInvoice = useAppStore(s => s.updateInvoice);
    const deleteInvoice = useAppStore(s => s.deleteInvoice);
    const userProfile = useAppStore(s => s.userProfile) || {};
    const invoiceDraft = useAppStore(s => s.invoiceDraft);
    const setInvoiceDraft = useAppStore(s => s.setInvoiceDraft);

    const navigate = useNavigate();
    const [view, setView] = useState('dashboard');
    const [draft, setDraft] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [saved, setSaved] = useState(false);
    const [showSaveToast, setShowSaveToast] = useState(false);

    // Consume cross-app invoiceDraft coming from Orders.jsx
    useEffect(() => {
        if (invoiceDraft) {
            setDraft({
                ...freshInvoice(userProfile),
                clientName: invoiceDraft.clientName || '',
                notes: invoiceDraft.notes || '',
                // Add the WhatsApp message text as a line item optionally (defaulting to 0)
                items: [
                    { id: `li-${Date.now()}`, description: `WhatsApp Request: ${invoiceDraft.rawMessage?.substring(0, 100)}...`, qty: 1, price: 0 }
                ]
            });
            setView('editor');
            setSaved(false);
            setInvoiceDraft(null); // Clear draft once consumed
        }
    }, [invoiceDraft, userProfile, setInvoiceDraft]);

    // Phase 21: Auto-fill from Intelligent Order Listener (IOL)
    const invoiceDraftGlobal = useAppStore(s => s.invoiceDraft);
    const clearInvoiceDraft = useAppStore(s => s.clearInvoiceDraft);

    useEffect(() => {
        if (invoiceDraftGlobal) {
            const newInv = freshInvoice();
            newInv.clientName = invoiceDraftGlobal.clientName || '';
            newInv.notes = invoiceDraftGlobal.notes || '';
            
            setDraft(newInv);
            setView('editor');
            setSaved(false);
            
            // Clear the global state so it processes once
            clearInvoiceDraft();
        }
    }, [invoiceDraftGlobal, clearInvoiceDraft]);

    // Contact search state
    const [showContactSearch, setShowContactSearch] = useState(false);
    const [allContacts, setAllContacts] = useState([]);
    const [contactSearchQuery, setContactSearchQuery] = useState('');
    const [contactFilterSegment, setContactFilterSegment] = useState('all');
    const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

    // Fetch contacts for search
    useEffect(() => {
        fetch(API_BASE_URL + '/api/wa/contacts')
            .then(r => r.json())
            .then(d => { if (d.status === 'success') setAllContacts(d.data || []); })
            .catch(() => { });
    }, []);

    const contactSegments = useMemo(() => {
        return [...new Set(allContacts.map(c => c.segment_name).filter(Boolean))];
    }, [allContacts]);

    const filteredContacts = useMemo(() => {
        let list = allContacts;
        if (contactFilterSegment !== 'all') list = list.filter(c => c.segment_name === contactFilterSegment);
        if (contactSearchQuery) {
            const q = contactSearchQuery.toLowerCase();
            list = list.filter(c => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q));
        }
        return list.slice(0, 20);
    }, [allContacts, contactFilterSegment, contactSearchQuery]);

    const handleSelectContact = (contact) => {
        setDraft(d => ({
            ...d,
            clientName: contact.name || '',
            clientAddress: [contact.address, contact.email, contact.phone].filter(Boolean).join('\n'),
            clientEmail: contact.email || '',
            clientPhone: contact.phone || '',
        }));
        setShowContactSearch(false);
        setContactSearchQuery('');
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // KPI
    const revByCurrency = useMemo(() => {
        const acc = {};
        invoices.forEach(inv => {
            const { total } = calc(inv.items, inv.taxRate);
            const cur = inv.currency || 'EUR';
            acc[cur] = (acc[cur] || 0) + total;
        });
        return acc;
    }, [invoices]);

    const primaryCurrency = Object.keys(revByCurrency)[0] || 'EUR';
    const totalRevStr = Object.keys(revByCurrency).length === 0
        ? fmt(0)
        : Object.entries(revByCurrency).map(([cur, amt]) => fmt(amt, cur)).join(' + ');

    const paidN = invoices.filter(i => i.status === 'paid').length;
    const pendN = invoices.filter(i => i.status === 'pending').length;
    const chartData = useMemo(() => monthlyRevenue(invoices), [invoices]);
    const filtered = filterStatus === 'all' ? invoices : invoices.filter(i => i.status === filterStatus);

    const handleNew = () => { setDraft(freshInvoice(userProfile)); setSaved(false); setView('editor'); };
    const handleEdit = (inv) => { setDraft({ ...inv }); setSaved(true); setView('editor'); };

    const handleSave = () => {
        if (!draft) return;
        invoices.find(i => i.id === draft.id) ? updateInvoice(draft.id, draft) : addInvoice(draft);
        setSaved(true);
        setShowSaveToast(true);
        setTimeout(() => setShowSaveToast(false), 3000);
    };

    const handleExportPDF = async () => {
        if (!draft) return;
        const html = buildInvoiceHTML(draft, t);
        const fileName = `${(draft.invoiceNumber || 'facture').replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;

        // Use Electron native PDF export if available
        if (window.electronAPI?.printToPDF) {
            try {
                const result = await window.electronAPI.printToPDF(html, fileName);
                if (result?.success) {
                    // Show a brief success indicator
                    setSaved(true);
                } else if (result?.reason !== 'cancelled') {
                    alert(`${t('pdfExportError')}: ${result?.reason || 'inconnue'}`);
                }
            } catch (err) {
                console.error('PDF export error:', err);
                alert(t('pdfExportError'));
            }
        } else {
            // Fallback for browser: open in new tab + print
            const win = window.open('', '_blank', 'width=800,height=1100');
            if (!win) return alert(t('allowPopupsPdf'));
            win.document.write(html);
            win.document.close();
            setTimeout(() => { win.focus(); win.print(); }, 400);
        }
    };

    // Send invoice via WhatsApp
    const handleSendWhatsApp = async () => {
        if (!draft || !draft.clientPhone) {
            alert(t('selectContactWithPhone'));
            return;
        }
        setSendingWhatsApp(true);
        try {
            // First export the PDF
            const html = buildInvoiceHTML(draft, t);
            const fileName = `${(draft.invoiceNumber || 'facture').replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
            if (window.electronAPI?.printToPDF) {
                const result = await window.electronAPI.printToPDF(html, fileName);
                if (!result?.success && result?.reason !== 'cancelled') {
                    throw new Error(result?.reason || 'PDF export failed');
                }
            }

            // Then open the WhatsApp chat
            if (!activeId) {
                alert(t('noActiveWaInstance'));
                return;
            }

            const rawPhone = (draft.clientPhone || '').replace(/[^0-9]/g, '');
            const res = await fetch(API_BASE_URL + '/api/wa/open-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instance_id: activeId, phone: rawPhone })
            });
            const data = await res.json();
            if (data.status === 'success') {
                await new Promise(r => setTimeout(r, 1200));
                navigate('/whatsapp-hub');
            } else {
                throw new Error(data.error || 'Failed to open chat');
            }
        } catch (err) {
            console.error('WhatsApp send error:', err);
            alert(`${t('whatsappSendError')}: ${err.message}`);
        } finally {
            setSendingWhatsApp(false);
        }
    };

    const updateItem = useCallback((id, field, val) => {
        setDraft(d => ({ ...d, items: d.items.map(it => it.id === id ? { ...it, [field]: val } : it) }));
    }, []);
    const removeItem = useCallback(id => { setDraft(d => ({ ...d, items: d.items.filter(it => it.id !== id) })); }, []);
    const addItem = () => { setDraft(d => ({ ...d, items: [...d.items, { id: `li-${Date.now()}`, description: '', qty: 1, price: 0 }] })); };

    const onDragEnd = (ev) => {
        const { active, over } = ev;
        if (!over || active.id === over.id) return;
        setDraft(d => {
            const o = d.items.findIndex(i => i.id === active.id);
            const n = d.items.findIndex(i => i.id === over.id);
            return { ...d, items: arrayMove(d.items, o, n) };
        });
    };

    // ── DASHBOARD ─────────────────────────────────────────
    if (view === 'dashboard') {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{t('invoiceDashTitle')}</h1>
                        <p className="text-sm text-gray-400 mt-0.5">{t('invoiceDashDesc')}</p>
                    </div>
                    <button onClick={handleNew}
                        className="h-10 px-5 rounded-xl text-white text-sm font-bold flex items-center gap-2 active:scale-[.97] transition-transform shadow-lg shadow-emerald-600/20"
                        style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        {t('newInvoiceBtn')}
                    </button>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPI label={t('totalInvoicesLabel')} value={invoices.length} icon="📄" accent="#059669" />
                    <KPI label={t('revenueLabel')} value={totalRevStr} icon="💰" accent="#0891b2" />
                    <KPI label={t('paidLabel')} value={paidN} sub={`${t('outOf')} ${invoices.length}`} icon="✅" accent="#16a34a" />
                    <KPI label={t('pendingLabel')} value={pendN} icon="⏳" accent="#d97706" />
                </div>

                {/* Chart */}
                <div className="bg-white dark:bg-[#1a1f25] rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-bold uppercase tracking-[.15em] text-gray-400 mb-4">{t('monthlyRevLabel')}</p>
                    <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0}>
                        <BarChart data={chartData} margin={{ left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={v => fmt(v, primaryCurrency)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,.08)', fontSize: 12 }} />
                            <Bar dataKey="rev" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                            <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#059669" /><stop offset="100%" stopColor="#34d399" /></linearGradient></defs>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Invoice list */}
                <div className="bg-white dark:bg-[#1a1f25] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-800">
                        <p className="text-[10px] font-bold uppercase tracking-[.15em] text-gray-400">{t('invoicesListTitle')}</p>
                        <div className="flex gap-1.5">
                            {['all', 'paid', 'pending', 'overdue', 'draft'].map(s => (
                                <button key={s} onClick={() => setFilterStatus(s)}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${filterStatus === s ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                                    {s === 'all' ? t('allInvoices') : t(s + 'State')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="text-center py-20 text-gray-300">
                            <div className="text-4xl mb-3">📋</div>
                            <p className="text-sm">{t('noInvoiceCreated')}</p>
                            <button onClick={handleNew} className="mt-3 text-sm text-emerald-600 font-semibold hover:underline">{t('createArrow')}</button>
                        </div>
                    ) : filtered.map(inv => {
                        const { total } = calc(inv.items, inv.taxRate);
                        const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
                        return (
                            <div key={inv.id} onClick={() => handleEdit(inv)}
                                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-800/50 last:border-0 group">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold" style={{ background: '#05966915', color: '#059669' }}>
                                        {inv.clientName?.slice(0, 2).toUpperCase() || '??'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{inv.clientName || '—'}</p>
                                        <p className="text-[11px] text-gray-400">{inv.invoiceNumber} · {inv.issueDate}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: st.bg, color: st.text }}>{t(st.labelKey)}</span>
                                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100 w-28 text-right tabular-nums">{fmt(total, inv.currency)}</span>
                                    <button onClick={e => { e.stopPropagation(); window.confirm(t('confirmDelete')) && deleteInvoice(inv.id); }}
                                        className="p-1 rounded-lg opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all">
                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /></svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── EDITOR ──────────────────────────────────────────────
    if (!draft) return null;
    const { sub, tax, total } = calc(draft.items, draft.taxRate);

    return (
        <div style={{ margin: '-24px' }} className="min-h-full flex flex-col relative">
            {/* Toast Notification */}
            {showSaveToast && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 font-medium text-sm">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    {t('invoiceSavedSuccess')}
                </div>
            )}

            {/* Editor toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView('dashboard')} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 5 5 12 12 19" /></svg>
                    </button>
                    <div>
                        <p className="text-sm font-bold text-gray-800 dark:text-white">{draft.invoiceNumber}</p>
                        <p className="text-[10px] text-gray-400">{saved ? t('savedStatus') : t('unsavedStatus')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Statut */}
                    <CustomSelect
                        value={draft.status}
                        onChange={(v) => setDraft(d => ({ ...d, status: v }))}
                        panelWidth="w-40"
                        options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: t(v.labelKey), color: { bg: v.bg, text: v.text } }))}
                    />
                    {/* Devise */}
                    <CustomSelect
                        value={draft.currency}
                        onChange={(v) => setDraft(d => ({ ...d, currency: v }))}
                        panelWidth="w-28"
                        options={CURRENCIES.map(c => ({ value: c, label: c }))}
                    />
                    {/* Contact search button */}
                    <button onClick={() => setShowContactSearch(true)}
                        className="h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-1.5"
                        title={t('searchContact')}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                        {t('contact')}
                    </button>
                    {/* WhatsApp send button */}
                    <button onClick={handleSendWhatsApp} disabled={sendingWhatsApp || !draft.clientPhone}
                        className="h-8 px-3 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-all disabled:opacity-40 active:scale-[.97]"
                        style={{ background: '#25D366' }}
                        title={t('sendViaWhatsapp')}>
                        {sendingWhatsApp ? (
                            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.624-1.467A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-2.168 0-4.19-.585-5.931-1.605l-.425-.253-2.742.87.883-2.659-.277-.44A9.778 9.778 0 012.182 12c0-5.414 4.404-9.818 9.818-9.818S21.818 6.586 21.818 12 17.414 21.818 12 21.818z" /></svg>
                        )}
                        WhatsApp
                    </button>
                    <button onClick={handleExportPDF}
                        className="h-8 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-1.5">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                        {t('exportPdf')}
                    </button>
                    <button onClick={handleSave}
                        className="h-8 px-5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 active:scale-[.97] transition-transform"
                        style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /></svg>
                        {t('save')}
                    </button>
                </div>
            </div>

            {/* Contact Search Modal */}
            {showContactSearch && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm" onClick={() => setShowContactSearch(false)}>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-800 animate-in" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
                            <p className="text-sm font-bold text-gray-800 dark:text-white mb-3">{t('searchContact')}</p>
                            <div className="flex gap-2">
                                <input
                                    autoFocus
                                    className="flex-1 h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:ring-2 ring-emerald-400 placeholder:text-gray-400 transition"
                                    placeholder={t('nameEmailPhone')}
                                    value={contactSearchQuery}
                                    onChange={e => setContactSearchQuery(e.target.value)}
                                />
                                <CustomSelect
                                    value={contactFilterSegment}
                                    onChange={(v) => setContactFilterSegment(v)}
                                    searchable={contactSegments.length > 5}
                                    panelWidth="w-44"
                                    options={[
                                        { value: 'all', label: t('allSegments') },
                                        ...contactSegments.map(s => ({ value: s, label: s })),
                                    ]}
                                />
                            </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                            {filteredContacts.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm">{t('noContactFound')}</div>
                            ) : filteredContacts.map(c => (
                                <button key={c.id} onClick={() => handleSelectContact(c)}
                                    className="w-full text-left px-5 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ background: '#05966915', color: '#059669' }}>
                                            {(c.name || '?').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{c.name}</p>
                                            <p className="text-[11px] text-gray-400">{c.phone} {c.email ? `· ${c.email}` : ''}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {c.segment_name && <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">{c.segment_name}</span>}
                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-300 group-hover:text-emerald-500 transition-colors"><polyline points="9 18 15 12 9 6" /></svg>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Main body */}
            <div className="flex flex-1 min-h-0">
                {/* Canvas */}
                <div className="flex-1 overflow-y-auto p-8 bg-[#f5f6f8] dark:bg-[#0f1115]">
                    {draft.template === 'stripe' ? (
                        <div className="max-w-3xl mx-auto rounded-none shadow-2xl p-14 bg-[#f7f7f9] text-[#333] font-['Inter',sans-serif]">
                            {/* Header */}
                            <div className="flex justify-between items-center mb-5">
                                <h1 className="text-5xl font-extrabold text-[#3b1485] tracking-widest uppercase m-0">{t('invoice')}</h1>
                                <LogoPicker value={draft.companyLogo} onChange={v => setDraft(d => ({ ...d, companyLogo: v }))} label={t('logoLabel')} size={80} />
                            </div>

                            <hr className="border-t border-[#d1d1e0] my-8" />

                            {/* Billing Info */}
                            <div className="flex justify-between mb-10">
                                <div className="flex-1 max-w-xs">
                                    <h2 className="text-lg font-bold text-[#333] mt-0 mb-4">{t('billedToColon')}</h2>
                                    <input className="w-full text-base font-bold text-[#333] bg-transparent outline-none pb-1 placeholder:text-gray-400 focus:border-[#3b1485] transition-colors"
                                        value={draft.clientName} onChange={e => setDraft(d => ({ ...d, clientName: e.target.value }))} placeholder={t('clientCompany')} />
                                    <textarea className="w-full bg-transparent text-sm text-[#5a5a75] outline-none resize-none mt-2 leading-relaxed" rows={2}
                                        value={draft.clientAddress} onChange={e => setDraft(d => ({ ...d, clientAddress: e.target.value }))} placeholder={t('clientAddress')} />
                                </div>
                                <div className="text-right mt-10 text-sm text-[#5a5a75] leading-relaxed">
                                    <div className="flex gap-2 justify-end mb-1"><span className="font-semibold">{t('noColon')}</span><input className="w-32 text-right bg-transparent outline-none text-[#333] font-bold" value={draft.invoiceNumber} onChange={e => setDraft(d => ({ ...d, invoiceNumber: e.target.value }))} /></div>
                                    <div className="flex gap-2 justify-end mb-1"><span className="font-semibold">{t('issuedColon')}</span><input type="date" className="bg-transparent outline-none" value={draft.issueDate} onChange={e => setDraft(d => ({ ...d, issueDate: e.target.value }))} /></div>
                                    <div className="flex gap-2 justify-end"><span className="font-semibold">{t('dueDateColon')}</span><input type="date" className="bg-transparent outline-none" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} /></div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="mb-10">
                                <div className="bg-[#3b1485] text-white px-5 py-3 grid grid-cols-[1fr_4fr_1fr_2fr_2fr_1fr] md:grid-cols-[24px_4fr_1fr_2fr_2fr_24px] gap-2 items-center text-[13px] font-bold tracking-wide">
                                    <div></div>
                                    <div>{t('descriptionCaps')}</div>
                                    <div className="text-center">{t('qtyCaps')}</div>
                                    <div className="text-center">{t('priceCaps')}</div>
                                    <div className="text-right">{t('totalCaps')}</div>
                                    <div></div>
                                </div>
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                                    <div className="bg-white/50">
                                        <table className="w-full"><tbody>
                                            <SortableContext items={draft.items} strategy={verticalListSortingStrategy}>
                                                {draft.items.map(item => (
                                                    <SortableLine key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} currency={draft.currency} t={t} />
                                                ))}
                                            </SortableContext>
                                        </tbody></table>
                                    </div>
                                </DndContext>
                                <button onClick={addItem}
                                    className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#3b1485] hover:text-[#2a0e63] transition-colors no-print">
                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                                    {t('addRow')}
                                </button>
                            </div>

                            {/* Bottom Section */}
                            <div className="flex justify-between items-start mt-8">
                                <div className="w-[45%]">
                                    <h3 className="text-[1.1em] font-bold text-[#3b1485] mb-3 mt-0">{t('notesColon')}</h3>
                                    <textarea className="w-full text-sm bg-transparent outline-none resize-none text-[#5a5a75] leading-relaxed border-b border-[#d1d1e0] focus:border-[#3b1485] transition-colors" rows={3}
                                        value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} placeholder={t('paymentNotesAndInstructions')} />

                                    <hr className="border-t border-[#d1d1e0] my-6 w-64" />

                                    <h3 className="text-[1.1em] font-bold text-[#3b1485] mb-3 mt-0">{t('contactDetailsColon')}</h3>
                                    <input className="w-full text-sm font-bold text-[#5a5a75] bg-transparent outline-none border-b border-[#d1d1e0] pb-1 mb-1 focus:border-[#3b1485]"
                                        value={draft.companyName} onChange={e => setDraft(d => ({ ...d, companyName: e.target.value }))} placeholder={t('yourCompany')} />
                                    <input className="w-full text-sm text-[#5a5a75] bg-transparent outline-none border-b border-[#d1d1e0] pb-1 mb-2 focus:border-[#3b1485]"
                                        value={draft.companyTagline} onChange={e => setDraft(d => ({ ...d, companyTagline: e.target.value }))} placeholder={t('subtitleSlogan')} />
                                    <textarea className="w-full text-sm text-[#5a5a75] bg-transparent outline-none resize-none leading-relaxed border-b border-[#d1d1e0] pb-1 focus:border-[#3b1485]" rows={3}
                                        value={draft.senderInfo} onChange={e => setDraft(d => ({ ...d, senderInfo: e.target.value }))} placeholder={t('addressAndContact')} />
                                </div>
                                <div className="w-[45%]">
                                    <div className="flex justify-between py-2 text-[0.95em] text-[#333] font-medium"><span>{t('subtotalColon')}</span><span>{fmt(sub, draft.currency)}</span></div>
                                    <hr className="border-t border-[#9ba4b5] mx-5 my-1" />
                                    <div className="flex justify-between items-center py-2 text-[0.95em] text-[#333] font-medium">
                                        <span className="flex items-center gap-1.5">{t('vat')}
                                            <input type="number" min="0" max="100" step="0.5"
                                                className="w-12 text-center text-xs bg-gray-50 rounded-md py-0.5 outline-none border border-gray-200 no-print"
                                                value={draft.taxRate} onChange={e => setDraft(d => ({ ...d, taxRate: parseFloat(e.target.value) || 0 }))} />% :
                                        </span>
                                        <span>{fmt(tax, draft.currency)}</span>
                                    </div>
                                    <div className="bg-[#3b1485] text-white flex justify-between p-4 px-5 text-[1.1em] font-bold mt-2.5">
                                        <span>{t('totalColon')}</span>
                                        <span>{fmt(total, draft.currency)}</span>
                                    </div>

                                    <div className="mt-10 border border-[#d1d1d1] h-[120px] bg-white flex justify-center items-end pb-5">
                                        <span className="text-[#a0a0a0] italic text-[0.9em]">{t('brandWacopiloteAutomation')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : draft.template === 'bold' ? (
                        <div className="max-w-3xl mx-auto rounded-2xl shadow-xl overflow-hidden relative" style={{ backgroundColor: '#ede8dc', backgroundImage: 'radial-gradient(circle at top right, #f6f4ee 0%, #ede8dc 40%)' }}>
                            <div className="p-12 space-y-10 text-[#0a2533] font-['Montserrat',sans-serif]">
                                {/* Header */}
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <LogoPicker value={draft.companyLogo} onChange={v => setDraft(d => ({ ...d, companyLogo: v }))} label={t('logoLabel')} size={48} />
                                        <div>
                                            <input className="text-lg font-bold text-[#0a2533] uppercase tracking-wider bg-transparent outline-none w-full placeholder:text-gray-400"
                                                value={draft.companyName} onChange={e => setDraft(d => ({ ...d, companyName: e.target.value }))} placeholder={t('yourCompanyCaps')} />
                                            <input className="text-sm text-[#0a2533] bg-transparent outline-none w-full placeholder:text-gray-400 mt-0.5"
                                                value={draft.companyTagline} onChange={e => setDraft(d => ({ ...d, companyTagline: e.target.value }))} placeholder={t('subtitleSlogan')} />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <input className="text-4xl font-bold text-[#0a2533] bg-transparent outline-none text-right w-48 tracking-widest uppercase"
                                            value={draft.invoiceNumber} onChange={e => setDraft(d => ({ ...d, invoiceNumber: e.target.value }))} />
                                    </div>
                                </div>

                                {/* Info Section */}
                                <div className="flex justify-between items-start mt-4">
                                    <div className="flex-1 max-w-sm">
                                        <p className="text-xs font-bold uppercase tracking-wider mb-2">{t('fromCaps')}</p>
                                        <textarea className="w-full bg-transparent text-sm text-[#0a2533] font-medium outline-none resize-none leading-relaxed" rows={3}
                                            value={draft.senderInfo} onChange={e => setDraft(d => ({ ...d, senderInfo: e.target.value }))}
                                            placeholder={`${t('companyName')}\n${t('address')}\n${t('email')}`} />

                                        <p className="text-xs font-bold uppercase tracking-wider mt-4 mb-2">{t('billedToCaps')}</p>
                                        <div className="flex items-start gap-3">
                                            <LogoPicker value={draft.clientLogo} onChange={v => setDraft(d => ({ ...d, clientLogo: v }))} label="Client" size={40} />
                                            <div className="flex-1">
                                                <input className="w-full text-base font-bold text-[#0a2533] bg-transparent outline-none border-b border-[#0a2533]/20 pb-1 placeholder:text-gray-400 focus:border-[#48a69e] transition-colors"
                                                    value={draft.clientName} onChange={e => setDraft(d => ({ ...d, clientName: e.target.value }))} placeholder={t('clientCompany')} />
                                                <textarea className="w-full bg-transparent text-sm text-[#0a2533] font-medium outline-none resize-none mt-2 leading-relaxed" rows={2}
                                                    value={draft.clientAddress} onChange={e => setDraft(d => ({ ...d, clientAddress: e.target.value }))} placeholder={t('clientAddress')} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right space-y-3 mt-8">
                                        <div>
                                            <p className="text-xs font-bold uppercase mb-1">{t('date')}</p>
                                            <input type="date" className="text-sm font-medium text-[#0a2533] bg-transparent outline-none" value={draft.issueDate} onChange={e => setDraft(d => ({ ...d, issueDate: e.target.value }))} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold uppercase mb-1">{t('dueDate')}</p>
                                            <input type="date" className="text-sm font-medium text-[#0a2533] bg-transparent outline-none" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>

                                {/* Table */}
                                <div>
                                    <div className="text-white rounded-[20px] px-8 py-3.5 mb-4 grid grid-cols-[1fr_4fr_2fr_2fr_3fr_1fr] md:grid-cols-[24px_4fr_2fr_2fr_3fr_24px] gap-2 items-center text-[13px] font-bold tracking-wider" style={{ background: 'linear-gradient(90deg, #256a7c, #48a69e)' }}>
                                        <div></div>
                                        <div className="col-span-1">{t('descriptionCaps')}</div>
                                        <div className="text-center">{t('qtyCaps')}</div>
                                        <div className="text-center">{t('priceCaps')}</div>
                                        <div className="text-right">{t('totalCaps')}</div>
                                        <div></div>
                                    </div>
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                                        <div className="bg-white rounded-[20px] px-8 py-5">
                                            <table className="w-full"><tbody>
                                                <SortableContext items={draft.items} strategy={verticalListSortingStrategy}>
                                                    {draft.items.map(item => (
                                                        <SortableLine key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} currency={draft.currency} t={t} />
                                                    ))}
                                                </SortableContext>
                                            </tbody></table>
                                        </div>
                                    </DndContext>
                                    <button onClick={addItem}
                                        className="mt-3 ml-2 flex items-center gap-1.5 text-xs font-bold text-[#256a7c] hover:text-[#48a69e] transition-colors no-print">
                                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                                        {t('addRow')}
                                    </button>
                                </div>

                                {/* Summary */}
                                <div className="flex gap-8 items-start mt-8">
                                    <div className="flex-1">
                                        <p className="text-[11px] font-bold uppercase tracking-wider mb-2">{t('notesCaps')}</p>
                                        <textarea className="w-full text-sm bg-transparent outline-none resize-none text-[#0a2533] leading-relaxed border-b border-[#0a2533]/10 focus:border-[#48a69e] transition-colors" rows={4}
                                            value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} placeholder={t('paymentTermsAndNotes')} />
                                    </div>
                                    <div className="w-[300px] bg-white rounded-[20px] p-6 text-sm font-semibold text-[#0a2533]">
                                        <div className="flex justify-between mb-3"><span>{t('subtotalCaps')}</span><span>{fmt(sub, draft.currency)}</span></div>
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="flex items-center gap-1.5">{t('vat')}
                                                <input type="number" min="0" max="100" step="0.5"
                                                    className="w-10 text-center text-xs bg-gray-50 rounded-md py-0.5 outline-none border border-gray-200 no-print"
                                                    value={draft.taxRate} onChange={e => setDraft(d => ({ ...d, taxRate: parseFloat(e.target.value) || 0 }))} />%
                                            </span>
                                            <span>{fmt(tax, draft.currency)}</span>
                                        </div>
                                        <div className="flex justify-between items-center mt-5 pt-5 border-t-2 border-[#ede8dc] text-lg font-bold">
                                            <span>{t('totalCaps')}</span>
                                            <span>{fmt(total, draft.currency)}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Footer Banner */}
                                <div className="rounded-full px-8 py-3.5 flex justify-between items-center text-white text-xs font-medium" style={{ background: '#072535' }}>
                                    <span>{t('generatedByWacopilote')}</span>
                                    <span>{t('thankYouForBusiness')}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto bg-white dark:bg-[#1a1f25] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                            <div className="h-1.5 bg-gradient-to-r from-emerald-600 to-emerald-400"></div>
                            <div className="p-10 space-y-10">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <LogoPicker value={draft.companyLogo} onChange={v => setDraft(d => ({ ...d, companyLogo: v }))} label={t('logoLabel')} size={56} />
                                        <div>
                                            <input className="text-xl font-extrabold text-gray-900 dark:text-white bg-transparent outline-none w-full placeholder:text-gray-300 tracking-tight"
                                                value={draft.companyName} onChange={e => setDraft(d => ({ ...d, companyName: e.target.value }))} placeholder={t('yourCompany')} />
                                            <input className="text-sm text-gray-400 bg-transparent outline-none w-full placeholder:text-gray-300 mt-0.5"
                                                value={draft.companyTagline} onChange={e => setDraft(d => ({ ...d, companyTagline: e.target.value }))} placeholder={t('subtitleSlogan')} />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gray-400 mb-1">{t('invoice')}</p>
                                        <input className="text-xl font-extrabold text-gray-900 dark:text-white bg-transparent outline-none text-right w-48 tracking-tight"
                                            value={draft.invoiceNumber} onChange={e => setDraft(d => ({ ...d, invoiceNumber: e.target.value }))} />
                                        <div className="flex gap-6 justify-end mt-3">
                                            <div>
                                                <p className="text-[9px] font-bold uppercase text-gray-400">{t('date')}</p>
                                                <input type="date" className="text-sm text-gray-700 dark:text-gray-300 bg-transparent outline-none" value={draft.issueDate} onChange={e => setDraft(d => ({ ...d, issueDate: e.target.value }))} />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase text-gray-400">{t('dueDate')}</p>
                                                <input type="date" className="text-sm text-gray-700 dark:text-gray-300 bg-transparent outline-none" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-10">
                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5">
                                        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gray-400 mb-3">{t('from')}</p>
                                        <textarea className="w-full bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none resize-none leading-relaxed" rows={4}
                                            value={draft.senderInfo} onChange={e => setDraft(d => ({ ...d, senderInfo: e.target.value }))}
                                            placeholder={`${t('companyName')}\n${t('address')}\n${t('email')}`} />
                                    </div>
                                    <div className="p-5">
                                        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gray-400 mb-3">{t('billedTo')}</p>
                                        <div className="flex items-start gap-3">
                                            <LogoPicker value={draft.clientLogo} onChange={v => setDraft(d => ({ ...d, clientLogo: v }))} label="Client" size={40} />
                                            <div className="flex-1">
                                                <input className="w-full text-base font-bold text-gray-900 dark:text-white bg-transparent outline-none border-b border-gray-200 dark:border-gray-700 pb-1 placeholder:text-gray-300 focus:border-emerald-500 transition-colors"
                                                    value={draft.clientName} onChange={e => setDraft(d => ({ ...d, clientName: e.target.value }))} placeholder={t('clientCompany')} />
                                                <textarea className="w-full bg-transparent text-sm text-gray-500 outline-none resize-none mt-2 leading-relaxed" rows={2}
                                                    value={draft.clientAddress} onChange={e => setDraft(d => ({ ...d, clientAddress: e.target.value }))} placeholder={t('clientAddress')} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b-2 border-gray-100 dark:border-gray-700">
                                                    <th className="w-6"></th>
                                                    <th className="text-left text-[9px] font-bold uppercase tracking-[.15em] text-gray-400 pb-3">{t('description')}</th>
                                                    <th className="text-center text-[9px] font-bold uppercase tracking-[.15em] text-gray-400 pb-3 w-20">{t('qty')}</th>
                                                    <th className="text-right text-[9px] font-bold uppercase tracking-[.15em] text-gray-400 pb-3 w-28">{t('price')}</th>
                                                    <th className="text-right text-[9px] font-bold uppercase tracking-[.15em] text-gray-400 pb-3 w-28">{t('total')}</th>
                                                    <th className="w-8"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <SortableContext items={draft.items} strategy={verticalListSortingStrategy}>
                                                    {draft.items.map(item => (
                                                        <SortableLine key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} currency={draft.currency} t={t} />
                                                    ))}
                                                </SortableContext>
                                            </tbody>
                                        </table>
                                    </DndContext>
                                    <button onClick={addItem}
                                        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors no-print">
                                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                                        {t('addRow')}
                                    </button>
                                </div>
                                <div className="flex justify-between gap-8 pt-8 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex-1 max-w-xs">
                                        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gray-400 mb-2">{t('notes')}</p>
                                        <textarea className="w-full text-sm bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3.5 outline-none resize-none text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700 focus:border-emerald-400 transition-colors" rows={4}
                                            value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} placeholder={t('noteToClient')} />
                                    </div>
                                    <div className="w-64 space-y-2.5">
                                        <div className="flex justify-between text-sm text-gray-500"><span>{t('subtotal')}</span><span className="tabular-nums">{fmt(sub, draft.currency)}</span></div>
                                        <div className="flex justify-between text-sm text-gray-500 items-center">
                                            <span className="flex items-center gap-1.5">{t('vat')}
                                                <input type="number" min="0" max="100" step="0.5"
                                                    className="w-10 text-center text-xs bg-gray-50 dark:bg-gray-800 rounded-md py-0.5 outline-none border border-gray-200 dark:border-gray-700 no-print"
                                                    value={draft.taxRate} onChange={e => setDraft(d => ({ ...d, taxRate: parseFloat(e.target.value) || 0 }))} />%
                                            </span>
                                            <span className="tabular-nums">{fmt(tax, draft.currency)}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-700">
                                            <span className="text-sm font-bold text-gray-800 dark:text-white">{t('total')}</span>
                                            <span className="text-2xl font-extrabold text-emerald-600 tabular-nums">{fmt(total, draft.currency)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>


                {/* Sidebar: Templates */}
                <aside className="w-64 bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 p-5 flex flex-col gap-6 overflow-y-auto no-print">
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gray-400 mb-4">{t('templateLabel')}</p>
                        <div className="space-y-4">
                            {TPL_PREVIEWS.map(tItem => (
                                <TplThumb key={tItem.id} tpl={tItem} active={draft.template === tItem.id} onClick={() => setDraft(d => ({ ...d, template: tItem.id }))} t={t} />
                            ))}
                        </div>
                    </div>

                    {/* Quick summary */}
                    <div className="mt-auto pt-5 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gray-400 mb-3">{t('summary')}</p>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between text-gray-500"><span>{t('rows')}</span><span className="font-semibold">{draft.items.length}</span></div>
                            <div className="flex justify-between text-gray-500"><span>{t('subtotal')}</span><span className="font-semibold">{fmt(sub, draft.currency)}</span></div>
                            <div className="flex justify-between text-gray-500"><span>{t('vat')}</span><span className="font-semibold">{fmt(tax, draft.currency)}</span></div>
                            <div className="flex justify-between font-bold text-gray-800 dark:text-white pt-2 border-t border-gray-100 dark:border-gray-800">
                                <span>{t('total')}</span><span className="text-emerald-600">{fmt(total, draft.currency)}</span>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
