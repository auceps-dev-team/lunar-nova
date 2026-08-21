import { useTranslation } from 'react-i18next';
import { C, Ico } from './WPTheme';

/**
 * Onglet extrait de src/pages/WordPressBridge.jsx (refactor de découpage —
 * aucun changement de comportement). Les props proviennent du composant parent.
 */
export default function WpTabOverview({ analytics, analyticsPeriod, isLoading, selected, setAnalyticsPeriod, stats }) {
    const { t } = useTranslation();

    return (
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
    );
}
