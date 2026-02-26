import React, { useState, useRef } from 'react';
import useAppStore from '../store';

const AgentsHub = () => {
    const [activeAgent, setActiveAgent] = useState('creative');
    const [inputFocus, setInputFocus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);

    // Get resilient chat history from global store
    const agentChats = useAppStore(state => state.agentChats);
    const updateAgentChat = useAppStore(state => state.updateAgentChat);

    const agents = [
        {
            id: 'creative',
            name: 'Visual & Creative Agent',
            description: 'Specialized in generating prompts for high-end product uplifting, photo editing, and visionary art direction.',
            icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>,
            color: '#10b981'
        },
        {
            id: 'legal',
            name: 'Legal & Admin Agent',
            description: 'Specialized in drafting contracts, writing professional invoices, and providing general legal assistance.',
            icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
            color: '#3b82f6'
        },
        {
            id: 'copywriter',
            name: 'Copywriter & SDR Senior',
            description: 'Experte en Cold Outreach, création de messages d\'approche irrésistibles, et prospection B2B.',
            icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>,
            color: '#f59e0b'
        }
    ];

    const currentAgent = agents.find(a => a.id === activeAgent);
    const currentChat = agentChats[activeAgent] || [];

    const handleSendMessage = async () => {
        if (!inputFocus.trim() || isLoading) return;

        const userMsg = inputFocus;
        setInputFocus('');

        const updatedChat = [...currentChat, { sender: 'user', text: userMsg }];
        updateAgentChat(activeAgent, updatedChat);
        setIsLoading(true);

        try {
            const res = await fetch('http://localhost:3000/api/gemini/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ persona: activeAgent, message: userMsg })
            });
            const data = await res.json();

            if (data.status === 'success') {
                updateAgentChat(activeAgent, [...updatedChat, { sender: 'agent', text: data.response }]);
            }
        } catch (error) {
            console.error('Agent chat error', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSendMessage();
    };

    return (
        <div style={{ display: 'flex', height: '100%', gap: '24px', animation: 'fadeIn 0.3s' }}>
            {/* Left Sidebar - Agent Directory */}
            <div style={{
                width: '300px',
                background: 'var(--panel-bg)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Agent Directory</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Select a persona to chat with</p>
                </div>

                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {agents.map(agent => (
                        <div
                            key={agent.id}
                            onClick={() => setActiveAgent(agent.id)}
                            style={{
                                padding: '16px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                background: activeAgent === agent.id ? 'var(--bg-color)' : 'transparent',
                                border: activeAgent === agent.id ? `1px solid ${agent.color}40` : '1px solid transparent'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '8px',
                                    background: `${agent.color}20`, color: agent.color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {agent.icon}
                                </div>
                                <div style={{ fontWeight: 500, fontSize: '14px' }}>{agent.name}</div>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                {agent.description}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Area - Chat Interface */}
            <div style={{
                flex: 1,
                background: 'var(--panel-bg)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '10px',
                        background: `${currentAgent.color}20`, color: currentAgent.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {currentAgent.icon}
                    </div>
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>{currentAgent.name}</h2>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Powered by Gemini 2.5 Flash</div>
                    </div>
                </div>

                <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ alignSelf: 'center', padding: '8px 16px', background: 'var(--bg-color)', borderRadius: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Chat initialized with {currentAgent.name}
                    </div>

                    {currentChat.map((msg, idx) => (
                        <div key={idx} style={{
                            alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '80%',
                            display: 'flex',
                            gap: '12px',
                            flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row'
                        }}>
                            {msg.sender === 'agent' && (
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                                    background: `${currentAgent.color}20`, color: currentAgent.color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {currentAgent.icon}
                                </div>
                            )}
                            <div style={{
                                background: msg.sender === 'user' ? 'var(--primary-color)' : 'var(--bg-color)',
                                color: msg.sender === 'user' ? '#fff' : 'inherit',
                                padding: '16px',
                                borderRadius: '12px',
                                borderTopLeftRadius: msg.sender === 'agent' ? '2px' : '12px',
                                borderTopRightRadius: msg.sender === 'user' ? '2px' : '12px',
                                fontSize: '14px',
                                lineHeight: '1.5',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {msg.text}
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '12px' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                                background: `${currentAgent.color}20`, color: currentAgent.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>{currentAgent.icon}</div>
                            <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: '12px', borderTopLeftRadius: '2px', fontSize: '14px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                                Thinking...
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', position: 'relative' }}>

                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                if (e.target.files[0]) {
                                    alert(`File attached: ${e.target.files[0].name} (File upload to Gemini is currently a UI stub.)`);
                                }
                            }}
                        />

                        {/* Attachment Button */}
                        <button
                            className="btn-icon"
                            title="Attach File"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        </button>

                        <textarea
                            value={inputFocus}
                            onChange={(e) => setInputFocus(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            disabled={isLoading}
                            placeholder="Message the agent... (Shift+Enter for new line)"
                            rows="2"
                            style={{
                                flex: 1,
                                background: 'var(--bg-color)',
                                border: '1px solid var(--border-color)',
                                padding: '12px 16px',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                resize: 'none',
                                fontFamily: 'inherit',
                                fontSize: '14px'
                            }}
                        />
                        <button
                            className="btn-primary"
                            onClick={handleSendMessage}
                            disabled={isLoading || !inputFocus.trim()}
                        >
                            Send
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentsHub;
