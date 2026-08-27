import DOMPurify from 'dompurify';
import { useTranslation } from 'react-i18next';
import { C } from './WPTheme';
import { StatusBadge } from './WPUI';

/**
 * Onglet extrait de src/pages/WordPressBridge.jsx (refactor de découpage —
 * aucun changement de comportement). Les props proviennent du composant parent.
 */
export default function WpProductModal({ productModal, setProductModal }) {
    const { t } = useTranslation();

    return (
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
                            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, fontFamily: 'system-ui, sans-serif' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(productModal.description || productModal.short_description || `<div style="color: #94a3b8; font-style: italic;">${t('wpNoDescriptionAvailable')}</div>`) }} />
                        </div>
                    </div>
                </div>
    );
}
