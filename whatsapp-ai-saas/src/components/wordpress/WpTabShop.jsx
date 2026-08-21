import { useTranslation } from 'react-i18next';
import { C, Ico } from './WPTheme';

/**
 * Onglet extrait de src/pages/WordPressBridge.jsx (refactor de découpage —
 * aucun changement de comportement). Les props proviennent du composant parent.
 */
export default function WpTabShop({ isLoading, isProductsLoading, loadProducts, orders, productFilters, products, productsMeta, productsPagination, selected, selectedId, setProductFilters, setProductModal }) {
    const { t } = useTranslation();

    return (
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
                                                {products.map((p) => (
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
    );
}
