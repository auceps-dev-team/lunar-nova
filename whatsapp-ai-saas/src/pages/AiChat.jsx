import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Copy, Trash2, Search, Plus, Menu, ArrowLeft, Send, Paperclip, Type, Mic, X } from 'lucide-react';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';


// ─── Couleurs pastel générées déterministement par nom ────────────────────
const PASTEL_PALETTE = [
    { bg: '#e8d5f5', text: '#7c3aed' }, { bg: '#d4e8ff', text: '#1d6fa4' },
    { bg: '#fde8d0', text: '#b45309' }, { bg: '#d0f5e8', text: '#047857' },
    { bg: '#fde8f0', text: '#be185d' }, { bg: '#e8f0fd', text: '#1e40af' },
    { bg: '#f5f0d0', text: '#92400e' }, { bg: '#d0f0f5', text: '#0e7490' },
    { bg: '#f0d0f5', text: '#7e22ce' }, { bg: '#f5d0d0', text: '#b91c1c' },
];
const getAgentColor = (id) => PASTEL_PALETTE[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % PASTEL_PALETTE.length];
const getInitials = (name) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);

// ─── Formatage markdown simple ────────────────────────────────────────────
const formatMessage = (text) => {
    if (!text) return '';
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
        .replace(/\n/g, '<br/>');
};

