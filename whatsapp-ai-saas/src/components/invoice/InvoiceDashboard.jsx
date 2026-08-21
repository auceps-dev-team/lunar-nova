import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KPI from './KPI';
import { calc, fmt } from './helpers';
import { STATUS_MAP } from './constants';

/**
 * Vue « Tableau de bord » d'InvoiceBuilder (liste des factures + KPIs + graphique).
 * Extraite de src/pages/InvoiceBuilder.jsx (refactor de découpage — aucun
 * changement de comportement).
 */
export default function InvoiceDashboard({ chartData, deleteInvoice, filterStatus, filtered, handleEdit, handleNew, invoices, paidN, pendN, primaryCurrency, setFilterStatus, totalRevStr }) {
    const { t } = useTranslation();

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
