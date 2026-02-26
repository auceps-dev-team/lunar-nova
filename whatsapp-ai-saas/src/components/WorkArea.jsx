import React, { useState, useEffect } from 'react';
import useAppStore from '../store';
import '../styles/global.css';

const WorkArea = ({ instances, activeId }) => {
    const [orchestratorStatus, setOrchestratorStatus] = useState('Checking...');
    const [activePlaywrightSessions, setActivePlaywrightSessions] = useState(0);
    const [copilotProposals, setCopilotProposals] = useState([]);
    const [isCopilotLoading, setIsCopilotLoading] = useState(false);

    // Zustand Global Actions
    const incrementCopilotReplies = useAppStore(state => state.incrementCopilotReplies);

    // Reset proposals when switching tabs
    useEffect(() => {
        setCopilotProposals([]);
    }, [activeId]);

    const generateProposals = async () => {
        if (!activeId || orchestratorStatus !== 'Connected') return;
        setIsCopilotLoading(true);
        setCopilotProposals([]);
        try {
            // 1. Get readable Context safely
            const ctxRes = await fetch(`http://localhost:3000/api/context/${activeId}`);
            const ctxData = await ctxRes.json();

            if (ctxData.status === 'success') {
                // 2. Process via Gemini Assistive Copilot
                const geminiRes = await fetch('http://localhost:3000/api/gemini/copilot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instance_id: activeId,
                        chatContext: ctxData.context
                    })
                });
                const geminiData = await geminiRes.json();
                if (geminiData.status === 'success') {
                    setCopilotProposals(geminiData.proposals);
                    incrementCopilotReplies(geminiData.proposals.length || 1);
                }
            } else {
                alert(ctxData.error || 'Could not extract context. Please open a chat.');
            }
        } catch (error) {
            console.error('Copilot Error:', error);
            alert('Failed to connect to Orchestrator service.');
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
            <div className="workarea">
                <div className="empty-state">
                    <h2>Welcome to WhatsAI</h2>
                    <p>Click "New Instance" in the sidebar to create an isolated WhatsApp Web Sandbox.</p>
                </div>
            </div>
        );
    }

    const activeInstance = instances.find(inst => inst.id === activeId);

    // Fallback if trying to render when no valid instance selected
    if (!activeInstance && instances.length > 0) {
        return (
            <div className="workarea">
                <div className="empty-state">
                    <h2>Select an Account</h2>
                    <p>Choose an account from the sidebar or link a new device to continue.</p>
                </div>
            </div>
        );
    }

    const displayId = activeInstance.id.slice(activeInstance.id.length - 8);

    return (
        <div className="workarea">
            <div className="dashboard-grid">

                {/* Left Side: Main WhatsApp Web View */}
                <div className="main-panel">
                    <div className="card" style={{ height: '100%' }}>

                        <div className="card-header" style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0b9f84" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                <div>
                                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 16 }}>WhatsApp Connection</h3>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                                        Scan the QR code to authenticate this instance.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card-body" style={{ padding: 0, position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
                            {/* This loops and hides all inactive webviews, keeping their state persistent */}
                            {instances.map(instance => (
                                <div
                                    key={instance.id}
                                    className={`webview-container ${instance.id === activeId ? 'active' : ''}`}
                                >
                                    <webview
                                        src="https://web.whatsapp.com"
                                        partition={`persist:${instance.id}`}
                                        allowpopups="true"
                                        useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                                    />
                                </div>
                            ))}
                        </div>

                    </div>
                </div>

                {/* Right Side: Session Info & AI Agent Status */}
                <div className="side-panel">

                    <div className="card">
                        <div className="card-header">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b9f84" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
                            <h3>AI Agent Status</h3>
                        </div>
                        <div className="card-body">
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
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b9f84" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                            <h3>Assistive Copilot</h3>
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
                                        <div key={i} style={{ padding: '10px 12px', background: '#f1f5f9', borderRadius: 8, fontSize: 13, color: '#334155', border: '1px solid #e2e8f0', cursor: 'pointer' }} title="Click to copy">
                                            {reply}
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

                </div>

            </div>
        </div>
    );
};

export default WorkArea;