export default function AiChat() {
    const { t } = useTranslation();
    const showAppNotification = useAppStore(state => state.showAppNotification);
    const appSettings = useAppStore(state => state.appSettings) || {};
    const language = appSettings.language || 'en';

    // ── Agents système (définis à l'intérieur pour utiliser t()) ───────────
    const SYSTEM_AGENTS = [
        { id: 'copywriter', name: t('agentJarvisName'), description: t('agentJarvisDesc'), isSystem: true },
        { id: 'legal', name: t('agentLegalName'), description: t('agentLegalDesc'), isSystem: true },
        { id: 'ella', name: t('agentEllaName'), description: t('agentEllaDesc'), isSystem: true },
        { id: 'brand_guardian', name: t('agentBrandName'), description: t('agentBrandDesc'), isSystem: true },
        { id: 'paid_social_strategist', name: t('agentPaidSocialName'), description: t('agentPaidSocialDesc'), isSystem: true },
        { id: 'ad_creative_strategist', name: t('agentCreativeAdsName'), description: t('agentCreativeAdsDesc'), isSystem: true },
        { id: 'outbound_strategist', name: t('agentOutboundName'), description: t('agentOutboundDesc'), isSystem: true },
        { id: 'sales_engineer', name: t('agentSalesEngName'), description: t('agentSalesEngDesc'), isSystem: true },
        { id: 'sales_coach', name: t('agentSalesCoachName'), description: t('agentSalesCoachDesc'), isSystem: true },
        { id: 'growth_hacker', name: t('agentGrowthName'), description: t('agentGrowthDesc'), isSystem: true },
        { id: 'content_creator', name: t('agentContentName'), description: t('agentContentDesc'), isSystem: true },
        { id: 'twitter_engager', name: t('agentTwitterName'), description: t('agentTwitterDesc'), isSystem: true },
        { id: 'tiktok_strategist', name: t('agentTiktokName'), description: t('agentTiktokDesc'), isSystem: true },
        { id: 'instagram_curator', name: t('agentInstaName'), description: t('agentInstaDesc'), isSystem: true },
        { id: 'social_media_strategist', name: t('agentSocialMediaName'), description: t('agentSocialMediaDesc'), isSystem: true },
        { id: 'seo_specialist', name: t('agentSeoName'), description: t('agentSeoDesc'), isSystem: true },
        { id: 'podcast_strategist', name: t('agentPodcastName'), description: t('agentPodcastDesc'), isSystem: true },
        { id: 'support_responder', name: t('agentSupportName'), description: t('agentSupportDesc'), isSystem: true },
        { id: 'legal_compliance', name: t('agentComplianceName'), description: t('agentComplianceDesc'), isSystem: true },
        { id: 'account_strategist', name: t('agentAccountName'), description: t('agentAccountDesc'), isSystem: true },
    ];

    // ── State ──────────────────────────────────────────────────────────────
    const [view, setView] = useState('grid');          // 'grid' | 'chat'
    const [allAgents, setAllAgents] = useState([]);    // système + custom DB
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterFavorites, setFilterFavorites] = useState(false);
    const [favorites, setFavorites] = useState(() => {
        try { return JSON.parse(localStorage.getItem('aichat_favorites') || '[]'); } catch { return []; }
    });

    // Conversations par agent — { [agentId]: [{ role, text, ts }] }
    const conversations = useAppStore(state => state.aiChatConversations) || {};
    const setConversations = (updater) => {
        const currentState = useAppStore.getState().aiChatConversations || {};
        const nextState = typeof updater === 'function' ? updater(currentState) : updater;
        useAppStore.getState().updateAiChatConversations(selectedAgent?.id || 'temp', nextState[selectedAgent?.id || 'temp']);
    };

    // Historique des sessions — { [agentId]: [{ id, title, messages, ts }] }
    const sessions = useAppStore(state => state.aiChatSessions) || {};
    const setSessions = (updater) => {
        const currentState = useAppStore.getState().aiChatSessions || {};
        const nextState = typeof updater === 'function' ? updater(currentState) : updater;
        useAppStore.getState().updateAiChatSessions(selectedAgent?.id || 'temp', nextState[selectedAgent?.id || 'temp']);
    };
    const [activeSessionId, setActiveSessionId] = useState({});

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSwitchOpen, setIsSwitchOpen] = useState(false);
    const [switchSearch, setSwitchSearch] = useState('');
    const [isRealTime, setIsRealTime] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [attachments, setAttachments] = useState([]);
    const [sessionSearchQuery, setSessionSearchQuery] = useState('');

    const chatEndRef = useRef(null);
    const inputRef = useRef(null);
    const switchRef = useRef(null);
    const chatFileInputRef = useRef(null);

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachments(prev => [...prev, { name: file.name, data: reader.result, mimeType: file.type }]);
            };
            reader.readAsDataURL(file);
        });
        // Clear input to allow uploading the same file again if removed
        if (chatFileInputRef.current) chatFileInputRef.current.value = '';
    };

    // ── Charger les agents custom depuis la DB ────────────────────────────
    useEffect(() => {
        const fetchCustomAgents = async () => {
            try {
                const res = await fetch('http://127.0.0.1:3000/api/agents');
                const data = await res.json();
                const custom = (data.data || []).map(a => ({ ...a, isSystem: false }));
                setAllAgents([...SYSTEM_AGENTS, ...custom]);
            } catch {
                setAllAgents(SYSTEM_AGENTS);
            }
        };
        fetchCustomAgents();
        const interval = setInterval(fetchCustomAgents, 30000); // refresh toutes les 30s
        return () => clearInterval(interval);
    }, [language, t]);

    // ── Auto-scroll ───────────────────────────────────────────────────────
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversations, isLoading]);

    // ── Fermer dropdown switch au clic extérieur ──────────────────────────
    useEffect(() => {
        const handler = (e) => { if (switchRef.current && !switchRef.current.contains(e.target)) setIsSwitchOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Sélectionner un agent ─────────────────────────────────────────────
    const selectAgent = useCallback((agent) => {
        setSelectedAgent(agent);
        setView('chat');
        setIsSwitchOpen(false);
        setSwitchSearch('');
        // Init conversation si vide
        if (!conversations[agent.id]) {
            setConversations(prev => ({
                ...prev,
                [agent.id]: [{ role: 'agent', text: t('welcomeAgent', { name: agent.name, desc: agent.description || '' }), ts: Date.now() }]
            }));
        }
        setTimeout(() => inputRef.current?.focus(), 100);
    }, [conversations, t]);

    // ── Nouvelle conversation ─────────────────────────────────────────────
    const newConversation = () => {
        if (!selectedAgent) return;
        // Archiver la conversation actuelle en session
        const current = conversations[selectedAgent.id] || [];
        if (current.length > 1) {
            const sessionId = `s_${Date.now()}`;
            const title = current.find(m => m.role === 'user')?.text?.slice(0, 50) || t('defaultSessionTitle');
            setSessions(prev => ({
                ...prev,
                [selectedAgent.id]: [
                    { id: sessionId, title, messages: current, ts: Date.now() },
                    ...(prev[selectedAgent.id] || []).slice(0, 19)
                ]
            }));
        }
        setConversations(prev => ({
            ...prev,
            [selectedAgent.id]: [{ role: 'agent', text: t('welcomeAgentShort', { name: selectedAgent.name }), ts: Date.now() }]
        }));
        setActiveSessionId(prev => ({ ...prev, [selectedAgent.id]: null }));
    };

    // ── Charger une session ───────────────────────────────────────────────
    const loadSession = (agentId, session) => {
        setConversations(prev => ({ ...prev, [agentId]: session.messages }));
        setActiveSessionId(prev => ({ ...prev, [agentId]: session.id }));
    };

    // ── Supprimer une session ─────────────────────────────────────────────
    const deleteSession = (e, agentId, sessionId) => {
        e.stopPropagation();
        setSessions(prev => {
            const agentSessions = prev[agentId] || [];
            return {
                ...prev,
                [agentId]: agentSessions.filter(s => s.id !== sessionId)
            };
        });
        if (activeSessionId[agentId] === sessionId) {
            setConversations(prev => ({ ...prev, [agentId]: [] }));
            setActiveSessionId(prev => ({ ...prev, [agentId]: null }));
        }
    };

    // ── Vider tout l'historique de l'agent ────────────────────────────────
    const clearAllSessions = () => {
        if (!selectedAgent || !window.confirm(t('confirmDeleteAllHistory'))) return;
        setSessions(prev => ({ ...prev, [selectedAgent.id]: [] }));
        setConversations(prev => ({ ...prev, [selectedAgent.id]: [] }));
        setActiveSessionId(prev => ({ ...prev, [selectedAgent.id]: null }));
    };

    // ── Copier la conversation entière ────────────────────────────────────
    const copyConversation = () => {
        const msgs = conversations[selectedAgent?.id] || [];
        const text = msgs.map(m => `${m.role === 'agent' ? selectedAgent?.name : t('you')}:\n${m.text}`).join('\n\n');
        navigator.clipboard.writeText(text);
        showAppNotification(t('conversationCopied'), "success");
    };

    // ── Copier un message spécifique ──────────────────────────────────────
    const copyMessage = (text) => {
        navigator.clipboard.writeText(text);
        showAppNotification(t('messageCopied'), "success");
    };

    // ── Favori toggle ─────────────────────────────────────────────────────
    const toggleFavorite = (agentId) => {
        setFavorites(prev => {
            const next = prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId];
            localStorage.setItem('aichat_favorites', JSON.stringify(next));
            return next;
        });
    };

    // ── Envoyer un message ────────────────────────────────────────────────
    const sendMessage = async (e) => {
        e?.preventDefault();
        if ((!input.trim() && attachments.length === 0) || !selectedAgent || isLoading) return;

        const userMsg = { role: 'user', text: input.trim() || t('imageSent'), ts: Date.now(), attachments: [...attachments] };
        const currentHistory = conversations[selectedAgent.id] || [];
        const fullHistory = [...currentHistory, userMsg];

        setConversations(prev => ({ ...prev, [selectedAgent.id]: fullHistory }));
        setInput('');
        
        // format attachments for backend
        const currentAttachments = attachments.map(att => ({
            data: att.data.split(',')[1], // remove data:image/png;base64,
            mimeType: att.mimeType,
            fileName: att.name
        }));
        
        setAttachments([]);
        setIsLoading(true);

        try {
            const bodyData = {
                persona: selectedAgent.id,
                message: userMsg.text,
                messages: fullHistory.map(m => ({ role: m.role, text: m.text })), // clean history for backend
                attachments: currentAttachments,
                promptFormat: selectedAgent.response_format || 'text',
                provider: useAppStore.getState().appSettings?.provider,
                model: useAppStore.getState().appSettings?.model
            };

            if (selectedAgent.id === 'ella') {
                bodyData.currentTasks = useAppStore.getState().tasks || [];
            }

            const res = await fetch('http://127.0.0.1:3000/api/ai/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            const data = await res.json();
            let responseText = data.response || t('aiProcessError');

            try {
                let cleanText = responseText;
                const startIndex = cleanText.indexOf('{');
                const endIndex = cleanText.lastIndexOf('}');
                if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                    cleanText = cleanText.substring(startIndex, endIndex + 1);
                    const parsed = JSON.parse(cleanText);
                    responseText = parsed.text || (parsed.proposed_replies ? parsed.proposed_replies.join('\n\n---\n\n') : responseText);
                }
            } catch (err) {
                const textMatch = responseText.match(/"text"\s*:\s*"([\s\S]*?)(?:"|$)/);
                if (textMatch && textMatch[1]) responseText = textMatch[1].replace(/\\n/g, '\n');
            }

            setConversations(prev => ({
                ...prev,
                [selectedAgent.id]: [...(prev[selectedAgent.id] || []), { role: 'agent', text: responseText, ts: Date.now() }]
            }));
        } catch {
            setConversations(prev => ({
                ...prev,
                [selectedAgent.id]: [...(prev[selectedAgent.id] || []), { role: 'agent', text: t('aiConnectionError'), ts: Date.now() }]
            }));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    // ── Filtres ───────────────────────────────────────────────────────────
    const filteredAgents = allAgents.filter(a => {
        const matchSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (a.description || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchFav = !filterFavorites || favorites.includes(a.id);
        return matchSearch && matchFav;
    });

    const switchFiltered = allAgents.filter(a =>
        a.name.toLowerCase().includes(switchSearch.toLowerCase()) && a.id !== selectedAgent?.id
    );

    const currentMessages = selectedAgent ? (conversations[selectedAgent.id] || []) : [];
    const currentSessions = selectedAgent ? (sessions[selectedAgent.id] || []) : [];
    const filteredSessions = currentSessions.filter(s =>
        s.title.toLowerCase().includes(sessionSearchQuery.toLowerCase())
    );
    const agentColor = selectedAgent ? getAgentColor(selectedAgent.id) : null;

    // ══════════════════════════════════════════════════════════════════════
    // VUE GRILLE — sélection de l'agent
    // ══════════════════════════════════════════════════════════════════════
    if (view === 'grid') return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', minHeight: '100vh' }}>
            <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 14, marginBottom: 20, textDecoration: 'none' }}>
                <ArrowLeft size={14} />
                {t('backToDashboard')}
            </Link>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{t('aiChat')}</h1>

            <div style={{ display: 'flex', gap: 12, marginBottom: 28, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
                    <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={t('searchChat')}
                        style={{ width: '100%', padding: '9px 12px 9px 38px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                    />
                </div>
                <button onClick={() => setFilterFavorites(false)} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: !filterFavorites ? '#0b9f84' : 'transparent', color: !filterFavorites ? '#fff' : '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{t('allChat')}</button>
                <button onClick={() => setFilterFavorites(true)} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: filterFavorites ? '#0b9f84' : 'transparent', color: filterFavorites ? '#fff' : '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                    ★ {t('favorite')}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {filteredAgents.map(agent => {
                    const color = getAgentColor(agent.id);
                    const isFav = favorites.includes(agent.id);
                    return (
                        <div
                            key={agent.id}
                            onClick={() => selectAgent(agent)}
                            style={{ background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', padding: '28px 20px 24px', cursor: 'pointer', position: 'relative', transition: 'all 0.18s', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
                        >
                            <button
                                onClick={ev => { ev.stopPropagation(); toggleFavorite(agent.id); }}
                                style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: isFav ? '#f59e0b' : '#cbd5e1', lineHeight: 1 }}
                                title={isFav ? t('removeFavoriteTitle') : t('addFavoriteTitle')}
                            >{isFav ? '★' : '☆'}</button>

                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: color.bg, color: color.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.5px' }}>
                                {getInitials(agent.name)}
                            </div>

                            <p style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 6, lineHeight: 1.3 }}>{agent.name}</p>
                            <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{agent.description || (agent.isSystem ? t('systemAgent') : t('customAgent'))}</p>

                            <span style={{ marginTop: 14, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: agent.isSystem ? '#f0fdf4' : '#faf5ff', color: agent.isSystem ? '#16a34a' : '#7c3aed' }}>
                                {agent.isSystem ? t('system') : t('customBadge')}
                            </span>
                        </div>
                    );
                })}

                {filteredAgents.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                        <p style={{ fontSize: 40, marginBottom: 12 }}>🤖</p>
                        <p style={{ fontWeight: 600, fontSize: 16 }}>{t('noAgentFound')}</p>
                        <p style={{ fontSize: 13, marginTop: 4 }}>{t('tryAnotherSearchOrAgent')}</p>
                    </div>
                )}
            </div>
        </div>
    );

    // ══════════════════════════════════════════════════════════════════════
    // VUE CHAT
    // ══════════════════════════════════════════════════════════════════════
    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>

            {/* ── Sidebar gauche : sessions ── */}
            {showSidebar && (
                <div style={{ width: 280, background: '#fff', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <div style={{ padding: '20px 16px 12px' }}>
                        <button onClick={() => setView('grid')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#64748b', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: 0 }}>
                            <ArrowLeft size={14} />
                            {t('backToDashboard')}
                        </button>
                        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{t('aiChat')}</h2>
                    </div>

                    <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={14} />
                            <input
                                placeholder={t('searchChat')}
                                value={sessionSearchQuery}
                                onChange={e => setSessionSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                        <button onClick={clearAllSessions} style={{ width: 36, height: 36, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                            <Trash2 size={16} />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
                        {filteredSessions.length === 0 && (
                            <p style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'center', marginTop: 32 }}>{t('noConversationFound')}</p>
                        )}
                        {filteredSessions.map(s => (
                            <div
                                key={s.id}
                                className="group relative"
                                onClick={() => loadSession(selectedAgent.id, s)}
                                style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, background: activeSessionId[selectedAgent?.id] === s.id ? '#f0f9ff' : 'transparent', borderLeft: activeSessionId[selectedAgent?.id] === s.id ? '2px solid #0b9f84' : '2px solid transparent' }}
                                onMouseEnter={e => { if (activeSessionId[selectedAgent?.id] !== s.id) e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={e => { if (activeSessionId[selectedAgent?.id] !== s.id) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    <svg style={{ color: '#94a3b8', marginTop: 2, flexShrink: 0 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                    <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
                                        <p style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', lineHeight: 1.3, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</p>
                                        <p style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(s.ts).toLocaleDateString(language === 'en' ? 'en-US' : language, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => deleteSession(e, selectedAgent.id, s.id)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div style={{ padding: '12px 12px 20px' }}>
                        <button
                            onClick={newConversation}
                            style={{ width: '100%', padding: '11px', background: '#0b9f84', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                            <Plus size={15} strokeWidth={2.5} />
                            {t('newConversation')}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Zone de chat principale ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header chat */}
                <div style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <button onClick={() => setShowSidebar(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                        <Menu size={18} />
                    </button>

                    <div ref={switchRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsSwitchOpen(v => !v)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 10 }}
                        >
                            {agentColor && (
                                <div style={{ width: 34, height: 34, borderRadius: '50%', background: agentColor.bg, color: agentColor.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                    {getInitials(selectedAgent.name)}
                                </div>
                            )}
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
                                    <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', whiteSpace: 'nowrap' }}>{selectedAgent?.name}</span>
                                    <span 
                                        style={{ fontSize: 10, fontWeight: 'bold', padding: '2px 6px', borderRadius: 12, background: '#e0e7ff', color: '#4338ca', textTransform: 'uppercase', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}
                                        title={`${selectedAgent?.provider_override || appSettings.provider || 'gemini'} ${selectedAgent?.model_override ? ` • ${selectedAgent.model_override}` : (appSettings.model ? ` • ${appSettings.model}` : '')}`}
                                    >
                                        {selectedAgent?.provider_override || appSettings.provider || 'gemini'} 
                                        {selectedAgent?.model_override ? ` • ${selectedAgent.model_override}` : (appSettings.model ? ` • ${appSettings.model}` : '')}
                                    </span>
                                    <svg style={{ color: '#94a3b8', transition: 'transform 0.2s', transform: isSwitchOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                                </div>
                                <span style={{ fontSize: 12, color: '#94a3b8', display: 'block', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {selectedAgent?.description}
                                </span>
                            </div>
                        </button>

                        {isSwitchOpen && (
                            <div style={{ position: 'absolute', top: '110%', left: 0, width: 340, background: '#fff', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.12)', border: '1px solid #f1f5f9', zIndex: 100, overflow: 'hidden' }}>
                                <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ position: 'relative' }}>
                                        <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={14} />
                                        <input
                                            autoFocus
                                            value={switchSearch}
                                            onChange={e => setSwitchSearch(e.target.value)}
                                            placeholder={t('searchForChatbots')}
                                            style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1.5px solid #6366f1', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                                    {switchFiltered.map(agent => {
                                        const c = getAgentColor(agent.id);
                                        return (
                                            <div
                                                key={agent.id}
                                                onClick={() => selectAgent(agent)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', transition: 'background 0.1s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ width: 38, height: 38, borderRadius: '50%', background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                                                    {getInitials(agent.name)}
                                                </div>
                                                <div>
                                                    <p style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>{agent.name}</p>
                                                    <p style={{ fontSize: 12, color: '#94a3b8' }}>{agent.description?.slice(0, 45)}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ flex: 1 }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="hidden md:flex items-center gap-8">
                            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{t('realTimeData')}</span>
                            <button
                                onClick={() => setIsRealTime(v => !v)}
                                style={{ width: 42, height: 24, borderRadius: 12, background: isRealTime ? '#0b9f84' : '#e2e8f0', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                            >
                                <div style={{ position: 'absolute', top: 3, left: isRealTime ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                            </button>
                        </div>
                        <button onClick={copyConversation} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px' }} title={t('copyConversation')}>
                            <Copy size={20} />
                        </button>
                        <button
                            onClick={newConversation}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#0b9f84', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                            <Plus size={14} strokeWidth={2.5} />
                            {t('new')}
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {currentMessages.length === 0 && selectedAgent && (
                        <div className="group" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: 10, marginTop: 'auto', marginBottom: 'auto' }}>
                            {agentColor && (
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: agentColor.bg, color: agentColor.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                                    {getInitials(selectedAgent.name)}
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '70%', position: 'relative' }}>
                                <div style={{
                                    padding: '16px 20px',
                                    borderRadius: '18px 18px 18px 4px',
                                    background: '#fff',
                                    color: '#0f172a',
                                    fontSize: 14,
                                    lineHeight: 1.6,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                    border: '1px solid #e2e8f0',
                                }}>
                                    <p style={{ margin: '0 0 8px 0', fontSize: 15 }}>
                                        Bonjour, je suis <strong style={{ color: agentColor?.text || '#0f172a' }}>{selectedAgent.name}</strong>. 👋
                                    </p>
                                    <p style={{ margin: '0 0 12px 0', color: '#475569' }}>
                                        {selectedAgent.description}
                                    </p>
                                    <p style={{ margin: 0, fontWeight: 500, color: '#0b9f84' }}>
                                        Comment puis-je vous aider aujourd'hui ?
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentMessages.map((msg, i) => (
                        <div key={i} className="group" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 10 }}>
                            {msg.role === 'agent' && agentColor && (
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: agentColor.bg, color: agentColor.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                                    {getInitials(selectedAgent.name)}
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '70%', position: 'relative' }}>
                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                        {msg.attachments.map((att, idx) => (
                                            <div key={idx} style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #0b9f84', maxWidth: 200, background: '#f1f5f9' }}>
                                                {att.mimeType.startsWith('image/') ? (
                                                    <img src={att.data} alt="attachment" style={{ width: '100%', display: 'block' }} />
                                                ) : (
                                                    <div style={{ padding: '8px 12px', fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <Paperclip size={14} />
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{att.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{
                                    padding: '12px 16px',
                                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                    background: msg.role === 'user' ? '#0b9f84' : '#fff',
                                    color: msg.role === 'user' ? '#fff' : '#0f172a',
                                    fontSize: 14,
                                    lineHeight: 1.6,
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                    border: msg.role === 'agent' ? '1px solid #f1f5f9' : 'none',
                                    position: 'relative'
                                }}
                                    dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
                                />

                                {msg.role === 'agent' && (
                                    <div style={{ position: 'absolute', top: '50%', right: '-40px', transform: 'translateY(-50%)', opacity: 0, transition: 'opacity 0.2s' }} className="group-hover:opacity-100">
                                        <button
                                            onClick={() => copyMessage(msg.text)}
                                            style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#64748b' }}
                                            title={t('copyToClipboard')}
                                        >
                                            <Copy size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {msg.role === 'user' && (
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #0b9f84 0%, #3b82f6 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                                    <Sparkles size={14} />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Typing indicator */}
                    {isLoading && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                            {agentColor && (
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: agentColor.bg, color: agentColor.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                                    {getInitials(selectedAgent.name)}
                                </div>
                            )}
                            <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '18px 18px 18px 4px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {[0, 150, 300].map(delay => (
                                        <div key={delay} className="animate-bounce" style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8', animationDelay: `${delay}ms` }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input zone */}
                <div style={{ background: '#fff', borderTop: '1px solid #f1f5f9', padding: '16px 24px', flexShrink: 0 }}>
                    {attachments.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                            {attachments.map((att, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f1f5f9', borderRadius: 8, width: 'fit-content' }}>
                                    {att.mimeType.startsWith('image/') ? (
                                        <img src={att.data} alt="preview" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                                    ) : (
                                        <Paperclip size={20} color="#64748b" />
                                    )}
                                    <span style={{ fontSize: 13, color: '#475569', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                                    <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <form onSubmit={sendMessage} style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: '#f8fafc', borderRadius: 14, padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                        {/* Attach */}
                        <input type="file" ref={chatFileInputRef} className="hidden" accept="image/*,application/pdf,audio/*" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                        <button type="button" onClick={() => chatFileInputRef.current?.click()} style={{ background: '#0b9f84', border: 'none', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s' }}>
                            <Paperclip size={16} color="white" />
                        </button>

                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('typeMessage')}
                            rows={1}
                            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: '#0f172a', outline: 'none', resize: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', fontFamily: 'inherit', padding: '4px 0' }}
                        />

                        {/* Format / Mic icons */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                            <button type="button" onClick={() => showAppNotification(t('advancedFormattingSoon'), "success")} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                                <Type size={16} />
                            </button>
                            <button type="button" onClick={() => showAppNotification(t('voiceNotesSoon'), "success")} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                                <Mic size={16} />
                            </button>
                            <button
                                type="submit"
                                disabled={(!input.trim() && !attachedImage) || isLoading}
                                style={{ width: 36, height: 36, borderRadius: 8, background: (input.trim() || attachedImage) && !isLoading ? '#0b9f84' : '#e2e8f0', border: 'none', cursor: (input.trim() || attachedImage) && !isLoading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                            >
                                <Send size={15} color="white" strokeWidth={2.5} />
                            </button>
                        </div>
                    </form>
                    <p style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'center', marginTop: 8 }}>{t('enterToSend')}</p>
                </div>
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 60%, 100% { transform: translateY(0); }
                    30% { transform: translateY(-6px); }
                }
                .animate-bounce {
                    animation: bounce 1.2s infinite;
                }
            `}</style>
        </div>
    );
}
