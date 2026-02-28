import React, { useState, useEffect } from 'react';
import useAppStore from '../store';
import '../styles/global.css';

const WorkArea = ({ instances, activeId }) => {
    const [orchestratorStatus, setOrchestratorStatus] = useState('Checking...');
    const [activePlaywrightSessions, setActivePlaywrightSessions] = useState(0);
    const [copilotProposals, setCopilotProposals] = useState([]);
    const [isCopilotLoading, setIsCopilotLoading] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);

    // Zustand Global Actions
    const incrementCopilotReplies = useAppStore(state => state.incrementCopilotReplies);

    // Reset proposals when switching tabs
    useEffect(() => {
        setCopilotProposals([]);
    }, [activeId]);

    const handleCopy = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const generateProposals = async () => {
        if (!activeId || orchestratorStatus !== 'Connected') return;
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
                        chatContext: ctxDataContext
                    })
                });
                const geminiData = await geminiRes.json();
                if (geminiData.status === 'success') {
                    setCopilotProposals(geminiData.proposals);
                    incrementCopilotReplies(geminiData.proposals.length || 1);
                }
            } else {
                alert('Could not extract context. Please make sure a chat is open with visible messages.');
            }
        } catch (error) {
            console.error('Copilot Error:', error);
            alert('Failed to extract context. Ensure WhatsApp is fully loaded.');
        }
        setIsCopilotLoading(false);
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
                    <h2 className="text-2xl font-bold text-text-main mb-2">Welcome to WhatsAI</h2>
                    <p className="text-text-muted">Click "New Instance" in the sidebar to create an isolated WhatsApp Web Sandbox.</p>
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
                    <h2 className="text-2xl font-bold text-text-main mb-2">Select an Account</h2>
                    <p className="text-text-muted">Choose an account from the sidebar or link a new device to continue.</p>
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
            <aside className="side-panel w-[320px] shrink-0">

                <div className="card">
                    <div className="card-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b9f84" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
                        <h3>Instance status</h3>
                    </div>
                    <div className="card-body">
                        {orchestratorStatus === 'Connected' && (
                            <div style={{ background: '#eef2ff', borderRadius: '8px', padding: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '6px 10px', borderRadius: '8px', display: 'flex', flexShrink: 0, justifyContent: 'center', alignItems: 'center' }}>
                                    <span style={{ fontSize: '18px', fontWeight: 500, fontFamily: 'monospace' }}>qr_code_2</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap' }}>
                                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#1e1b4b', width: '100%' }}>WhatsApp Connection Active</h4>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#4f46e5', lineHeight: 1.5, letterSpacing: '0.1px', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                        Instance {activeInstance?.name || '1'} is connected and syncing messages in real-time.
                                    </p>
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <span className="info-text">Orchestrator Link</span>
                            <span className={`badge ${orchestratorStatus === 'Connected' ? 'active' : 'disabled'}`}>
                                {orchestratorStatus}
                            </span>
                        </div>
                        <p className="info-text" style={{ fontSize: 13, lineHeight: '1.6' }}>
                            {orchestratorStatus === 'Connected'
                                ? `Playwright is tracking ${activePlaywrightSessions} active WhatsApp tabs safely.`
                                : 'Start the Node.js Orchestrator to enable Google Gemini automation features.'
                            }
                        </p>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b9f84" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"></path></svg>
                        <h3>WhatCopilote</h3>
                    </div>
                    <div className="card-body">
                        <button
                            className="btn-primary"
                            style={{ width: '100%', marginBottom: 16 }}
                            onClick={generateProposals}
                            disabled={isCopilotLoading || orchestratorStatus !== 'Connected'}
                        >
                            {isCopilotLoading ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <span className="pulse" style={{ position: 'relative', width: 8, height: 8 }}></span> Analyzing...
                                </span>
                            ) : 'Generate AI Replies'}
                        </button>

                        {copilotProposals.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                                {copilotProposals.map((reply, i) => (
                                    <div
                                        key={i}
                                        onClick={() => handleCopy(reply, i)}
                                        style={{
                                            padding: '12px',
                                            background: copiedIndex === i ? '#ecfdf5' : '#f1f5f9',
                                            borderRadius: 8,
                                            fontSize: 13,
                                            color: '#334155',
                                            border: copiedIndex === i ? '1px solid #10b981' : '1px solid #e2e8f0',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            transition: 'all 0.2s',
                                            paddingRight: '36px'
                                        }}
                                        title="Click to copy"
                                    >
                                        {reply}
                                        <div style={{ position: 'absolute', right: '12px', top: '12px', color: copiedIndex === i ? '#10b981' : '#94a3b8' }}>
                                            {copiedIndex === i ? (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            ) : (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {copilotProposals.length === 0 && !isCopilotLoading && (
                            <p className="info-text" style={{ fontSize: 13, textAlign: 'center', marginTop: 10 }}>
                                Open a conversation in WhatsApp and click generate to get reply suggestions.
                            </p>
                        )}
                    </div>
                </div>

            </aside>
        </div>
    );
};

export default WorkArea;
