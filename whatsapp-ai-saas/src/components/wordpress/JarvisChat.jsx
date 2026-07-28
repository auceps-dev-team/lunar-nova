import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../config';
import { C } from './WPUI';

export default function JarvisChat({ selectedId, selected }) {
    const { t } = useTranslation();
    const [isJarvisOpen, setIsJarvisOpen] = useState(false);
    const [jarvisInput, setJarvisInput] = useState('');
    const [isJarvisLoading, setIsJarvisLoading] = useState(false);
    const jarvisBottomRef = useRef(null);
    const [jarvisHistory, setJarvisHistory] = useState([
        { sender: 'agent', text: t('wpJarvisWelcome') }
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
            setJarvisHistory(prev => [...prev, { sender: 'agent', text: t('wpJarvisNoSiteSelected') }]);
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

            let replyText = data.response || t('wpJarvisNoResponse');
            const parsed = extractJSON(replyText);

            if (parsed) {
                if (parsed.text) replyText = parsed.text;

                if (parsed.actions && Array.isArray(parsed.actions) && parsed.actions.length > 0) {
                    const action = parsed.actions[0];
                    setJarvisHistory(prev => [...prev, {
                        sender: 'agent',
                        text: replyText,
                        proposal: { action, userMessage }
                    }]);
                    return; // Skip the generic setJarvisHistory at the end
                }
            }

            setJarvisHistory(prev => [...prev, { sender: 'agent', text: replyText }]);
        } catch {
            setJarvisHistory(prev => [...prev, { sender: 'agent', text: t('wpJarvisConnectionError') }]);
        } finally {
            setIsJarvisLoading(false);
        }
    };

    const handleConfirmProposal = async (msgIndex) => {
        const msg = jarvisHistory[msgIndex];
        const { action, userMessage } = msg.proposal;

        setJarvisHistory(prev => {
            const next = [...prev];
            next[msgIndex] = { ...next[msgIndex], isProposing: true };
            return next;
        });

        try {
            const payload = {
                intent_type: action.type,
                intent_data: action.payload,
                agent_context: userMessage
            };
            const r = await fetch(`${API_BASE_URL}/api/wp/${selectedId}/propose`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const d = await r.json();

            setJarvisHistory(prev => {
                const next = [...prev];
                next[msgIndex].isProposing = false;
                if (d.status === 'success') {
                    next[msgIndex].isProposed = true;
                    next[msgIndex].text += t('wpJarvisProposalSuccess', { id: d.data?.action_id || 'N/A' });
                } else {
                    next[msgIndex].error = d.error;
                }
                return next;
            });
        } catch (e) {
            setJarvisHistory(prev => {
                const next = [...prev];
                next[msgIndex].isProposing = false;
                next[msgIndex].error = e.message;
                return next;
            });
        }
    };

    const handleCancelProposal = (msgIndex) => {
        setJarvisHistory(prev => {
            const next = [...prev];
            next[msgIndex] = { ...next[msgIndex], isCancelled: true };
            next[msgIndex].text += t('wpJarvisProposalCancelled');
            return next;
        });
    };

    return (
        <>
            {/* ── Jarvis WP Floating Button ── */}
            <button
                onClick={() => setIsJarvisOpen(true)}
                title={t('wpJarvisOpenTitle')}
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
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{t('wpJarvisName')}</div>
                            <div style={{ fontSize: 11, color: C.primary, fontWeight: 600 }}>{t('wpJarvisSubtitle')}</div>
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
                            }}>
                                {msg.text}
                                
                                {/* Proposal UI */}
                                {msg.proposal && !msg.isProposed && !msg.isCancelled && (
                                    <div style={{ marginTop: 12, padding: 12, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 8, textTransform: 'uppercase' }}>
                                            {t('wpJarvisProposedAction', { type: msg.proposal.action.type.replace('_', ' ') })}
                                        </div>
                                        <pre style={{ margin: 0, padding: 8, background: '#f1f5f9', borderRadius: 6, fontSize: 11, overflowX: 'auto', maxHeight: 150 }}>
                                            {JSON.stringify(msg.proposal.action.payload, null, 2)}
                                        </pre>
                                        
                                        {msg.error && (
                                            <div style={{ marginTop: 8, padding: 8, background: '#fee2e2', color: '#b91c1c', borderRadius: 6, fontSize: 12 }}>
                                                ❌ {msg.error}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                            <button 
                                                onClick={() => handleConfirmProposal(i)} 
                                                disabled={msg.isProposing}
                                                style={{ flex: 1, padding: '6px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: msg.isProposing ? 'not-allowed' : 'pointer', opacity: msg.isProposing ? 0.7 : 1 }}
                                            >
                                                {msg.isProposing ? t('wpJarvisSending') : t('wpJarvisConfirm')}
                                            </button>
                                            <button 
                                                onClick={() => handleCancelProposal(i)} 
                                                disabled={msg.isProposing}
                                                style={{ flex: 1, padding: '6px', background: '#e2e8f0', color: C.textSub, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: msg.isProposing ? 'not-allowed' : 'pointer' }}
                                            >
                                                {t('cancel')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
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
                        t('wpQuickCreateProduct'),
                        t('wpQuickCreateArticle'),
                        t('wpQuickPublishDirect'),
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
                            placeholder={t('wpJarvisInputPlaceholder')}
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
