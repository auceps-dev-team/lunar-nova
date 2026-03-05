import React, { useState, useRef } from 'react';
import useAppStore from '../store';
import { getTranslation as t } from '../locales';

const AgentsHub = () => {
    const [activeAgent, setActiveAgent] = useState('creative');
    const [activeTab, setActiveTab] = useState('analyse'); // 'analyse' or 'generation'
    const [productType, setProductType] = useState('');
    const [targetAmbiance, setTargetAmbiance] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);

    // Global store for persistent Agent History
    const agentHistory = useAppStore(state => state.agentHistory) || [];
    const addAgentHistory = useAppStore(state => state.addAgentHistory);
    const language = useAppStore(state => state.appSettings?.language) || 'en';

    // We only have the Visual Agent right now
    const agents = [
        {
            id: 'creative',
            name: 'Visual & Creative Agent',
            description: 'Specialized in generating prompts for high-end product uplifting, photo editing, and visionary art direction.',
            icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>,
            color: '#10b981'
        }
    ];

    const currentAgent = agents.find(a => a.id === activeAgent);
    const historyForAgent = agentHistory.filter(h => h.agentId === activeAgent);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage({ name: file.name, data: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerateAnalysis = async () => {
        if (!productType || !targetAmbiance || !selectedImage || isLoading) {
            alert("Please fill all fields and select an image.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('http://localhost:3000/api/gemini/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    persona: 'creative',
                    message: `Type de produit: ${productType}\nAmbiance souhaitée: ${targetAmbiance}\n[Base64 Image Attached]`,
                    imageParams: {
                        data: selectedImage.data.split(',')[1],
                        mimeType: 'image/jpeg'
                    }
                })
            });
            const data = await res.json();

            if (data.status === 'success') {
                // Heuristic to extract the prompt from Markdown headers or text
                let extractedPrompt = "Could not parse prompt automatically. Review analysis.";
                const splitMarkers = ["4. Le Prompt de Génération", "Prompt de Génération", "Prompt:", "Environment/Background"];

                for (const marker of splitMarkers) {
                    if (data.response.includes(marker)) {
                        const parts = data.response.split(marker);
                        // Take the last part and clean out subsequent markdown headers if any (e.g. line starting with `*` or `\n##` etc if not part of prompt, or just keep it all)
                        let textBlock = parts[parts.length - 1];
                        // Remove leading newlines/asterisks/markdown ticks
                        textBlock = textBlock.replace(/^[*\s:-]+/, '').replace(/```.*\n?/g, '').trim();
                        extractedPrompt = textBlock;
                        break;
                    }
                }

                setGeneratedPrompt(extractedPrompt);

                // Persist the generated item to history (for max 3 months conceptually, auto-deletion logic happens on cron/init in a real app)
                addAgentHistory({
                    id: Date.now().toString(),
                    agentId: activeAgent,
                    date: new Date().toISOString(),
                    productType,
                    targetAmbiance,
                    image: selectedImage,
                    prompt: extractedPrompt
                });

                setActiveTab('generation');
            }
        } catch (error) {
            console.error('Agent chat error', error);
            alert("Une erreur de connexion au serveur IA est survenue.");
        } finally {
            setIsLoading(false);
        }
    };

    const loadHistoryItem = (item) => {
        setProductType(item.productType);
        setTargetAmbiance(item.targetAmbiance);
        setSelectedImage(item.image);
        setGeneratedPrompt(item.prompt);
        setActiveTab('generation');
    };

    return (
        <div style={{ display: 'flex', height: '100%', gap: '24px', animation: 'fadeIn 0.3s' }}>
            {/* Left Sidebar - Agent History Log */}
            <div className="w-[300px] bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col hidden md:flex shrink-0">
                <div className="p-5 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Agent History</h2>
                    <p className="text-sm text-gray-500 mt-1">Past generations (kept for 3 months)</p>
                </div>

                <div className="p-3 flex flex-col gap-3 overflow-y-auto flex-1">
                    {historyForAgent.length === 0 ? (
                        <div className="text-sm text-gray-400 text-center mt-10">No history yet.</div>
                    ) : historyForAgent.map(hist => (
                        <div
                            key={hist.id}
                            onClick={() => loadHistoryItem(hist)}
                            className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate pr-2">{hist.productType}</span>
                                <span className="text-xs text-gray-400 shrink-0">{new Date(hist.date).toLocaleDateString()}</span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">Ambiance: {hist.targetAmbiance}</div>
                            {hist.image && (
                                <div className="h-20 w-full rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                    <img src={hist.image.data} alt="thumb" className="w-full h-full object-cover opacity-80" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Area - Workspace Interface */}
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

                {currentAgent.id === 'creative' && (
                    <div className="flex border-b border-gray-100 dark:border-gray-800 px-6 pt-2 shrink-0">
                        <button
                            className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'analyse' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                            onClick={() => setActiveTab('analyse')}
                        >
                            1. Analyse & Concept
                        </button>
                        <button
                            className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'generation' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                            onClick={() => setActiveTab('generation')}
                        >
                            2. Génération
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-gray-900/50">
                    {/* Tab 1: Analysis & Inputs */}
                    {activeTab === 'analyse' && (
                        <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto py-4">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">Product Details</h3>

                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload Product Image</label>
                                        <div
                                            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                            {selectedImage ? (
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                                        <img src={selectedImage.data} className="w-full h-full object-cover" alt="preview" />
                                                    </div>
                                                    <div className="text-sm font-medium text-primary">{selectedImage.name}</div>
                                                </div>
                                            ) : (
                                                <>
                                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                    <div className="text-sm text-gray-500">Click to upload product image</div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Product Type</label>
                                        <input
                                            type="text"
                                            value={productType}
                                            onChange={e => setProductType(e.target.value)}
                                            placeholder="e.g. Perfume, Cosmetic Cream, Watch..."
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Ambiance</label>
                                        <input
                                            type="text"
                                            value={targetAmbiance}
                                            onChange={e => setTargetAmbiance(e.target.value)}
                                            placeholder="e.g. Luxury, Fresh, Cyberpunk, Nature..."
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>

                                    <button
                                        className="w-full btn-primary py-3 mt-4 rounded-lg font-medium shadow-md shadow-primary/20 flex justify-center items-center gap-2"
                                        onClick={handleGenerateAnalysis}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? <span className="pulse w-4 h-4 rounded-full bg-white"></span> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>}
                                        {isLoading ? 'Analyzing Imagery...' : 'Analyze & Generate Strategy'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Visual Prompt Outputs */}
                    {activeTab === 'generation' && (
                        <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto py-4">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6 w-full">Visual Assets & Prompt</h3>

                                {selectedImage ? (
                                    <div className="w-full max-w-sm mb-8 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm bg-gray-50 dark:bg-gray-900 flex justify-center relative group">
                                        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur">Original Image</div>
                                        <img src={selectedImage.data} alt="Original Product" className="max-w-full max-h-[300px] object-contain" />
                                    </div>
                                ) : (
                                    <div className="w-full mb-8 p-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-center text-gray-400">
                                        No image available. Please Complete the Analysis tab above.
                                    </div>
                                )}

                                <div className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm flex flex-col gap-3">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Generated Visual Prompt</p>
                                        <p className="text-xs text-gray-500 mb-3 md:pr-10">Copy & Paste this optimized prompt directly into Midjourney, DALL-E, or Photoshop Generative Fill.</p>

                                        <textarea
                                            value={generatedPrompt}
                                            onChange={e => setGeneratedPrompt(e.target.value)}
                                            className="w-full bg-white dark:bg-gray-800 border-2 border-primary/20 rounded-lg p-4 text-gray-900 dark:text-white text-sm outline-none resize-none focus:border-primary/50 font-mono shadow-inner"
                                            rows="4"
                                            placeholder="Generated prompt will appear here after analysis..."
                                        />
                                    </div>
                                    <div className="flex justify-end mt-2">
                                        <button
                                            className="bg-primary hover:bg-primary/90 text-white py-2.5 px-6 rounded-lg font-medium text-sm flex items-center gap-2 transition shadow-md"
                                            onClick={() => {
                                                navigator.clipboard.writeText(generatedPrompt);
                                            }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                            Copier le Prompt
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AgentsHub;
