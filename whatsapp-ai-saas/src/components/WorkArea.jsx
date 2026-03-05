import React, { useState, useEffect } from 'react';
import useAppStore from '../store';
import { getTranslation as t } from '../locales';
import '../styles/global.css';

const WorkArea = ({ instances, activeId }) => {
    const [orchestratorStatus, setOrchestratorStatus] = useState('Checking...');
    const [activePlaywrightSessions, setActivePlaywrightSessions] = useState(0);
    const appSettings = useAppStore(state => state.appSettings) || {};
    const language = appSettings.language || 'en';
    const [copilotProposals, setCopilotProposals] = useState([]);
    const [isCopilotLoading, setIsCopilotLoading] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState([
        { role: 'agent', text: 'Hello! I am WhatCopilote. Click "Analyze Current Chat" to generate replies, or type a custom request below.' }
    ]);

    // Zustand Global Actions
    const incrementCopilotReplies = useAppStore(state => state.incrementCopilotReplies);

    // Reset proposals when switching tabs
    useEffect(() => {
        setCopilotProposals([]);
        setChatHistory([
            { role: 'agent', text: 'Hello! I am WhatCopilote. Click "Analyze Current Chat" to generate replies, or type a custom request below.' }
        ]);
    }, [activeId]);

    const handleCopy = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const generateProposals = async () => {
        if (!activeId || orchestratorStatus !== 'Connected') return;

        if (appSettings.allowAiRead === false) {
            alert("AI Context Reading is disabled in Settings. Enable it to analyze chats.");
            return;
        }

        setIsCopilotLoading(true);
        setCopilotProposals([]);
        try {
            // 1. Get readable Context safely using Electron's native Webview API rather than CDP
            const activeWebview = document.querySelector(`.webview-container.active webview`);
            if (!activeWebview) throw new Error('Webview element not found in DOM.');

            const contextExtractionScript = `
                (function() {
                    try {
                        const result = { contactName: 'Unknown', messages: [] };
                        
                        // Extract Contact Name safely
                        const headerTitle = document.querySelector('header span[dir="auto"]') || document.querySelector('[data-testid="conversation-info-header"] span');
                        if (headerTitle) result.contactName = headerTitle.textContent || 'Unknown';

                        // Extract Messages (Fallback for newer WhatsApp Layouts)
                        let messageNodes = Array.from(document.querySelectorAll('div.message-in, div.message-out'));
                        if (messageNodes.length === 0) {
                            messageNodes = Array.from(document.querySelectorAll('[data-id]')).filter(el => {
                                const id = el.getAttribute('data-id');
                                return id && (id.includes('true_') || id.includes('false_'));
                            });
                        }
                        
                        messageNodes = messageNodes.slice(-15);

                        messageNodes.forEach(node => {
                            const textNode = node.querySelector('.selectable-text, .copyable-text');
                            const timeNode = node.querySelector('[data-icon="msg-time"], .copyable-text[data-pre-plain-text]');
                            
                            let text = textNode ? textNode.textContent : (node.innerText || '').trim();

                            if (text && text.length > 0) {
                                const isOut = node.classList?.contains('message-out') || (node.getAttribute('data-id') && node.getAttribute('data-id').includes('true_'));
                                result.messages.push({
                                    sender: isOut ? 'You' : result.contactName,
                                    text: text,
                                    time: timeNode ? (timeNode.parentElement?.textContent || timeNode.textContent || 'Unknown') : 'Unknown'
                                });
                            }
                        });
                        return result;
                    } catch (e) {
                        return { error: e.toString() };
                    }
                })();
            `;

            const ctxDataContext = await activeWebview.executeJavaScript(contextExtractionScript);

            if (ctxDataContext && !ctxDataContext.error && ctxDataContext.messages && ctxDataContext.messages.length > 0) {
                // 2. Process via Gemini Assistive Copilot
                const geminiRes = await fetch('http://localhost:3000/api/gemini/copilot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instance_id: activeId,
                        chatContext: ctxDataContext,
                        model: appSettings.model || 'gemini-1.5-pro'
                    })
                });
                const geminiData = await geminiRes.json();
                if (geminiData.status === 'success') {
                    setCopilotProposals(geminiData.proposals);
                    incrementCopilotReplies(geminiData.proposals.length || 1);
                    setChatHistory(prev => [
                        ...prev,
                        { role: 'user', text: 'Analyze Current Chat' },
                        { role: 'agent', text: 'I analyzed the active WhatsApp conversation. Here are some suggested replies:', proposals: geminiData.proposals }
                    ]);
                }
            } else {
                alert('Could not extract context. Please make sure a chat is open with visible messages.');
            }
        } catch (error) {
            console.error('Copilot Error:', error);

            // Check if it's a network error
            if (error.message && error.message.includes('fetch')) {
                alert(`Error: Could not connect to the Backend Orchestrator. Is it running? (${error.message})`);
            } else if (error.name === 'SyntaxError') {
                alert(`Error: The Backend Orchestrator returned an invalid response. Check the backend logs.`);
            } else {
                alert(`Error running Assistive Copilot: ${error.message || error}`);
            }
        }
        setIsCopilotLoading(false);
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        setChatHistory(prev => [...prev, { role: 'user', text: chatInput }]);
        const userMsg = chatInput;
        setChatInput('');
        setIsCopilotLoading(true);

        setTimeout(() => {
            setChatHistory(prev => [...prev, { role: 'agent', text: `You asked: "${userMsg}". Since I'm essentially reading the DOM, I can provide conversational help based on context soon.` }]);
            setIsCopilotLoading(false);
        }, 1000);
    };

    useEffect(() => {
        // Poll the orchestrator to see if it sees the WhatsApp instances
        const interval = setInterval(async () => {
            try {
                const res = await fetch('http://localhost:3000/api/instances');
                const data = await res.json();
                if (data.status === 'success') {
                    setOrchestratorStatus('Connected');
                    setActivePlaywrightSessions(data.active_instances || 0);
                } else {
                    setOrchestratorStatus('Error');
                }
            } catch (e) {
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
                    <h2 className="text-2xl font-bold text-text-main mb-2">{t(language, 'welcomeWhatsAi')}</h2>
                    <p className="text-text-muted">{t(language, 'clickNewInstance')}</p>
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
                    <h2 className="text-2xl font-bold text-text-main mb-2">{t(language, 'selectAccount')}</h2>
                    <p className="text-text-muted">{t(language, 'chooseAccount')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] flex relative h-full">

            {/* Left Side: Main WhatsApp Web View */}
            <div className="flex-1 flex flex-col h-full bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden relative mr-4">

                <div className="flex-1 relative flex flex-col bg-white">
                    {/* This loops and hides all inactive webviews, keeping their state persistent */}
                    {instances.map(instance => (
                        <div
                            key={instance.id}
                            className={`webview-container absolute inset-0 ${instance.id === activeId ? 'active z-10' : 'opacity-0 z-0 pointer-events-none'}`}
                            style={{ display: instance.id === activeId ? 'flex' : 'none' }}
                        >
                            <webview
                                src="https://web.whatsapp.com"
                                partition={`persist:${instance.id}`}
                                allowpopups="true"
                                useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                                className="w-full h-full flex-1"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Side: Session Info & AI Agent Status (Old Design Restored) */}
            <aside className="w-[320px] shrink-0 flex flex-col gap-4 h-full">

                <div className="card shrink-0">
                    <div className="card-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b9f84" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
                        <h3>{t(language, 'instanceStatus')}</h3>
                    </div>
                    <div className="card-body">
                        {orchestratorStatus === 'Connected' ? (
                            <div style={{ background: '#eef2ff', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)' }}></span>
                                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#1e1b4b' }}>{t(language, 'waActive')}</h4>
                                </div>
                                <p style={{ margin: 0, fontSize: '11px', color: '#4f46e5', paddingLeft: '16px', lineHeight: 1.4 }}>
                                    {t(language, 'instanceConnected').replace('{name}', activeInstance?.name || '1')}
                                </p>
                            </div>
                        ) : (
                            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>{t(language, 'offline')}</h4>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1' }}></span>
                                </div>
                                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>
                                    {t(language, 'startOrchestrator')}
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
                                        <span className="pulse" style={{ position: 'relative', width: 8, height: 8 }}></span> {t(language, 'analyzing')}
                                    </span>
                                ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"></path></svg>
                                        {t(language, 'analyzeChat')}
                                    </span>
                                )}
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '16px', paddingRight: '6px' }} className="sidebar-scroll">
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
                                        lineHeight: 1.5
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
                                                        title="Click to copy"
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
                        </div>

                        <form onSubmit={handleSendMessage} className="shrink-0" style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #e2e8f0', position: 'relative' }}>
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder={t(language, 'askCopilot')}
                                style={{
                                    width: '100%',
                                    padding: '10px 40px 10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '13px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                            />
                            <button
                                type="submit"
                                disabled={!chatInput.trim() || isCopilotLoading}
                                style={{
                                    position: 'absolute',
                                    right: '6px',
                                    top: '16px',
                                    background: chatInput.trim() ? '#10b981' : '#e2e8f0',
                                    color: chatInput.trim() ? '#fff' : '#94a3b8',
                                    border: 'none',
                                    borderRadius: '6px',
                                    width: '28px',
                                    height: '28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: chatInput.trim() ? 'pointer' : 'default',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            </button>
                        </form>
                    </div>
                </div>

            </aside>
        </div>
    );
};

export default WorkArea;
