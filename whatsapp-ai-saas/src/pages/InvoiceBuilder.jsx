import React, { useState, useCallback, useMemo, useRef } from 'react';
import useAppStore from '../store';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// ─── Color palettes per template ────────────────────────────────────────────
const TEMPLATES = {
    classic: {
        id: 'classic',
        label: 'Classic Minimal',
        accent: '#067d55',
        bg: '#ffffff',
        headerBg: '#f8faf9',
        textPrimary: '#1a1c1b',
        textSecondary: '#5f6260',
        border: '#e0e3e1',
    },
    modern: {
        id: 'modern',
        label: 'Modern Dark',
        accent: '#48d99a',
        bg: '#1a1c1a',
        headerBg: '#0d1f17',
        textPrimary: '#e8f0ed',
        textSecondary: '#9ab5a5',
        border: '#2e3d33',
    },
    contrast: {
        id: 'contrast',
        label: 'High Contrast',
        accent: '#0040dd',
        bg: '#ffffff',
        headerBg: '#f0f4ff',
        textPrimary: '#050a1a',
        textSecondary: '#4a5270',
        border: '#c8d0e8',
    },
};

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'XOF'];
const STATUS_COLORS = {
    paid: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300' },
    pending: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
    overdue: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300' },
    draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
};

// ─── Helper: calculate invoice totals ────────────────────────────────────────
function calcTotals(items, taxRate = 0) {
    const subtotal = items.reduce((s, i) => s + (i.qty * i.price), 0);
    const tax = subtotal * (taxRate / 100);
    return { subtotal, tax, total: subtotal + tax };
}

function fmtCurrency(amount, currency = 'EUR') {
    return amount.toLocaleString('fr-FR', { style: 'currency', currency, minimumFractionDigits: 2 });
}

function getMonthlyRevenue(invoices) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const data = months.map((m, idx) => ({ month: m, revenue: 0 }));
    invoices.forEach(inv => {
        if (!inv.createdAt) return;
        const d = new Date(inv.createdAt);
        const { total } = calcTotals(inv.items || [], inv.taxRate || 0);
        data[d.getMonth()].revenue += total;
    });
    return data;
}

