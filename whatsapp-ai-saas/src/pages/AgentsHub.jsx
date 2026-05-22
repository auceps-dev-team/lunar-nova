import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';


const AgentsHub = ({ activeId }) => {
    const navigate = useNavigate();
    const [activeAgent, setActiveAgent] = useState('creative');
    const [activeTab, setActiveTab] = useState('analyse'); // 'analyse' or 'generation'
    const [productType, setProductType] = useState('');
    const [targetAmbiance, setTargetAmbiance] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [generatedMarketing, setGeneratedMarketing] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isUploadingCatalog, setIsUploadingCatalog] = useState(false);
    const [generatedImageResults, setGeneratedImageResults] = useState([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [selectedImageModel, setSelectedImageModel] = useState('');
    const [generationRefImage, setGenerationRefImage] = useState(null); // Reference image for gen tab
    const fileInputRef = useRef(null);
    const genFileInputRef = useRef(null);

    const { t } = useTranslation();
    const agentHistory = useAppStore(state => state.agentHistory) || [];
    const addAgentHistory = useAppStore(state => state.addAgentHistory);
    const removeAgentHistory = useAppStore(state => state.removeAgentHistory);
    const setCatalogDraft = useAppStore(state => state.setCatalogDraft);
    const setCopilotNotification = useAppStore(state => state.setCopilotNotification);
    const showAppNotification = useAppStore(state => state.showAppNotification);
    const setPendingEditImage = useAppStore(state => state.setPendingEditImage);
    const promptFormat = useAppStore(state => state.appSettings?.promptFormat) || 'json';
    const language = useAppStore(state => state.appSettings?.language) || 'en';
    // default_image_provider : provider dédié à la génération d'images (Together AI/openai)
    const backendProvider   = useAppStore(state => state.backendSettings?.default_image_provider) || 'openai';
    const backendImageModel = useAppStore(state => state.backendSettings?.default_image_model) || '';
    const availableImageModels = useAppStore(state => state.availableModels?.image) || [];


    const clearAllHistory = () => {
        historyForAgent.forEach(h => removeAgentHistory(h.id));
    };

    // We only have the Visual Agent right now
    const agents = [
        {
            id: 'creative',
            name: t('productPhoto'),
            description: t('agentCreativeDesc'),
            icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>,
            color: '#0b9f84' // Green theme match
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

    // Upload handler for the generation tab reference image
    const handleGenImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setGenerationRefImage({ name: file.name, data: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerateAnalysis = async () => {
        if (!productType || !targetAmbiance || !selectedImage || isLoading) {
            alert(t('errorFillAllFields'));
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:3000/api/ai/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    persona: 'creative',
                    promptFormat: promptFormat,
                    message: `Type de produit: ${productType}\nAmbiance souhaitée: ${targetAmbiance}\n[Base64 Image Attached]`,
                    imageParams: {
                        data: selectedImage.data.split(',')[1],
                        mimeType: 'image/jpeg'
                    },
                    provider: useAppStore.getState().appSettings?.provider,
                    model: useAppStore.getState().appSettings?.model
                })
            });
            const data = await res.json();

            if (data.status === 'success') {
                let extractedPrompt = t('errorParsePrompt');
                let extractedMarketing = t('defaultProductName');

                if (promptFormat === 'json') {
                    try {
                        let jsonStr = data.response;
                        const jsonBoundary = jsonStr.indexOf('{');
                        const jsonEndBoundary = jsonStr.lastIndexOf('}');

                        // FIX: Only parse if valid JSON boundaries are found
                        if (jsonBoundary !== -1 && jsonEndBoundary !== -1) {
                            jsonStr = jsonStr.substring(jsonBoundary, jsonEndBoundary + 1);
                            const parsed = JSON.parse(jsonStr);
                            extractedPrompt = parsed.prompt || t('noPromptProvided');
                            extractedMarketing = `Nom: ${parsed.marketing?.name || ''}\nPrix: ${parsed.marketing?.price || ''}\nCode: ${parsed.marketing?.code || ''}\nDescription: ${parsed.marketing?.description || ''}`;
                        } else {
                            // If it's plain text (like an offline error message), don't crash
                            extractedPrompt = data.response;
                        }
                    } catch (e) {
                        console.error("Failed to parse JSON response:", e);
                        extractedPrompt = data.response;
                    }
                } else {
                    const splitMarkers = ["4. Le Prompt de Génération", "Prompt de Génération", "Prompt:", "Environment/Background"];

                    for (const marker of splitMarkers) {
                        if (data.response.includes(marker)) {
                            const parts = data.response.split(marker);
                            let textBlock = parts[1] || parts[parts.length - 1];

                            if (textBlock.includes("5. Textes pour le Catalogue WhatsApp")) {
                                textBlock = textBlock.split("5. Textes pour le Catalogue WhatsApp")[0];
                            }

                            textBlock = textBlock.replace(/^[*\s:-]+/, '').replace(/```.*\n?/g, '').trim();
                            extractedPrompt = textBlock;
                            break;
                        }
                    }

                    if (data.response.includes("5. Textes pour le Catalogue WhatsApp")) {
                        let mktBlock = data.response.split("5. Textes pour le Catalogue WhatsApp")[1];
                        extractedMarketing = mktBlock.replace(/^[*\s:-]+/, '').replace(/```.*\n?/g, '').trim();
                    }
                }

                setGeneratedPrompt(extractedPrompt);
                setGeneratedMarketing(extractedMarketing);

                // Persist the generated item to history
                addAgentHistory({
                    id: Date.now().toString(),
                    agentId: activeAgent,
                    date: new Date().toISOString(),
                    productType,
                    targetAmbiance,
                    image: selectedImage,
                    prompt: extractedPrompt,
                    marketing: extractedMarketing
                });

                // Do not auto-switch tab here as requested, the user wants prompt in analysis tab
            }
        } catch (error) {
            console.error('Agent chat error', error);
            alert(t('errorAiServer'));
        } finally {
            setIsLoading(false);
        }
    };

    const loadHistoryItem = (item) => {
        setProductType(item.productType);
        setTargetAmbiance(item.targetAmbiance);
        setSelectedImage(item.image);
        setGeneratedPrompt(item.prompt);
        setGeneratedMarketing(item.marketing || null);
        setGeneratedImageResults(item.generatedImages || (item.generatedImage ? [item.generatedImage] : []));
        setSelectedImageIndex(0);
        if (item.image) setGenerationRefImage(item.image); // Pre-load as reference image in gen tab
        setActiveTab('generation');
    };

    const handleGenerateImage = async () => {
        if (!generatedPrompt || isGeneratingImage) return;

        setIsGeneratingImage(true);
        try {
            const body = {
                prompt: generatedPrompt,
                aspectRatio: aspectRatio,
                mode: 'product',
                // Utiliser le provider et modèle sélectionnés dans les Settings
                provider: backendProvider,
                imageModel: selectedImageModel || backendImageModel || undefined,
            };

            // Attach reference image (from gen tab or analysis tab) if available
            const refImg = generationRefImage || selectedImage;
            if (refImg) {
                body.imageParams = {
                    data: refImg.data.split(',')[1],
                    mimeType: 'image/jpeg'
                };
            }

            const res = await fetch('http://127.0.0.1:3000/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (data.status === 'success' && data.imageStore) {
                // Ensure it's correctly formatted as data URI
                const b64Data = data.imageStore.startsWith('data:') ? data.imageStore : `data:image/jpeg;base64,${data.imageStore}`;

                const newResults = [b64Data, ...generatedImageResults];
                setGeneratedImageResults(newResults);
                setSelectedImageIndex(0); // View the newest by default

                // Update history item with generated image array
                if (historyForAgent.length > 0) {
                    const latestHistory = historyForAgent[0];
                    // Append to existing array or initialize
                    const updatedImages = latestHistory.generatedImages
                        ? [b64Data, ...latestHistory.generatedImages]
                        : (latestHistory.generatedImage ? [b64Data, latestHistory.generatedImage] : [b64Data]);

                    removeAgentHistory(latestHistory.id);
                    addAgentHistory({
                        ...latestHistory,
                        generatedImages: updatedImages,
                        generatedImage: b64Data // keep fallback
                    });
                } else {
                    addAgentHistory({
                        id: Date.now().toString(),
                        agentId: activeAgent,
                        date: new Date().toISOString(),
                        productType,
                        targetAmbiance,
                        image: selectedImage,
                        prompt: generatedPrompt,
                        marketing: generatedMarketing,
                        generatedImages: [b64Data],
                        generatedImage: b64Data
                    });
                }
            } else {
                alert(data.error || t('errorImageGen'));
            }
        } catch (error) {
            console.error('Image Generation error', error);
            alert(t('errorGenServer'));
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleUploadToCatalog = async () => {
        const currentGeneratedImage = generatedImageResults[selectedImageIndex];
        if (!currentGeneratedImage || !generatedPrompt || !activeId) {
            alert(t('errorCatalogMissingData'));
            return;
        }

        setIsUploadingCatalog(true);
        try {
            const marketingText = generatedMarketing || generatedPrompt;
            // First, strip markdown bold to make regex more stable
            const cleanText = marketingText.replace(/\*\*/g, '');

            const nameMatch = cleanText.match(/[Nn]om\s*:\s*(.*)/);
            const productName = nameMatch ? nameMatch[1].trim() : t('defaultProductName');

            const priceMatch = cleanText.match(/[Pp]rix\s*:\s*(.*)/);
            const productPrice = priceMatch ? priceMatch[1].trim() : "";

            const codeMatch = cleanText.match(/[Cc]ode.*?\s*:\s*(.*)/);
            const productCode = codeMatch ? codeMatch[1].trim() : "";

            const descMatch = cleanText.match(/[Dd]escription\s*:\s*([\s\S]*)/);
            const productDescription = descMatch ? descMatch[1].trim() : marketingText;

            const body = {
                instance_id: activeId,
                productName: productName,
                productDescription: productDescription,
                productPrice: productPrice,
                imageBase64: currentGeneratedImage
            };

            showAppNotification(t('prepWhatsappSend'), "info");

            const res = await fetch('http://127.0.0.1:3000/api/catalog/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (data.status === 'success') {
                // Set the draft in the global store so WhatCopilot can display it explicitly structured
                setCatalogDraft({
                    name: productName,
                    description: productDescription,
                    price: productPrice,
                    code: productCode
                });

                // Switch to the WhatsApp view immediately so the user can watch the automation
                navigate('/whatsapp-hub');

                showAppNotification(t('successCatalogAdd'), "success");
                setCopilotNotification(t('successWhatsappInject'));
            } else {
                showAppNotification(t('errorGoToCatalogMenu'), "error");
                setCopilotNotification(t('errorInjectFail'));
            }
        } catch (error) {
            console.error('Catalog Upload error', error);
            showAppNotification(t('errorNetworkWhatsapp'), "error");
        } finally {
            setIsUploadingCatalog(false);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100%', gap: '16px', animation: 'fadeIn 0.3s' }}>
            {/* Left Sidebar - Minimized Agent History Log */}
            <div className={`transition-all duration-300 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col shrink-0 ${isHistoryOpen ? 'w-[260px]' : 'w-[64px] items-center'}`}>
                <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between w-full gap-2">
                    <div onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="flex items-center gap-2 cursor-pointer hover:opacity-70 flex-1">
                        {isHistoryOpen ? (
                            <>
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('recents')}</h2>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                            </>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        )}
                    </div>
                    {isHistoryOpen && historyForAgent.length > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); clearAllHistory(); }}
                            title={t('deleteAllHistoryTitle')}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                        </button>
                    )}
                </div>

                <div className={`p-2 flex flex-col gap-2 overflow-y-auto flex-1 ${!isHistoryOpen && 'items-center'}`}>
                    {historyForAgent.map(hist => (
                        <div
                            key={hist.id}
                            className={`rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden relative group ${isHistoryOpen ? 'p-3' : 'w-10 h-10'}`}
                        >
                            {/* Delete button always visible on hover */}
                            <button
                                onClick={(e) => { e.stopPropagation(); removeAgentHistory(hist.id); }}
                                className="absolute top-1 right-1 z-10 bg-white/90 dark:bg-gray-900/90 text-red-400 hover:text-red-600 rounded-full w-5 h-5 items-center justify-center hidden group-hover:flex transition-all shadow"
                                title={t('delete')}
                            >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>

                            <div onClick={() => loadHistoryItem(hist)} className="cursor-pointer w-full h-full">
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
                                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs">{t('img')}</div>
                                    )
                                )}
                            </div>
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
                        {t('step1AnalysisConcept')}
                    </button>
                    <button
                        className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'generation' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('generation')}
                    >
                        {t('step2Generation')}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-[#F9FAFB] dark:bg-[#111827]">
                    {/* Tab 1: Analysis & Inputs */}
                    {activeTab === 'analyse' && (
                        <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto py-6 px-4">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">{t('productDetails')}</h3>

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
                                                    <div className="text-sm font-medium text-[#0b9f84]">{selectedImage.name}</div>
                                                </div>
                                            ) : (
                                                <>
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                    <div className="text-sm text-gray-500">{t('clickToUploadProductImage')}</div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Magnifying glass scanning overlay during analysis */}
                                    {isLoading && selectedImage && (
                                        <div className="relative w-full rounded-xl overflow-hidden border-2 border-emerald-400/30" style={{ minHeight: '120px' }}>
                                            <img src={selectedImage.data} className="w-full h-40 object-cover rounded-xl opacity-70" alt="scanning" />
                                            <div className="analysis-scanning-overlay">
                                                <div className="magnify-lens"></div>
                                                <div className="scan-line"></div>
                                            </div>
                                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-emerald-300 text-xs font-medium px-4 py-1.5 rounded-full flex items-center gap-2 z-20">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                                {t('analyzingProduct')}
                                            </div>
                                        </div>
                                    )}

                                    {/* Recent history strip under Image upload in Analyse Tab */}
                                    {historyForAgent.length > 0 && (
                                        <div className="shrink-0 flex items-center gap-3 overflow-x-auto bg-gray-50 dark:bg-gray-900 border border-gray-100 rounded-xl p-3 shadow-sm dark:border-gray-700">
                                            <span className="text-xs font-semibold text-gray-500 mr-2 flex items-center gap-1 shrink-0">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                {t('recent')}
                                            </span>
                                            {historyForAgent.slice(0, 5).map(hist => (
                                                <div key={hist.id} onClick={() => loadHistoryItem(hist)} className="w-12 h-12 shrink-0 rounded-lg border border-gray-200 hover:border-[#0b9f84] cursor-pointer overflow-hidden bg-gray-200 dark:bg-gray-800 transition-all hover:-translate-y-1">
                                                    {hist.image && <img src={hist.image.data} className="w-full h-full object-cover opacity-90" />}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={productType}
                                                onChange={e => setProductType(e.target.value)}
                                                placeholder={t('productTypePerfumeShoes')}
                                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-sm outline-none text-gray-900 dark:text-gray-100"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={targetAmbiance}
                                                onChange={e => setTargetAmbiance(e.target.value)}
                                                placeholder={t('targetAmbianceLuxuryNature')}
                                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-sm outline-none text-gray-900 dark:text-gray-100"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        className={`w-full py-3 mt-2 rounded-lg font-medium shadow flex justify-center items-center gap-2 transition-all ${isLoading ? 'bg-[#0b9f84]/80 text-white cursor-wait' : 'bg-[#0b9f84] hover:bg-[#088b73] text-white'
                                            }`}
                                        onClick={handleGenerateAnalysis}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                                                    <circle cx="11" cy="11" r="8" strokeDasharray="50" strokeDashoffset="20"></circle>
                                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                                </svg>
                                                {t('analyzingProduct')}
                                            </>
                                        ) : (
                                            <>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="11" cy="11" r="8"></circle>
                                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                                </svg>
                                                {t('analyzeGenerateStrategy')}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {generatedPrompt && (
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-[#0b9f84]/30 shadow-sm animate-fadeIn">
                                    <h3 className="text-[#0b9f84] font-semibold text-sm mb-2 flex items-center gap-2">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                                        {t('genPromptTitle')}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">{t('proceedToGenerationTab')}</p>
                                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg font-mono text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap border border-gray-200 dark:border-gray-700">
                                        {generatedPrompt}
                                    </div>
                                    <div className="flex justify-end mt-4 gap-3">
                                        <button
                                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                                            onClick={() => navigator.clipboard.writeText(generatedPrompt)}
                                        >
                                            {t('copyText')}
                                        </button>
                                        <button
                                            className="px-4 py-2 bg-[#0b9f84] text-white rounded-lg text-sm font-medium hover:bg-[#088b73] transition shadow"
                                            onClick={() => setActiveTab('generation')}
                                        >
                                            {t('goToGen')} &rarr;
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Split Generator View */}
                    {activeTab === 'generation' && (
                        <div className="flex flex-col md:flex-row gap-6 w-full h-full p-4 md:p-6 pb-20 md:pb-6">
                            {/* Left View: Image & Reference Panel */}
                            <div className="flex-1 flex flex-col gap-4 bg-[#f3f4f6] dark:bg-[#1f2128] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 overflow-hidden relative justify-between min-h-[380px]">
                                <input type="file" ref={genFileInputRef} className="hidden" accept="image/*" onChange={handleGenImageUpload} />

                                {/* Main Image View */}
                                <div className="flex-1 flex flex-col items-center justify-center overflow-hidden rounded-xl relative">
                                    {generatedImageResults.length > 0 ? (
                                        <div className="relative flex flex-col items-center justify-center w-full h-full">
                                            <div className="relative w-full h-full flex items-center justify-center">
                                                <img src={generatedImageResults[selectedImageIndex]} alt="Generated" className="max-w-full max-h-full object-contain rounded-lg shadow-xl ring-4 ring-[#10b981]/30" />
                                                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> {t('generatedResults')}
                                                </div>
                                                <div className="absolute top-4 right-4 flex gap-2">
                                                    <button
                                                        className="w-8 h-8 flex items-center justify-center bg-black/40 backdrop-blur-sm hover:bg-red-500/90 text-white/80 hover:text-white rounded-lg shadow-lg transition-all"
                                                        onClick={() => {
                                                            const newResults = [...generatedImageResults];
                                                            newResults.splice(selectedImageIndex, 1);
                                                            setGeneratedImageResults(newResults);
                                                            if (selectedImageIndex >= newResults.length) {
                                                                setSelectedImageIndex(Math.max(0, newResults.length - 1));
                                                            }
                                                        }}
                                                        title={t('deleteResult')}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                                                    </button>
                                                    <button
                                                        className="h-8 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm hover:bg-white/90 hover:text-gray-900 text-white/90 px-3 rounded-lg text-xs font-semibold shadow-lg transition-all"
                                                        onClick={() => {
                                                            const a = document.createElement('a');
                                                            a.href = generatedImageResults[selectedImageIndex];
                                                            a.download = `generation_${Date.now()}.jpg`;
                                                            a.click();
                                                        }}
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                                        {t('download')}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Floating Recent Generations Array Picker */}
                                            {generatedImageResults.length > 1 && (
                                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 overflow-x-auto bg-black/50 backdrop-blur-md border border-white/20 rounded-2xl p-2 shadow-2xl z-20">
                                                    {generatedImageResults.map((imgSrc, idx) => (
                                                        <div
                                                            key={idx}
                                                            onClick={() => setSelectedImageIndex(idx)}
                                                            className={`w-14 h-14 shrink-0 rounded-xl border-2 cursor-pointer overflow-hidden bg-gray-200 dark:bg-gray-800 transition-all hover:-translate-y-1 ${idx === selectedImageIndex ? 'border-[#0b9f84] ring-2 ring-[#0b9f84]/50 shadow-lg scale-110' : 'border-transparent opacity-80 hover:opacity-100'}`}
                                                        >
                                                            <img src={imgSrc} className="w-full h-full object-cover" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : generationRefImage ? (
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            <img src={generationRefImage.data} alt="Reference" className="max-w-full max-h-full object-contain rounded-lg shadow-md opacity-90" />
                                            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span> {t('referenceImage')}
                                            </div>
                                            <button
                                                className="absolute top-4 right-4 bg-white/90 hover:bg-red-50 text-red-500 p-2 rounded-lg shadow transition"
                                                onClick={() => setGenerationRefImage(null)}
                                                title={t('removeReferenceImage')}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            className="w-full h-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-[#252830] transition"
                                            onClick={() => genFileInputRef.current?.click()}
                                        >
                                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                            <div className="text-center">
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('addReferenceImage')}</p>
                                                <p className="text-xs text-gray-400 mt-1">{t('usedToGuideGeminiImagen')}</p>
                                            </div>
                                            <button
                                                className="mt-1 px-4 py-2 bg-[#0b9f84] hover:bg-[#088b73] text-white text-sm font-medium rounded-lg shadow transition"
                                                onClick={(e) => { e.stopPropagation(); genFileInputRef.current?.click(); }}
                                            >
                                                {t('chooseAnImage')}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Premium AI Processing Overlay */}
                                {isGeneratingImage && (
                                    <div className="absolute inset-0 z-30 bg-white/60 dark:bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4 rounded-xl transition-all duration-300">
                                        <div className="flex flex-col items-center space-y-5 p-8 bg-white/90 dark:bg-[#1a1c23]/90 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl">
                                            <div className="relative flex items-center justify-center">
                                                <div className="w-16 h-16 border-4 border-[#0b9f84]/20 border-t-[#0b9f84] rounded-full animate-spin"></div>
                                                <Sparkles className="w-6 h-6 text-[#0b9f84] absolute animate-pulse pointer-events-none" />
                                            </div>
                                            <div className="text-center">
                                                <h3 className="text-base font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{t('generating')}</h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('generatingDesc')}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Catalog Upload Button Area */}
                                {generatedImageResults.length > 0 && (
                                    <div className="shrink-0 flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-3 mt-3 shadow-sm z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">{t('whatsappBusinessCatalog')}</h4>
                                                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">{t('publishProductToStore')}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleUploadToCatalog}
                                            disabled={isUploadingCatalog || !activeId}
                                            className={`px-4 py-2 rounded-lg text-sm font-semibold shadow transition flex items-center gap-2 ${isUploadingCatalog || !activeId ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                                        >
                                            {isUploadingCatalog ? (
                                                <><span className="pulse w-2 h-2 rounded-full bg-current"></span> {t('deploying')}</>
                                            ) : !activeId ? (
                                                t('instanceNotFound')
                                            ) : (
                                                t('publish')
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Right View: Settings Panel */}
                            <div className="w-full md:w-[360px] flex flex-col bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm shrink-0 h-fit md:h-full">
                                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-6">
                                    <button className="flex-1 py-1.5 bg-white dark:bg-[#2d3039] text-[#0b9f84] dark:text-[#10b981] text-sm font-semibold rounded-md shadow-sm transition">{t('create')}</button>
                                    <button
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${generatedImageResults.length > 0 ? 'text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-[#2d3039] hover:text-[#0b9f84] hover:shadow-sm cursor-pointer' : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'}`}
                                        disabled={generatedImageResults.length === 0}
                                        onClick={() => {
                                            if (generatedImageResults.length > 0) {
                                                const currentImage = generatedImageResults[selectedImageIndex];
                                                setPendingEditImage({
                                                    data: currentImage,
                                                    name: `product_${Date.now()}.jpg`,
                                                    mimeType: 'image/jpeg'
                                                });
                                                navigate('/fashion/edit');
                                            }
                                        }}
                                    >{t('editImage')}</button>
                                </div>

                                <div className="relative mb-6">
                                    <textarea
                                        value={generatedPrompt}
                                        onChange={e => setGeneratedPrompt(e.target.value)}
                                        className="w-full h-[180px] md:h-[220px] bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-800 dark:text-gray-200 outline-none resize-none focus:border-[#0b9f84] dark:focus:border-[#0b9f84] transition-colors pr-10"
                                        placeholder={t('describeImageToGenerate')}
                                    />
                                    <div className="absolute right-3 bottom-3 text-gray-400 cursor-pointer hover:text-gray-600">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4 mb-8">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">{t('generationModel')}</label>
                                        <div className="relative">
                                            <select
                                                value={selectedImageModel || backendImageModel}
                                                onChange={(e) => setSelectedImageModel(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-lg py-2.5 px-3 text-sm text-gray-700 dark:text-gray-300 outline-none appearance-none cursor-pointer focus:border-emerald-400"
                                            >
                                                {availableImageModels.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name || m.id}</option>
                                                ))}
                                                {availableImageModels.length === 0 && backendImageModel && (
                                                    <option value={backendImageModel}>{backendImageModel}</option>
                                                )}
                                                {availableImageModels.length === 0 && !backendImageModel && (
                                                    <option value="">{t('noModelAvailable')}</option>
                                                )}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">{t('aspectRatio')}</label>
                                        <div className="relative">
                                            <select
                                                value={aspectRatio}
                                                onChange={e => setAspectRatio(e.target.value)}
                                                className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-lg py-2.5 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none cursor-pointer appearance-none text-left flex gap-2"
                                            >
                                                <option value="1:1">{t('ratioSquare')}</option>
                                                <option value="3:4">{t('ratioVertical')}</option>
                                                <option value="4:3">{t('ratioHorizontal')}</option>
                                                <option value="16:9">{t('ratioWide')}</option>
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className={`mt-auto w-full py-3.5 rounded-xl font-semibold shadow-md transition-all flex justify-center items-center gap-3 ${isGeneratingImage
                                        ? 'bg-[#0b9f84]/80 text-white cursor-wait'
                                        : 'bg-[#0b9f84] hover:bg-[#088b73] text-white'
                                        }`}
                                    onClick={handleGenerateImage}
                                    disabled={isGeneratingImage || !generatedPrompt}
                                >
                                    {isGeneratingImage ? (
                                        <>
                                            <div className="pinterest-loader">
                                                <div className="pin"></div>
                                                <div className="pin"></div>
                                                <div className="pin"></div>
                                            </div>
                                            {t('generating')}
                                        </>
                                    ) : (
                                        <>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                            </svg>
                                            {t('generateBtn')}
                                        </>
                                    )}
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
