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
    const [isHistoryOpen, setIsHistoryOpen] = useState(false); // Minimized history by default
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
            description: 'Specialized in generating prompts for high-end product uplifting.',
            icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>,
            color: '#3b82f6' // Blue match for photo icon
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
                        let textBlock = parts[parts.length - 1];
                        textBlock = textBlock.replace(/^[*\s:-]+/, '').replace(/```.*\n?/g, '').trim();
                        extractedPrompt = textBlock;
                        break;
                    }
                }

                setGeneratedPrompt(extractedPrompt);

                // Persist the generated item to history
                addAgentHistory({
                    id: Date.now().toString(),
                    agentId: activeAgent,
                    date: new Date().toISOString(),
                    productType,
                    targetAmbiance,
                    image: selectedImage,
                    prompt: extractedPrompt
                });

                // Do not auto-switch tab here as requested, the user wants prompt in analysis tab
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
        <div style={{ display: 'flex', height: '100%', gap: '16px', animation: 'fadeIn 0.3s' }}>
            {/* Left Sidebar - Minimized Agent History Log */}
            <div className={`transition-all duration-300 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col shrink-0 ${isHistoryOpen ? 'w-[260px]' : 'w-[64px] items-center'}`}>
                <div onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="p-4 border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between w-full">
                    {isHistoryOpen ? (
                        <>
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">History</h2>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                        </>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    )}
                </div>

                <div className={`p-2 flex flex-col gap-2 overflow-y-auto flex-1 ${!isHistoryOpen && 'items-center'}`}>
                    {historyForAgent.map(hist => (
                        <div
                            key={hist.id}
                            onClick={() => loadHistoryItem(hist)}
                            className={`rounded-lg border border-gray-100 dark:border-gray-800 cursor-pointer transition-colors shadow-sm overflow-hidden ${isHistoryOpen ? 'p-3 hover:bg-gray-50 dark:hover:bg-gray-800' : 'w-10 h-10 hover:opacity-80 relative group'}`}
                        >
                            {isHistoryOpen ? (
                                <>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate pe-2">{hist.productType}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 truncate mb-2">{hist.targetAmbiance}</div>
                                    {hist.image && (
                                        <div className="h-16 w-full rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                                            <img src={hist.image.data} alt="thumb" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </>
                            ) : (
                                hist.image ? (
                                    <img src={hist.image.data} alt="thumb" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs">IMG</div>
                                )
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
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        background: `${currentAgent.color}20`, color: currentAgent.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {currentAgent.icon}
                    </div>
                    <div>
                        <h2 style={{ fontSize: '16px', fontWeight: 600 }}>{currentAgent.name}</h2>
                    </div>
                </div>

                <div className="flex border-b border-gray-100 dark:border-gray-800 px-6 pt-2 shrink-0 bg-white dark:bg-gray-900">
                    <button
                        className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'analyse' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('analyse')}
                    >
                        1. Analyse & Concept
                    </button>
                    <button
                        className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'generation' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('generation')}
                    >
                        2. Génération
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-[#F9FAFB] dark:bg-[#111827]">
                    {/* Tab 1: Analysis & Inputs */}
                    {activeTab === 'analyse' && (
                        <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto py-6 px-4">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">Product Details</h3>

                                <div className="space-y-4">
                                    <div>
                                        <div
                                            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                            {selectedImage ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                                        <img src={selectedImage.data} className="w-full h-full object-cover" alt="preview" />
                                                    </div>
                                                    <div className="text-sm font-medium text-blue-500">{selectedImage.name}</div>
                                                </div>
                                            ) : (
                                                <>
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                    <div className="text-sm text-gray-500">Click to upload product image</div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={productType}
                                                onChange={e => setProductType(e.target.value)}
                                                placeholder="Product Type (Perfume, Shoes...)"
                                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-sm outline-none text-gray-900 dark:text-gray-100"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={targetAmbiance}
                                                onChange={e => setTargetAmbiance(e.target.value)}
                                                placeholder="Target Ambiance (Luxury, Nature...)"
                                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-sm outline-none text-gray-900 dark:text-gray-100"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        className="w-full bg-[#10b981] hover:bg-[#059669] text-white py-3 mt-2 rounded-lg font-medium shadow flex justify-center items-center gap-2"
                                        onClick={handleGenerateAnalysis}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? <span className="pulse w-4 h-4 rounded-full bg-white"></span> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>}
                                        {isLoading ? 'Analyzing Imagery...' : 'Analyze & Generate Strategy'}
                                    </button>
                                </div>
                            </div>

                            {generatedPrompt && (
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-[#10b981]/30 shadow-sm animate-fadeIn">
                                    <h3 className="text-[#10b981] font-semibold text-sm mb-2 flex items-center gap-2">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                                        Generated Visual Prompt
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">You can now proceed to the Generation tab to tweak settings.</p>
                                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg font-mono text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap border border-gray-200 dark:border-gray-700">
                                        {generatedPrompt}
                                    </div>
                                    <div className="flex justify-end mt-4 gap-3">
                                        <button
                                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                                            onClick={() => navigator.clipboard.writeText(generatedPrompt)}
                                        >
                                            Copier le texte
                                        </button>
                                        <button
                                            className="px-4 py-2 bg-[#4f46e5] text-white rounded-lg text-sm font-medium hover:bg-[#4338ca] transition shadow"
                                            onClick={() => setActiveTab('generation')}
                                        >
                                            Aller à la Génération &rarr;
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Split Generator View */}
                    {activeTab === 'generation' && (
                        <div className="flex flex-col md:flex-row gap-6 w-full h-full p-4 md:p-6 pb-20 md:pb-6">
                            {/* Left View: Image & History Strip */}
                            <div className="flex-1 flex flex-col gap-4 bg-[#f3f4f6] dark:bg-[#1f2128] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 overflow-hidden relative justify-between">
                                <div className="flex-1 flex items-center justify-center overflow-hidden rounded-xl relative">
                                    {selectedImage ? (
                                        <img src={selectedImage.data} alt="Visual" className="max-w-full max-h-full object-contain rounded-lg shadow-md" />
                                    ) : (
                                        <div className="text-gray-400 text-sm">No image available</div>
                                    )}
                                </div>

                                <div className="shrink-0 flex items-center gap-3 overflow-x-auto pt-2 pb-1">
                                    <span className="text-xs font-semibold text-gray-500 mr-2 flex items-center gap-1 shrink-0">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                        Récent
                                    </span>
                                    {historyForAgent.slice(0, 5).map(hist => (
                                        <div key={hist.id} onClick={() => loadHistoryItem(hist)} className="w-14 h-14 shrink-0 rounded-lg border-2 border-transparent hover:border-blue-500 cursor-pointer overflow-hidden bg-gray-200 dark:bg-gray-800 transition-all hover:-translate-y-1">
                                            {hist.image && <img src={hist.image.data} className="w-full h-full object-cover opacity-90" />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right View: Settings Panel */}
                            <div className="w-full md:w-[360px] flex flex-col bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm shrink-0 h-fit md:h-full">
                                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-6">
                                    <button className="flex-1 py-1.5 bg-white dark:bg-[#2d3039] text-[#4f46e5] dark:text-[#818cf8] text-sm font-semibold rounded-md shadow-sm transition">Créer</button>
                                    <button className="flex-1 py-1.5 text-gray-600 dark:text-gray-400 text-sm font-medium hover:text-gray-900 transition">Modifier l'image</button>
                                </div>

                                <div className="relative mb-6">
                                    <textarea
                                        value={generatedPrompt}
                                        onChange={e => setGeneratedPrompt(e.target.value)}
                                        className="w-full h-[180px] md:h-[220px] bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-800 dark:text-gray-200 outline-none resize-none focus:border-[#4f46e5] dark:focus:border-[#4f46e5] transition-colors pr-10"
                                        placeholder="Décrivez l'image que vous souhaitez générer..."
                                    />
                                    <div className="absolute right-3 bottom-3 text-gray-400 cursor-pointer hover:text-gray-600">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4 mb-8">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">Modèle</label>
                                        <div className="relative">
                                            <select className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-lg py-2.5 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none cursor-pointer appearance-none">
                                                <option>GPT-4o</option>
                                                <option>Gemini 2.5 Flash</option>
                                                <option>Midjourney V6</option>
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">Proportions</label>
                                        <div className="relative">
                                            <select className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-lg py-2.5 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none cursor-pointer appearance-none text-left flex gap-2">
                                                <option>2:3 (Vertical)</option>
                                                <option>1:1 (Carré)</option>
                                                <option>16:9 (Horizontal)</option>
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className="mt-auto w-full bg-[#5468ff] hover:bg-[#4353cc] text-white py-3 rounded-xl font-semibold shadow-md transition-colors"
                                    onClick={() => alert("Simulation : Dans l'application finale, ceci lancera la génération d'image via l'API (Midjourney/DALL-E) en utilisant votre prompt.")}
                                >
                                    Générer
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AgentsHub;
