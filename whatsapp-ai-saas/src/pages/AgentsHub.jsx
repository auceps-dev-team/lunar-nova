import React, { useState } from 'react';

const AgentsHub = () => {
    const [activeAgent, setActiveAgent] = useState('creative');
    const [inputFocus, setInputFocus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chats, setChats] = useState({
        creative: [{ sender: 'agent', text: 'Hello! I am your Visual & Creative Agent. How can I assist you with your workload today?' }],
        legal: [{ sender: 'agent', text: 'Hello! I am your Legal & Admin Agent. How can I assist you with your workload today?' }]
    });

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
        }
    ];

    const currentAgent = agents.find(a => a.id === activeAgent);
    const currentChat = chats[activeAgent] || [];

    const handleSendMessage = async () => {
        if (!inputFocus.trim() || isLoading) return;

        const userMsg = inputFocus;
        setInputFocus('');

        const updatedChat = [...currentChat, { sender: 'user', text: userMsg }];
        setChats(prev => ({ ...prev, [activeAgent]: updatedChat }));
        setIsLoading(true);

        try {
            const res = await fetch('http://localhost:3000/api/gemini/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ persona: activeAgent, message: userMsg })
            });
            const data = await res.json();

            if (data.status === 'success') {
                setChats(prev => ({
                    ...prev,
                    [activeAgent]: [...updatedChat, { sender: 'agent', text: data.response }]
                }));
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
                    <div style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                        <input
                            type="text"
                            value={inputFocus}
                            onChange={(e) => setInputFocus(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            placeholder="Message the agent..."
                            style={{
                                flex: 1,
                                background: 'var(--bg-color)',
                                border: '1px solid var(--border-color)',
                                padding: '14px 16px',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={isLoading || !inputFocus.trim()}
                            style={{
                                background: isLoading || !inputFocus.trim() ? 'var(--border-color)' : 'var(--primary-color)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0 20px',
                                cursor: isLoading || !inputFocus.trim() ? 'not-allowed' : 'pointer',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
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
