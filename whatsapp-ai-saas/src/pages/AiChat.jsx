import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../store';

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

// ─── Agents système (personas fichiers .js) ───────────────────────────────
const SYSTEM_AGENTS = [
    { id: 'copywriter', name: 'Jarvis - SDR Senior', description: 'Expert en Copywriting de Vente et Social Selling.', isSystem: true },
    { id: 'legal', name: 'Legal & Admin', description: 'Rédaction de contrats, factures et assistance légale.', isSystem: true },
    { id: 'creative', name: 'Creative Visual', description: 'Agent spécialisé en photographie produit IA.', isSystem: true },
    { id: 'ella', name: 'Ella - Life Architect', description: 'Assistante personnelle, gestion du temps et productivité.', isSystem: true },
    { id: 'copilot', name: 'WhatCopilote', description: 'Copilot WhatsApp Business, propose des réponses.', isSystem: true },
];

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
    const showAppNotification = useAppStore(state => state.showAppNotification);
    const language = useAppStore(state => state.appSettings?.language) || 'en';

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
        const nextState = typeof updater === 'function' ? updater(conversations) : updater;
        useAppStore.getState().updateAiChatConversations(selectedAgent?.id || 'temp', nextState[selectedAgent?.id || 'temp']);
        // The above is slightly hacky because updater expects the full object, let's fix it below
    };

    // Historique des sessions — { [agentId]: [{ id, title, messages, ts }] }
    const sessions = useAppStore(state => state.aiChatSessions) || {};
    const setSessions = (updater) => {
        const nextState = typeof updater === 'function' ? updater(sessions) : updater;
        useAppStore.getState().updateAiChatSessions(selectedAgent?.id || 'temp', nextState[selectedAgent?.id || 'temp']);
    };
    const [activeSessionId, setActiveSessionId] = useState({});

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSwitchOpen, setIsSwitchOpen] = useState(false);
    const [switchSearch, setSwitchSearch] = useState('');
    const [isRealTime, setIsRealTime] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);

    const chatEndRef = useRef(null);
    const inputRef = useRef(null);
    const switchRef = useRef(null);

    // ── Charger les agents custom depuis la DB ────────────────────────────
    useEffect(() => {
        const fetchCustomAgents = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/agents');
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
    }, []);

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
                [agent.id]: [{ role: 'agent', text: `Bonjour ! Je suis **${agent.name}**. ${agent.description || ''}\n\nComment puis-je vous aider ?`, ts: Date.now() }]
            }));
        }
        setTimeout(() => inputRef.current?.focus(), 100);
    }, [conversations]);

    // ── Nouvelle conversation ─────────────────────────────────────────────
    const newConversation = () => {
        if (!selectedAgent) return;
        // Archiver la conversation actuelle en session
        const current = conversations[selectedAgent.id] || [];
        if (current.length > 1) {
            const sessionId = `s_${Date.now()}`;
            const title = current.find(m => m.role === 'user')?.text?.slice(0, 50) || 'Conversation';
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
            [selectedAgent.id]: [{ role: 'agent', text: `Bonjour ! Je suis **${selectedAgent.name}**. Comment puis-je vous aider ?`, ts: Date.now() }]
        }));
        setActiveSessionId(prev => ({ ...prev, [selectedAgent.id]: null }));
    };

    // ── Charger une session ───────────────────────────────────────────────
    const loadSession = (agentId, session) => {
        setConversations(prev => ({ ...prev, [agentId]: session.messages }));
        setActiveSessionId(prev => ({ ...prev, [agentId]: session.id }));
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
        if (!input.trim() || !selectedAgent || isLoading) return;

        const userMsg = { role: 'user', text: input.trim(), ts: Date.now() };
        const currentHistory = conversations[selectedAgent.id] || [];
        const fullHistory = [...currentHistory, userMsg];

        setConversations(prev => ({ ...prev, [selectedAgent.id]: fullHistory }));
        setInput('');
        setIsLoading(true);

        try {
            const bodyData = {
                persona: selectedAgent.id,
                message: userMsg.text,
                messages: fullHistory,
                promptFormat: selectedAgent.response_format || 'text'
            };

            // Inject tasks specifically for Ella
            if (selectedAgent.id === 'ella') {
                bodyData.currentTasks = useAppStore.getState().tasks || [];
            }

            const res = await fetch('http://localhost:3000/api/ai/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            const data = await res.json();
            let responseText = data.response || "Je n'ai pas pu traiter votre demande.";

            // Si JSON, essayer d'extraire le texte lisible
            try {
                const parsed = JSON.parse(responseText);
                if (parsed.text) responseText = parsed.text;
                else if (parsed.proposed_replies) responseText = parsed.proposed_replies.join('\n\n---\n\n');
                else responseText = JSON.stringify(parsed, null, 2);
            } catch { /* pas du JSON, garder tel quel */ }

            setConversations(prev => ({
                ...prev,
                [selectedAgent.id]: [...(prev[selectedAgent.id] || []), { role: 'agent', text: responseText, ts: Date.now() }]
            }));
        } catch {
            setConversations(prev => ({
                ...prev,
                [selectedAgent.id]: [...(prev[selectedAgent.id] || []), { role: 'agent', text: "Erreur de connexion au serveur IA.", ts: Date.now() }]
            }));
        } finally {
            setIsLoading(false);
        }
    };

    // ── Shift+Enter = saut de ligne, Enter = envoyer ──────────────────────
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
    const agentColor = selectedAgent ? getAgentColor(selectedAgent.id) : null;

    // ══════════════════════════════════════════════════════════════════════
    // VUE GRILLE — sélection de l'agent
    // ══════════════════════════════════════════════════════════════════════
    if (view === 'grid') return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', minHeight: '100vh' }}>
            {/* Header */}
            <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 14, marginBottom: 20, textDecoration: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                Back to dashboard
            </Link>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>AI Chat</h1>

            {/* Search + Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
                    <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search"
                        style={{ width: '100%', padding: '9px 12px 9px 38px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                    />
                </div>
                <button onClick={() => setFilterFavorites(false)} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: !filterFavorites ? '#0f172a' : 'transparent', color: !filterFavorites ? '#fff' : '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>All</button>
                <button onClick={() => setFilterFavorites(true)} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: filterFavorites ? '#0f172a' : 'transparent', color: filterFavorites ? '#fff' : '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                    ★ Favorite
                </button>
            </div>

            {/* Grid */}
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
                            {/* Favori */}
                            <button
                                onClick={ev => { ev.stopPropagation(); toggleFavorite(agent.id); }}
                                style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: isFav ? '#f59e0b' : '#cbd5e1', lineHeight: 1 }}
                                title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                            >{isFav ? '★' : '☆'}</button>

                            {/* Avatar */}
                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: color.bg, color: color.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.5px' }}>
                                {getInitials(agent.name)}
                            </div>

                            <p style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 6, lineHeight: 1.3 }}>{agent.name}</p>
                            <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{agent.description || (agent.isSystem ? 'System Agent' : 'Custom Agent')}</p>

                            {/* Badge */}
                            <span style={{ marginTop: 14, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: agent.isSystem ? '#f0fdf4' : '#faf5ff', color: agent.isSystem ? '#16a34a' : '#7c3aed' }}>
                                {agent.isSystem ? 'Système' : 'Custom'}
                            </span>
                        </div>
                    );
                })}

                {filteredAgents.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                        <p style={{ fontSize: 40, marginBottom: 12 }}>🤖</p>
                        <p style={{ fontWeight: 600, fontSize: 16 }}>Aucun agent trouvé</p>
                        <p style={{ fontSize: 13, marginTop: 4 }}>Essayez une autre recherche ou créez un agent dans Agents Manager.</p>
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
                    {/* Header sidebar */}
                    <div style={{ padding: '20px 16px 12px' }}>
                        <button onClick={() => setView('grid')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#64748b', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                            Back to dashboard
                        </button>
                        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>AI Chat</h2>
                    </div>

                    {/* Search sessions */}
                    <div style={{ padding: '0 12px 12px' }}>
                        <div style={{ position: 'relative' }}>
                            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                            <input placeholder="Search" style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    {/* Trash / sessions */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
                        {currentSessions.length === 0 && (
                            <p style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'center', marginTop: 32 }}>Aucune conversation sauvegardée</p>
                        )}
                        {currentSessions.map(s => (
                            <div
                                key={s.id}
                                onClick={() => loadSession(selectedAgent.id, s)}
                                style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, background: activeSessionId[selectedAgent?.id] === s.id ? '#f0f9ff' : 'transparent', borderLeft: activeSessionId[selectedAgent?.id] === s.id ? '2px solid #0b9f84' : '2px solid transparent' }}
                                onMouseEnter={e => { if (activeSessionId[selectedAgent?.id] !== s.id) e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={e => { if (activeSessionId[selectedAgent?.id] !== s.id) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    <svg style={{ color: '#94a3b8', marginTop: 2, flexShrink: 0 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                    <div>
                                        <p style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', lineHeight: 1.3, marginBottom: 2 }}>{s.title}</p>
                                        <p style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(s.ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* New Conversation */}
                    <div style={{ padding: '12px 12px 20px' }}>
                        <button
                            onClick={newConversation}
                            style={{ width: '100%', padding: '11px', background: '#0b9f84', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            New Conversation
                        </button>
                    </div>
                </div>
            )}

            {/* ── Zone de chat principale ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header chat */}
                <div style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {/* Toggle sidebar */}
                    <button onClick={() => setShowSidebar(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                    </button>

                    {/* Agent switcher */}
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{selectedAgent?.name}</span>
                                    <svg style={{ color: '#94a3b8' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points={isSwitchOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} /></svg>
                                </div>
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>{selectedAgent?.description?.slice(0, 40)}{selectedAgent?.description?.length > 40 ? '…' : ''}</span>
                            </div>
                        </button>

                        {/* Dropdown switch */}
                        {isSwitchOpen && (
                            <div style={{ position: 'absolute', top: '110%', left: 0, width: 340, background: '#fff', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.12)', border: '1px solid #f1f5f9', zIndex: 100, overflow: 'hidden' }}>
                                <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ position: 'relative' }}>
                                        <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                                        <input
                                            autoFocus
                                            value={switchSearch}
                                            onChange={e => setSwitchSearch(e.target.value)}
                                            placeholder="Search for chatbots"
                                            style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1.5px solid #6366f1', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                                        />
                                        <button onClick={() => setSwitchSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /></svg>
                                        </button>
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
                                    {switchFiltered.length === 0 && (
                                        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px', fontSize: 13 }}>Aucun agent trouvé</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ flex: 1 }} />

                    {/* Real-Time toggle + New */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, color: '#64748b' }}>Real-Time Data</span>
                            <button
                                onClick={() => setIsRealTime(v => !v)}
                                style={{ width: 42, height: 24, borderRadius: 12, background: isRealTime ? '#0b9f84' : '#e2e8f0', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                            >
                                <div style={{ position: 'absolute', top: 3, left: isRealTime ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                            </button>
                        </div>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                        </button>
                        <button
                            onClick={newConversation}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            New
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {currentMessages.map((msg, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 10 }}>
                            {msg.role === 'agent' && agentColor && (
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: agentColor.bg, color: agentColor.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                                    {getInitials(selectedAgent.name)}
                                </div>
                            )}
                            <div style={{
                                maxWidth: '70%',
                                padding: '12px 16px',
                                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                background: msg.role === 'user' ? '#4f46e5' : '#fff',
                                color: msg.role === 'user' ? '#fff' : '#0f172a',
                                fontSize: 14,
                                lineHeight: 1.6,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                border: msg.role === 'agent' ? '1px solid #f1f5f9' : 'none',
                            }}
                                dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
                            />
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
                                        <div key={delay} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8', animation: 'bounce 1.2s infinite', animationDelay: `${delay}ms` }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input zone */}
                <div style={{ background: '#fff', borderTop: '1px solid #f1f5f9', padding: '16px 24px', flexShrink: 0 }}>
                    <form onSubmit={sendMessage} style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: '#f8fafc', borderRadius: 14, padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                        {/* Attach */}
                        <button type="button" style={{ background: '#0b9f84', border: 'none', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                        </button>

                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message"
                            rows={1}
                            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: '#0f172a', outline: 'none', resize: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', fontFamily: 'inherit', padding: '4px 0' }}
                        />

                        {/* Format / Mic icons */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                            <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h8M4 18h16" /></svg>
                            </button>
                            <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
                            </button>
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                style={{ width: 36, height: 36, borderRadius: 8, background: input.trim() && !isLoading ? '#4f46e5' : '#e2e8f0', border: 'none', cursor: input.trim() && !isLoading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                            </button>
                        </div>
                    </form>
                    <p style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'center', marginTop: 8 }}>Enter pour envoyer · Shift+Enter pour saut de ligne</p>
                </div>
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 60%, 100% { transform: translateY(0); }
                    30% { transform: translateY(-6px); }
                }
            `}</style>
        </div>
    );
}