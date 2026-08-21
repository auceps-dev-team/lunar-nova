import { useTranslation } from 'react-i18next';
import { C, Ico } from './WPTheme';

/**
 * Onglet extrait de src/pages/WordPressBridge.jsx (refactor de découpage —
 * aucun changement de comportement). Les props proviennent du composant parent.
 */
export default function WpTabPosts({ isLoading, posts, selected }) {
    const { t } = useTranslation();

    return (
                <div>
                    {!selected && <EmptyState icon={Ico.file} title={t('wpNoSiteSelectedTitle')} sub={t('wpSelectSiteSub')} />}
                    {selected && isLoading && <Card><div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3,4,5].map(k => <Skeleton key={k} h={60} />)}</div></Card>}
                    {selected && !isLoading && (
                        <Card>
                            <CardHeader title={t('wpPostsTitle', { site: selected.name })} sub={t('wpPostsLoadedCount', { count: posts.length })} />
                            <div>
                                {posts.length === 0 && <EmptyState icon={Ico.file} title={t('wpNoPostsTitle')} sub={t('wpNoPostsSub')} />}
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
    );
}