// ─── Sortable row for drag-and-drop ─────────────────────────────────────────
function SortableRow({ item, onUpdate, onRemove, currency, tpl }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
    const lineTotal = item.qty * item.price;

    return (
        <div ref={setNodeRef} style={style} className={`grid items-center gap-2 py-3 border-b group ${isDragging ? 'shadow-lg rounded-xl z-50' : ''}`}
            style={{ ...style, gridTemplateColumns: '24px 1fr 80px 100px 100px 32px', borderColor: tpl.border }}>
            {/* Drag handle */}
            <div {...attributes} {...listeners} className="cursor-grab opacity-30 hover:opacity-80 transition-opacity" title="Drag to reorder">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="9" y1="5" x2="15" y2="5"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="19" x2="15" y2="19"/>
                </svg>
            </div>
            <input
                className="w-full bg-transparent border-b focus:border-current outline-none text-sm font-medium transition-colors"
                style={{ borderColor: 'transparent', color: tpl.textPrimary }}
                value={item.description} placeholder="Description du service..."
                onChange={e => onUpdate(item.id, 'description', e.target.value)}
            />
            <input type="number" min="1"
                className="w-full text-center rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 ring-opacity-50 transition"
                style={{ background: tpl.headerBg, color: tpl.textPrimary, focusRingColor: tpl.accent }}
                value={item.qty} onChange={e => onUpdate(item.id, 'qty', parseFloat(e.target.value) || 1)}
            />
            <input type="number" min="0" step="0.01"
                className="w-full text-right rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 transition"
                style={{ background: tpl.headerBg, color: tpl.textPrimary }}
                value={item.price} onChange={e => onUpdate(item.id, 'price', parseFloat(e.target.value) || 0)}
            />
            <div className="text-right text-sm font-bold" style={{ color: tpl.accent }}>
                {fmtCurrency(lineTotal, currency)}
            </div>
            <button onClick={() => onRemove(item.id)}
                className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all text-red-400 hover:text-red-600">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    );
}

// ─── Template thumbnail preview ───────────────────────────────────────────────
function TemplateThumbnail({ tpl, active, onClick }) {
    return (
        <button onClick={onClick} className="w-full text-left group transition-all">
            <div className={`aspect-[3/4] rounded-xl overflow-hidden p-3 shadow-md transition-all ${active ? 'ring-2 ring-offset-2' : 'hover:ring-2 hover:ring-offset-1 ring-gray-300'}`}
                style={{ background: tpl.bg, ringColor: tpl.accent }}>
                <div className="w-full h-full rounded-lg p-2 space-y-2" style={{ background: tpl.headerBg }}>
                    <div className="h-2 w-1/2 rounded" style={{ background: tpl.accent + '60' }}></div>
                    <div className="h-1 w-full rounded" style={{ background: tpl.border }}></div>
                    <div className="h-1 w-3/4 rounded" style={{ background: tpl.border }}></div>
                    <div className="mt-3 h-10 w-full rounded" style={{ background: tpl.bg, border: `1px solid ${tpl.border}` }}></div>
                    <div className="h-1 w-full rounded" style={{ background: tpl.border }}></div>
                    <div className="h-1 w-2/3 rounded" style={{ background: tpl.border }}></div>
                </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{tpl.label}</span>
                {active && (
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                )}
            </div>
        </button>
    );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon, color }) {
    return (
        <div className={`rounded-2xl p-5 flex items-start gap-4 bg-white dark:bg-gray-800 shadow-soft border border-transparent dark:border-gray-700`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0`} style={{ background: color }}>
                {icon}
            </div>
            <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5">{value}</p>
                {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Invoice Canvas (printable) ───────────────────────────────────────────────
function InvoiceCanvas({ draft, onChange, tpl, sensors, handleDragEnd }) {
    const { subtotal, tax, total } = calcTotals(draft.items, draft.taxRate);
    const invoiceNum = draft.invoiceNumber || `#INV-${Date.now().toString().slice(-6)}`;

    const updateItem = useCallback((id, field, value) => {
        onChange({ ...draft, items: draft.items.map(it => it.id === id ? { ...it, [field]: value } : it) });
    }, [draft, onChange]);

    const removeItem = useCallback(id => {
        onChange({ ...draft, items: draft.items.filter(it => it.id !== id) });
    }, [draft, onChange]);

    const addItem = () => {
        onChange({ ...draft, items: [...draft.items, { id: `i-${Date.now()}`, description: '', qty: 1, price: 0 }] });
    };

    const onDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIdx = draft.items.findIndex(i => i.id === active.id);
            const newIdx = draft.items.findIndex(i => i.id === over.id);
            onChange({ ...draft, items: arrayMove(draft.items, oldIdx, newIdx) });
        }
    };

    return (
        <div id="invoice-canvas" className="rounded-2xl overflow-hidden shadow-xl"
            style={{ background: tpl.bg, color: tpl.textPrimary, fontFamily: "'Inter', sans-serif" }}>
            {/* Accent strip */}
            <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${tpl.accent}, ${tpl.accent}99)` }}></div>

            <div className="p-10 space-y-10">
                {/* Header: Brand + Invoice # */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                            style={{ background: tpl.accent + '20' }}>
                            <span style={{ color: tpl.accent }}>●</span>
                        </div>
                        <div>
                            <input className="text-xl font-extrabold tracking-tight bg-transparent outline-none border-b border-transparent focus:border-current w-full"
                                style={{ color: tpl.textPrimary, borderColor: 'transparent' }}
                                value={draft.companyName || ''}
                                onChange={e => onChange({ ...draft, companyName: e.target.value })}
                                placeholder="Votre entreprise"
                            />
                            <input className="text-sm mt-0.5 bg-transparent outline-none w-full"
                                style={{ color: tpl.textSecondary }}
                                value={draft.companyTagline || ''}
                                onChange={e => onChange({ ...draft, companyTagline: e.target.value })}
                                placeholder="Sous-titre / secteur"
                            />
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: tpl.textSecondary }}>Numéro de facture</p>
                        <input className="text-xl font-bold bg-transparent outline-none text-right"
                            style={{ color: tpl.textPrimary }}
                            value={invoiceNum}
                            onChange={e => onChange({ ...draft, invoiceNumber: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-6 mt-3 text-right">
                            <div>
                                <p className="text-xs font-bold uppercase" style={{ color: tpl.textSecondary }}>Date</p>
                                <input type="date" className="text-sm bg-transparent outline-none text-right"
                                    style={{ color: tpl.textPrimary }}
                                    value={draft.issueDate || ''}
                                    onChange={e => onChange({ ...draft, issueDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase" style={{ color: tpl.textSecondary }}>Échéance</p>
                                <input type="date" className="text-sm bg-transparent outline-none text-right"
                                    style={{ color: tpl.textPrimary }}
                                    value={draft.dueDate || ''}
                                    onChange={e => onChange({ ...draft, dueDate: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Client addresses */}
                <div className="grid grid-cols-2 gap-12">
                    <div className="p-5 rounded-xl" style={{ background: tpl.headerBg }}>
                        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: tpl.textSecondary }}>Expéditeur</p>
                        <textarea className="w-full bg-transparent outline-none text-sm resize-none leading-relaxed"
                            style={{ color: tpl.textPrimary }}
                            value={draft.senderInfo || ''}
                            rows={4}
                            onChange={e => onChange({ ...draft, senderInfo: e.target.value })}
                            placeholder={"Votre nom\nVotre adresse\nVotre email"}
                        />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: tpl.textSecondary }}>Facturé à</p>
                        <input className="w-full text-lg font-bold bg-transparent outline-none border-b pb-1 transition"
                            style={{ color: tpl.textPrimary, borderColor: tpl.border }}
                            value={draft.clientName || ''}
                            onChange={e => onChange({ ...draft, clientName: e.target.value })}
                            placeholder="Nom du client ou société"
                        />
                        <textarea className="w-full bg-transparent outline-none text-sm resize-none leading-relaxed mt-2"
                            style={{ color: tpl.textSecondary }}
                            value={draft.clientAddress || ''}
                            rows={3}
                            onChange={e => onChange({ ...draft, clientAddress: e.target.value })}
                            placeholder={"Adresse du client\nVille, code postal"}
                        />
                    </div>
                </div>

                {/* Line items table */}
                <div>
                    {/* Table header */}
                    <div className="grid text-xs font-bold uppercase tracking-widest pb-3 border-b"
                        style={{ gridTemplateColumns: '24px 1fr 80px 100px 100px 32px', color: tpl.textSecondary, borderColor: tpl.border }}>
                        <span></span>
                        <span>Description</span>
                        <span className="text-center">Qté</span>
                        <span className="text-right">Prix unit.</span>
                        <span className="text-right">Total</span>
                        <span></span>
                    </div>

                    {/* Sortable rows */}
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                        <SortableContext items={draft.items} strategy={verticalListSortingStrategy}>
                            {draft.items.map(item => (
                                <SortableRow key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} currency={draft.currency} tpl={tpl} />
                            ))}
                        </SortableContext>
                    </DndContext>

                    <button onClick={addItem}
                        className="mt-4 flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70 no-print"
                        style={{ color: tpl.accent }}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                        </svg>
                        Ajouter une ligne
                    </button>
                </div>

                {/* Footer: Notes + Totals */}
                <div className="pt-8 border-t flex justify-between gap-8" style={{ borderColor: tpl.border }}>
                    <div className="flex-1 max-w-xs">
                        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: tpl.textSecondary }}>Notes</p>
                        <textarea
                            className="w-full text-sm rounded-xl p-4 resize-none outline-none focus:ring-2 transition"
                            style={{ background: tpl.headerBg, color: tpl.textPrimary, border: `1px solid ${tpl.border}` }}
                            rows={4}
                            placeholder="Note personnalisée pour le client..."
                            value={draft.notes || ''}
                            onChange={e => onChange({ ...draft, notes: e.target.value })}
                        />
                    </div>
                    <div className="w-72 space-y-3">
                        <div className="flex justify-between text-sm" style={{ color: tpl.textSecondary }}>
                            <span>Sous-total</span>
                            <span>{fmtCurrency(subtotal, draft.currency)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm" style={{ color: tpl.textSecondary }}>
                            <span className="flex items-center gap-2">
                                TVA
                                <input type="number" min="0" max="100" step="0.5"
                                    className="w-12 text-center rounded-lg px-1 py-0.5 text-xs outline-none no-print"
                                    style={{ background: tpl.headerBg, color: tpl.textPrimary, border: `1px solid ${tpl.border}` }}
                                    value={draft.taxRate || 0}
                                    onChange={e => onChange({ ...draft, taxRate: parseFloat(e.target.value) || 0 })}
                                />
                                %
                            </span>
                            <span>{fmtCurrency(tax, draft.currency)}</span>
                        </div>
                        <div className="pt-4 border-t flex justify-between items-center" style={{ borderColor: tpl.border }}>
                            <span className="font-bold text-base" style={{ color: tpl.textPrimary }}>Total dû</span>
                            <span className="text-2xl font-extrabold" style={{ color: tpl.accent }}>{fmtCurrency(total, draft.currency)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Empty invoice template ───────────────────────────────────────────────────
function newInvoiceDraft() {
    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + 30);
    return {
        id: `inv-${Date.now()}`,
        invoiceNumber: `#INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
        companyName: 'Votre Entreprise',
        companyTagline: 'Secteur d\'activité',
        senderInfo: 'Votre nom\n123 Rue de la Paix\ncity@email.com',
        clientName: '',
        clientEmail: '',
        clientAddress: '',
        issueDate: today.toISOString().split('T')[0],
        dueDate: due.toISOString().split('T')[0],
        items: [{ id: `i-${Date.now()}`, description: '', qty: 1, price: 0 }],
        taxRate: 20,
        notes: '',
        status: 'draft',
        template: 'classic',
        currency: 'EUR',
        createdAt: new Date().toISOString(),
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function InvoiceBuilder() {
    const invoices = useAppStore(s => s.invoices) || [];
    const addInvoice = useAppStore(s => s.addInvoice);
    const updateInvoice = useAppStore(s => s.updateInvoice);
    const deleteInvoice = useAppStore(s => s.deleteInvoice);

    const [view, setView] = useState('dashboard'); // 'dashboard' | 'editor'
    const [draft, setDraft] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState('classic');
    const [saved, setSaved] = useState(false);
    const [filterStatus, setFilterStatus] = useState('all');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const tpl = TEMPLATES[draft?.template || selectedTemplate] || TEMPLATES.classic;

    // KPI computations
    const totalRevenue = invoices.reduce((s, inv) => s + calcTotals(inv.items || [], inv.taxRate || 0).total, 0);
    const paidCount = invoices.filter(i => i.status === 'paid').length;
    const pendingCount = invoices.filter(i => i.status === 'pending').length;
    const monthlyData = useMemo(() => getMonthlyRevenue(invoices), [invoices]);
    const filteredInvoices = filterStatus === 'all' ? invoices : invoices.filter(i => i.status === filterStatus);

    // Open a new invoice in editor
    const handleCreateNew = () => {
        const d = newInvoiceDraft();
        d.template = selectedTemplate;
        setDraft(d);
        setSaved(false);
        setView('editor');
    };

    // Open existing invoice for editing
    const handleEdit = (inv) => {
        setDraft({ ...inv });
        setSelectedTemplate(inv.template || 'classic');
        setSaved(true);
        setView('editor');
    };

    // Save invoice to store
    const handleSave = () => {
        if (!draft) return;
        const exists = invoices.find(i => i.id === draft.id);
        if (exists) {
            updateInvoice(draft.id, draft);
        } else {
            addInvoice(draft);
        }
        setSaved(true);
    };

    // PDF Print
    const handlePrint = () => window.print();

    // Change template on draft
    const handleTemplateChange = (tplId) => {
        setSelectedTemplate(tplId);
        if (draft) setDraft({ ...draft, template: tplId });
    };

    // ── DASHBOARD VIEW ─────────────────────────────────────────────────────────
    if (view === 'dashboard') {
        return (
            <div className="min-h-full p-0">
                {/* Page header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Invoice Builder</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Gérez vos factures et suivez vos revenus.</p>
                    </div>
                    <button onClick={handleCreateNew}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-md hover:opacity-90 active:scale-[.98] transition-all"
                        style={{ background: 'linear-gradient(135deg, #067d55, #04543a)' }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Nouvelle facture
                    </button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <KPICard label="Total factures" value={invoices.length} icon="📄" color="#067d55" />
                    <KPICard label="Chiffre d'affaires" value={fmtCurrency(totalRevenue, 'EUR')} icon="💰" color="#0e7490" />
                    <KPICard label="Payées" value={paidCount} sub={`sur ${invoices.length} factures`} icon="✅" color="#16a34a" />
                    <KPICard label="En attente" value={pendingCount} icon="⏳" color="#d97706" />
                </div>

                {/* Monthly Revenue Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-soft border border-transparent dark:border-gray-700 mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Revenus mensuels</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v) => fmtCurrency(v, 'EUR')} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                            <Bar dataKey="revenue" fill="#067d55" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Invoice list */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-transparent dark:border-gray-700">
                    <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Factures récentes</h3>
                        <div className="flex items-center gap-2">
                            {['all', 'paid', 'pending', 'overdue', 'draft'].map(s => (
                                <button key={s} onClick={() => setFilterStatus(s)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-all ${filterStatus === s ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}>
                                    {s === 'all' ? 'Toutes' : s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="divide-y divide-gray-50 dark:divide-gray-700">
                        {filteredInvoices.length === 0 && (
                            <div className="text-center py-16 text-gray-400">
                                <div className="text-5xl mb-3">📋</div>
                                <p className="text-sm">Aucune facture trouvée.</p>
                                <button onClick={handleCreateNew} className="mt-4 text-sm text-emerald-600 font-semibold hover:underline">Créer une facture →</button>
                            </div>
                        )}
                        {filteredInvoices.map(inv => {
                            const { total } = calcTotals(inv.items || [], inv.taxRate || 0);
                            const sc = STATUS_COLORS[inv.status] || STATUS_COLORS.draft;
                            return (
                                <div key={inv.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors group" onClick={() => handleEdit(inv)}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: '#067d5520', color: '#067d55' }}>
                                            {inv.clientName?.slice(0, 2).toUpperCase() || '??'}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-gray-900 dark:text-white">{inv.clientName || 'Sans nom'}</p>
                                            <p className="text-xs text-gray-400">{inv.invoiceNumber} · Émise le {inv.issueDate}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${sc.bg} ${sc.text}`}>{inv.status}</span>
                                        <span className="font-bold text-sm text-gray-800 dark:text-gray-200 w-28 text-right">{fmtCurrency(total, inv.currency || 'EUR')}</span>
                                        <button onClick={e => { e.stopPropagation(); if(window.confirm('Supprimer cette facture ?')) deleteInvoice(inv.id); }}
                                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all text-red-400 hover:text-red-600">
                                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // ── EDITOR VIEW ────────────────────────────────────────────────────────────
    return (
        <div className="min-h-full" style={{ margin: '-24px' }}>
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #invoice-canvas, #invoice-canvas * { visibility: visible !important; }
                    #invoice-canvas { position: fixed; inset: 0; width: 100%; padding: 20mm; box-sizing: border-box; }
                    .no-print { display: none !important; }
                }
            `}</style>

            {/* Editor Topbar */}
            <div className="no-print flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView('dashboard')}
                        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors font-medium">
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 5 5 12 12 19"/></svg>
                        Retour
                    </button>
                    <span className="text-gray-300 dark:text-gray-600">/</span>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white">{draft?.invoiceNumber || 'Nouvelle facture'}</h2>
                        <p className="text-xs text-gray-400">{saved ? 'Sauvegardé ✓' : 'Non sauvegardé'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Status selector */}
                    <select value={draft?.status || 'draft'} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}
                        className="text-xs font-bold uppercase border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-transparent text-gray-700 dark:text-gray-300 outline-none cursor-pointer">
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                    </select>
                    {/* Currency */}
                    <select value={draft?.currency || 'EUR'} onChange={e => setDraft(d => ({ ...d, currency: e.target.value }))}
                        className="text-xs font-bold border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-transparent text-gray-700 dark:text-gray-300 outline-none cursor-pointer">
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                        </svg>
                        Export PDF
                    </button>
                    <button onClick={handleSave}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white shadow-md hover:opacity-90 active:scale-[.98] transition-all"
                        style={{ background: 'linear-gradient(135deg, #067d55, #04543a)' }}>
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                        </svg>
                        Sauvegarder
                    </button>
                </div>
            </div>

            {/* Main editor area */}
            <div className="flex min-h-[calc(100vh-64px)]">
                {/* Invoice canvas */}
                <div className="flex-1 p-8 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
                    <div className="max-w-4xl mx-auto">
                        {draft && (
                            <InvoiceCanvas
                                draft={draft}
                                onChange={setDraft}
                                tpl={tpl}
                                sensors={sensors}
                            />
                        )}
                    </div>
                </div>

                {/* Template sidebar */}
                <aside className="no-print w-72 bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 p-6 flex flex-col gap-8 overflow-y-auto">
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Choisir un modèle</h4>
                        <div className="space-y-5">
                            {Object.values(TEMPLATES).map(t => (
                                <TemplateThumbnail
                                    key={t.id}
                                    tpl={t}
                                    active={selectedTemplate === t.id}
                                    onClick={() => handleTemplateChange(t.id)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Quick totals summary */}
                    {draft && (() => {
                        const { subtotal, tax, total } = calcTotals(draft.items, draft.taxRate);
                        return (
                            <div className="mt-auto pt-6 border-t border-gray-100 dark:border-gray-800">
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Résumé</p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-gray-500"><span>Sous-total</span><span className="font-semibold">{fmtCurrency(subtotal, draft.currency)}</span></div>
                                    <div className="flex justify-between text-gray-500"><span>TVA ({draft.taxRate || 0}%)</span><span className="font-semibold">{fmtCurrency(tax, draft.currency)}</span></div>
                                    <div className="flex justify-between font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-100 dark:border-gray-800">
                                        <span>Total</span><span className="text-emerald-600">{fmtCurrency(total, draft.currency)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </aside>
            </div>
        </div>
    );
}
