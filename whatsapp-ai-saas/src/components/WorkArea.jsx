import React, { useState, useEffect } from 'react';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';

import '../styles/global.css';
import { Paperclip, X } from 'lucide-react';

const WorkArea = ({ instances, activeId }) => {
    const [orchestratorStatus, setOrchestratorStatus] = useState('Checking...');
    const [activePlaywrightSessions, setActivePlaywrightSessions] = useState(0);
    const { t } = useTranslation();
    const appSettings = useAppStore(state => state.appSettings) || {};
    const language = appSettings.language || 'en';
    const [copilotProposals, setCopilotProposals] = useState([]);
    const [isCopilotLoading, setIsCopilotLoading] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState([
        { role: 'agent', text: t('copilotWelcomeMsg') }
    ]);
    const [attachments, setAttachments] = useState([]);
    const chatFileInputRef = React.useRef(null);
    const [copilotWidth, setCopilotWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachments(prev => [...prev, { name: file.name, data: reader.result, mimeType: file.type }]);
            };
            reader.readAsDataURL(file);
        });
        if (chatFileInputRef.current) chatFileInputRef.current.value = '';
    };

    // Resizer Logic
    const startResizing = (mouseDownEvent) => {
        mouseDownEvent.preventDefault();
        setIsResizing(true);
        const startWidth = copilotWidth;
        const startX = mouseDownEvent.clientX;

        const onMouseMove = (mouseMoveEvent) => {
            // Dragging left makes width larger, right makes it smaller
            const newWidth = Math.max(250, Math.min(600, startWidth - (mouseMoveEvent.clientX - startX)));
            setCopilotWidth(newWidth);
        };

        const onMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // Zustand Global Actions
    const incrementCopilotReplies = useAppStore(state => state.incrementCopilotReplies);
    const catalogDraft = useAppStore(state => state.catalogDraft);
    const clearCatalogDraft = useAppStore(state => state.clearCatalogDraft);
    const copilotNotification = useAppStore(state => state.copilotNotification);
    const clearCopilotNotification = useAppStore(state => state.clearCopilotNotification);

    // Listen for incoming Catalog Drafts from the Agent Hub
    useEffect(() => {
        if (catalogDraft) {
            // Send a nicely formatted message to Copilot for copy-pasting
            setChatHistory(prev => [
                ...prev,
                {
                    id: Date.now().toString(),
                    role: 'agent',
                    text: t('catalogDraftReadyMsg'),
                    proposals: [
                        `${t('catalogName')} ${catalogDraft.name || ''}`,
                        catalogDraft.price ? `${t('catalogPrice')} ${catalogDraft.price}` : null,
                        catalogDraft.code ? `${t('catalogCode')} ${catalogDraft.code}` : null,
                        `${t('catalogDesc')}${catalogDraft.description || ''}`
                    ].filter(Boolean)
                }
            ]);
            clearCatalogDraft();
        }
    }, [catalogDraft, clearCatalogDraft, t]);

    // Listen for incoming system notifications to display in Copilot
    useEffect(() => {
        if (copilotNotification) {
            setChatHistory(prev => [
                ...prev,
                {
                    id: Date.now().toString(),
                    role: 'agent',
                    text: copilotNotification
                }
            ]);
            clearCopilotNotification();
        }
    }, [copilotNotification, clearCopilotNotification]);

    // Reset proposals when switching tabs
    useEffect(() => {
        setCopilotProposals([]);
        setChatHistory([
            { role: 'agent', text: t('copilotWelcomeMsg') }
        ]);
    }, [activeId, t]);

    const handleCopy = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const getWhatsAppContext = async () => {
        const activeWebview = document.querySelector(`.webview-container.active webview`);
        if (!activeWebview) return null;

        const contextExtractionScript = `
            (async function() {
                try {
                    const result = { contactName: 'Unknown', messages: [], debug: {} };

                    const headerTitle = document.querySelector('[data-testid="conversation-info-header-chat-title"]')
                        || document.querySelector('[data-testid="conversation-header"] span[dir="auto"]')
                        || document.querySelector('header span[dir="auto"]')
                        || document.querySelector('[data-testid="conversation-info-header"] span');
                    if (headerTitle) result.contactName = (headerTitle.getAttribute('title') || headerTitle.textContent || '').trim() || 'Unknown';

                    // WhatsApp renames its atomic CSS classes on every redesign (class.message-in/.message-out,
                    // .selectable-text, .copyable-text are not guaranteed to exist anymore), but the internal
                    // message-store id on each row ("true_"/"false_" prefix = outgoing/incoming) is stable across
                    // UI overhauls, so anchor on that first, then legacy classes, then a generic ARIA-row
                    // fallback (the chat list in this build uses role="row" grid items; the message list is
                    // likely rendered with the same virtualization pattern even if we can't confirm it here).
                    let messageNodes = Array.from(document.querySelectorAll('[data-id]')).filter(el => {
                        const id = el.getAttribute('data-id');
                        return id && (id.startsWith('true_') || id.startsWith('false_'));
                    });
                    result.debug.dataIdCount = messageNodes.length;

                    if (messageNodes.length === 0) {
                        messageNodes = Array.from(document.querySelectorAll('div.message-in, div.message-out'));
                        result.debug.legacyClassCount = messageNodes.length;
                    }

                    if (messageNodes.length === 0) {
                        const mainPanel = document.querySelector('#main') || document.body;
                        messageNodes = Array.from(mainPanel.querySelectorAll('div[role="row"]')).filter(el => !el.closest('#pane-side'));
                        result.debug.ariaRowCount = messageNodes.length;
                    }

                    result.debug.strategyUsed = result.debug.dataIdCount > 0 ? 'data-id'
                        : (result.debug.legacyClassCount > 0 ? 'legacy-class'
                        : (result.debug.ariaRowCount > 0 ? 'aria-row' : 'none'));
                    result.debug.hasMainPanel = !!document.querySelector('#main');
                    result.debug.hasPaneSide = !!document.querySelector('#pane-side');

                    messageNodes = messageNodes.slice(-15);
                    let imageCount = 0;
                    let outCount = 0;

                    // Container used for the last-resort alignment heuristic below: WhatsApp right-aligns
                    // outgoing bubbles and left-aligns incoming ones, regardless of class/testid naming.
                    const alignContainer = document.querySelector('#main') || document.body;
                    const containerRect = alignContainer.getBoundingClientRect();
                    const containerCenter = (containerRect.left + containerRect.right) / 2;

                    for (const node of messageNodes) {
                        const textNode = node.querySelector('.selectable-text, .copyable-text, span[dir="ltr"]');
                        const timeNode = node.querySelector('[data-icon="msg-time"], .copyable-text[data-pre-plain-text], [data-pre-plain-text]');
                        const imgNode = node.querySelector('img[src^="blob:"]');

                        let text = textNode ? textNode.textContent : (node.innerText || '').trim();
                        let mediaData = null;

                        if (imgNode && imageCount < 2) {
                            try {
                                const res = await fetch(imgNode.src);
                                const blob = await res.blob();
                                mediaData = await new Promise((resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => resolve(reader.result);
                                    reader.onerror = reject;
                                    reader.readAsDataURL(blob);
                                });
                                imageCount++;
                            } catch (e) {
                                console.error('Error fetching image blob', e);
                            }
                        }

                        if ((text && text.length > 0) || mediaData) {
                            // The matched node (especially via the aria-row fallback) may not itself carry
                            // the direction signal - it can live on a nested element. Check own node first,
                            // then descendants, and only fall back to a position heuristic if nothing else
                            // is found (getting this wrong flips the whole conversation's speaker labels).
                            let isOut;
                            if (node.classList?.contains('message-out')) {
                                isOut = true;
                            } else if (node.classList?.contains('message-in')) {
                                isOut = false;
                            } else if (node.getAttribute('data-id')) {
                                isOut = node.getAttribute('data-id').startsWith('true_');
                            } else {
                                const nestedIdEl = node.querySelector('[data-id]');
                                const nestedId = nestedIdEl ? nestedIdEl.getAttribute('data-id') : null;
                                if (nestedId) {
                                    isOut = nestedId.startsWith('true_');
                                } else {
                                    const nestedClassEl = node.querySelector('.message-out, .message-in');
                                    if (nestedClassEl) {
                                        isOut = nestedClassEl.classList.contains('message-out');
                                    } else {
                                        try {
                                            const rect = node.getBoundingClientRect();
                                            isOut = ((rect.left + rect.right) / 2) > containerCenter;
                                        } catch (e) {
                                            isOut = false;
                                        }
                                    }
                                }
                            }
                            if (isOut) outCount++;

                            result.messages.push({
                                sender: isOut ? 'You' : result.contactName,
                                text: text || '[Image]',
                                media: mediaData,
                                time: timeNode ? (timeNode.parentElement?.textContent || timeNode.textContent || 'Unknown') : 'Unknown'
                            });
                        }
                    }
                    result.debug.outCount = outCount;
                    result.debug.totalCount = result.messages.length;
                    return result;
                } catch (e) {
                    return { error: e.toString() };
                }
            })();
        `;
        return await activeWebview.executeJavaScript(contextExtractionScript);
    };

    const generateProposals = async () => {
        if (!activeId || orchestratorStatus !== 'Connected') return;

        if (appSettings.allowAiRead === false) {
            alert(t('errorAiReadDisabled'));
            return;
        }

        setIsCopilotLoading(true);
        setCopilotProposals([]);
        try {
            const ctxDataContext = await getWhatsAppContext();

            if (ctxDataContext && !ctxDataContext.error && ctxDataContext.messages && ctxDataContext.messages.length > 0) {
                // 2. Process via Gemini Assistive Copilot
                const geminiRes = await fetch('http://127.0.0.1:3000/api/ai/copilot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instance_id: activeId,
                        chatContext: ctxDataContext,
                        provider: appSettings.provider,
                        model: appSettings.model
                    })
                });
                const geminiData = await geminiRes.json();
                if (geminiData.status === 'success') {
                    setCopilotProposals(geminiData.proposals);
                    incrementCopilotReplies(geminiData.proposals.length || 1);
                    setChatHistory(prev => [
                        ...prev,
                        { role: 'user', text: t('analyzeChat') },
                        { role: 'agent', text: t('copilotAnalyzedMsg'), proposals: geminiData.proposals }
                    ]);
                }
            } else {
                console.warn('[Copilot] Context extraction failed or found no messages. Open the dev tools console for details:', ctxDataContext);
                alert(t('errorExtractContext'));
            }
        } catch (error) {
            console.error('Copilot Error:', error);

            // Check if it's a network error
            if (error.message && error.message.includes('fetch')) {
                alert(`${t('errorOrchestratorConnection')} (${error.message})`);
            } else if (error.name === 'SyntaxError') {
                alert(t('errorOrchestratorInvalidResponse'));
            } else {
                alert(`${t('errorCopilotRun')} ${error.message || error}`);
            }
        }
        setIsCopilotLoading(false);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!chatInput.trim() || isCopilotLoading) return;

        const userMsg = chatInput.trim();
        setChatInput('');

        // Add user message to history
        setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsCopilotLoading(true);

        try {
            let ctxDataContext = null;
            if (appSettings.allowAiRead !== false) {
                ctxDataContext = await getWhatsAppContext();
            }

            // Build conversation history for the agent, plus inject WhatsApp context into the final prompt
            let historyForAgent = chatHistory.filter(msg => !msg.proposals).map(msg => ({
                role: msg.role === 'agent' ? 'model' : 'user',
                text: msg.text
            }));

            let finalMessage = userMsg;
            let finalAttachments = [...attachments];

            if (ctxDataContext && ctxDataContext.messages && ctxDataContext.messages.length > 0) {
                let formattedChat = `[Contexte Whatsapp Actuel: Chat with ${ctxDataContext.contactName}]\n`;
                ctxDataContext.messages.slice(-8).forEach(msg => {
                    formattedChat += `[${msg.time}] ${msg.sender}: ${msg.text}\n`;
                    if (msg.media) {
                        finalAttachments.push({
                            name: 'whatsapp_image.jpg',
                            data: msg.media,
                            mimeType: 'image/jpeg'
                        });
                    }
                });
                finalMessage = `${formattedChat}\n\n[USER]: ${userMsg}`;
            }

            const res = await fetch('http://127.0.0.1:3000/api/ai/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    persona: 'copilot',
                    message: finalMessage,
                    attachments: finalAttachments,
                    messages: historyForAgent,
                    promptFormat: 'text',
                    provider: appSettings.provider,
                    model: appSettings.model
                })
            });

            const data = await res.json();
            if (data.status === 'success') {
                setChatHistory(prev => [...prev, { role: 'agent', text: data.response }]);
                setAttachments([]);
            } else {
                setChatHistory(prev => [...prev, { role: 'agent', text: t('errorAgentCommunication') }]);
            }

        } catch (err) {
            console.error('Chat error:', err);
            setChatHistory(prev => [...prev, { role: 'agent', text: t('errorAgentNetwork') }]);
        } finally {
            setIsCopilotLoading(false);
        }
    };

    useEffect(() => {
        // Poll the orchestrator to see if it sees the WhatsApp instances
        const interval = setInterval(async () => {
            try {
                const res = await fetch('http://127.0.0.1:3000/api/instances');
                const data = await res.json();
                if (data.status === 'success') {
                    setOrchestratorStatus('Connected');
                    setActivePlaywrightSessions(data.active_instances || 0);
                } else {
                    setOrchestratorStatus('Error');
                }
            } catch {
                setOrchestratorStatus('Disconnected');
                setActivePlaywrightSessions(0);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    if (instances.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 bg-surface">
                <div className="text-center max-w-md">
                    <h2 className="text-2xl font-bold text-text-main mb-2">{t('welcomeWhatsAi')}</h2>
                    <p className="text-text-muted">{t('clickNewInstance')}</p>
                </div>
            </div>
        );
    }

    const activeInstance = instances.find(inst => inst.id === activeId);

    // Fallback if trying to render when no valid instance selected
    if (!activeInstance && instances.length > 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 bg-surface">
                <div className="text-center max-w-md">
                    <h2 className="text-2xl font-bold text-text-main mb-2">{t('selectAccount')}</h2>
                    <p className="text-text-muted">{t('chooseAccount')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-hidden scrollbar-hide p-6 space-y-6 bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] flex relative h-full">

            {/* Left Side: Main WhatsApp Web View */}
            <div className="flex-1 flex flex-col h-full bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden relative mr-4">

                <div className="flex-1 relative flex flex-col bg-white">
                    {/* This loops and hides all inactive webviews, keeping their state persistent */}
                    {instances.map(instance => (
                        <div
                            key={instance.id}
                            className={`webview-container absolute inset-0 flex ${instance.id === activeId ? 'active z-10 opacity-100' : 'opacity-0 -z-10 pointer-events-none'}`}
                        >
                            <webview
                                src="https://web.whatsapp.com"
                                partition={`persist:${instance.id}`}
                                allowpopups="true"
                                useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                                className="w-full h-full flex-1"
                                ref={(el) => {
                                    if (el && !el.hasAttribute('data-setup-injected')) {
                                        el.addEventListener('dom-ready', () => {
                                            el.insertCSS('::-webkit-scrollbar { display: none !important; } * { scrollbar-width: none !important; }');
                                            // Inject instance ID into the global window object so Playwright can find the right context
                                            el.executeJavaScript(`window.__whatsapp_instance_id = '${instance.id}';`);
                                        });
                                        el.setAttribute('data-setup-injected', 'true');
                                    }
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Resizer Handler */}
            <div
                className={`w-2 cursor-col-resize shrink-0 transition-colors flex items-center justify-center z-20 group -ml-2 ${isResizing ? 'bg-primary/30' : 'hover:bg-primary/20'}`}
                onMouseDown={startResizing}
                title={t('dragToResizePanel')}
            >
                <div className={`w-1 h-8 rounded-full transition-colors ${isResizing ? 'bg-primary' : 'bg-gray-300 group-hover:bg-primary'}`} />
            </div>

            {/* Invisible overlay to block iframe mouse events while dragging */}
            {isResizing && <div className="fixed inset-0 z-50 cursor-col-resize select-none" />}

            {/* Right Side: Session Info & AI Agent Status (Old Design Restored) */}
            <aside className="shrink-0 flex flex-col gap-4 h-full" style={{ width: `${copilotWidth}px` }}>

                <div className="card shrink-0">
                    <div className="card-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b9f84" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
                        <h3>{t('instanceStatus')}</h3>
                    </div>
                    <div className="card-body">
                        {orchestratorStatus === 'Connected' ? (
                            <div style={{ background: '#eef2ff', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)' }}></span>
                                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#1e1b4b' }}>{t('waActive')}</h4>
                                </div>
                                <p style={{ margin: 0, fontSize: '11px', color: '#4f46e5', paddingLeft: '16px', lineHeight: 1.4 }}>
                                    {t('instanceConnected')?.replace('{name}', activeInstance?.name || '1')}
                                </p>
                            </div>
                        ) : (
                            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>{t('offline')}</h4>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1' }}></span>
                                </div>
                                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>
                                    {t('startOrchestrator')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card flex-1 flex flex-col min-h-0">
                    <div className="card-header shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b9f84" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"></path></svg>
                        <h3>WhatCopilote</h3>
                    </div>
                    <div className="card-body flex-1 flex flex-col min-h-0" style={{ padding: '12px 16px' }}>

                        <div className="shrink-0" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
                            <button
                                className="btn-primary"
                                style={{ flex: 1, padding: '10px' }}
                                onClick={generateProposals}
                                disabled={isCopilotLoading || orchestratorStatus !== 'Connected'}
                            >
                                {isCopilotLoading ? (
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        <span className="pulse" style={{ position: 'relative', width: 8, height: 8 }}></span> {t('analyzing')}
                                    </span>
                                ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"></path></svg>
                                        {t('analyzeChat')}
                                    </span>
                                )}
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '16px', paddingRight: '6px' }} className="scrollbar-hide">
                            {chatHistory.map((msg, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                    <div style={{
                                        maxWidth: '85%',
                                        padding: '10px 14px',
                                        borderRadius: '12px',
                                        fontSize: '13px',
                                        background: msg.role === 'user' ? '#10b981' : '#f1f5f9',
                                        color: msg.role === 'user' ? '#fff' : '#1e293b',
                                        borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                                        borderBottomLeftRadius: msg.role === 'agent' ? '2px' : '12px',
                                        lineHeight: 1.5,
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {msg.text}
                                    </div>

                                    {msg.proposals && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', width: '100%' }}>
                                            {msg.proposals.map((reply, j) => {
                                                const id = `${i}-${j}`;
                                                return (
                                                    <div
                                                        key={j}
                                                        onClick={() => handleCopy(reply, id)}
                                                        style={{
                                                            padding: '10px 12px',
                                                            background: copiedIndex === id ? '#ecfdf5' : '#ffffff',
                                                            borderRadius: 8,
                                                            fontSize: 12,
                                                            color: '#334155',
                                                            border: copiedIndex === id ? '1px solid #10b981' : '1px solid #e2e8f0',
                                                            cursor: 'pointer',
                                                            position: 'relative',
                                                            transition: 'all 0.2s',
                                                            paddingRight: '30px',
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                                            lineHeight: 1.4
                                                        }}
                                                        title={t('clickToCopy')}
                                                    >
                                                        {reply}
                                                        <div style={{ position: 'absolute', right: '8px', top: '10px', color: copiedIndex === id ? '#10b981' : '#94a3b8' }}>
                                                            {copiedIndex === id ? (
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                            ) : (
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {isCopilotLoading && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <div style={{
                                        maxWidth: '85%',
                                        padding: '14px 18px',
                                        borderRadius: '12px',
                                        background: '#f1f5f9',
                                        borderBottomLeftRadius: '2px',
                                        display: 'flex',
                                        gap: '6px',
                                        alignItems: 'center'
                                    }}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Attachments Preview */}
                        {attachments.length > 0 && (
                            <div style={{ padding: '8px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                {attachments.map((att, idx) => (
                                    <div key={idx} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, background: 'white', padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                        {att.mimeType?.startsWith('image/') ? (
                                            <img src={att.data} alt="preview" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} />
                                        ) : (
                                            <div style={{ width: 24, height: 24, background: '#f1f5f9', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Paperclip size={12} color="#64748b" />
                                            </div>
                                        )}
                                        <span style={{ fontSize: 12, color: '#475569', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                                        <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <form onSubmit={handleSendMessage} className="shrink-0" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: '#fff', padding: '12px', borderTop: '1px solid #e2e8f0' }}>
                            {/* Attach */}
                            <input type="file" ref={chatFileInputRef} className="hidden" accept="image/*,application/pdf,audio/*" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                            <button type="button" onClick={() => chatFileInputRef.current?.click()} disabled={isCopilotLoading} style={{ background: '#0b9f84', border: 'none', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isCopilotLoading ? 'default' : 'pointer', flexShrink: 0, transition: 'background 0.15s', opacity: isCopilotLoading ? 0.6 : 1 }}>
                                <Paperclip size={16} color="white" />
                            </button>
                            <textarea
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(e);
                                    }
                                }}
                                placeholder={t('askCopilot')}
                                rows={1}
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '13px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    resize: 'none',
                                    maxHeight: '100px',
                                    fontFamily: 'inherit'
                                }}
                            />
                            <button
                                type="submit"
                                disabled={(!chatInput.trim() && attachments.length === 0) || isCopilotLoading}
                                style={{
                                    background: (chatInput.trim() || attachments.length > 0) && !isCopilotLoading ? '#10b981' : '#e2e8f0',
                                    color: (chatInput.trim() || attachments.length > 0) && !isCopilotLoading ? '#fff' : '#94a3b8',
                                    border: 'none',
                                    borderRadius: '8px',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: (chatInput.trim() || attachments.length > 0) && !isCopilotLoading ? 'pointer' : 'default',
                                    transition: 'background 0.2s',
                                    flexShrink: 0
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            </button>
                        </form>
                    </div>
                </div>

            </aside>
        </div>
    );
};

export default WorkArea;
