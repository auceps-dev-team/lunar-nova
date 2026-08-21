import { useTranslation } from 'react-i18next';
import { C, Ico } from './WPTheme';

/**
 * Onglet extrait de src/pages/WordPressBridge.jsx (refactor de découpage —
 * aucun changement de comportement). Les props proviennent du composant parent.
 */
export default function WpTabLogs({ isLoading, loadLogs, logs, logsFilters, logsPagination, selected, selectedId, setLogsFilters }) {
    const { t } = useTranslation();

    return (
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
    );
}
