import { useTranslation } from 'react-i18next';
import { C, Ico } from './WPTheme';

/**
 * Onglet extrait de src/pages/WordPressBridge.jsx (refactor de découpage —
 * aucun changement de comportement). Les props proviennent du composant parent.
 */
export default function WpTabConnection({ connections, form, handleAdd, handleDelete, handleTest, isDeleting, isSaving, isTesting, selectedId, setForm, setSelectedId }) {
    const { t } = useTranslation();

    return (
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
    );
}
