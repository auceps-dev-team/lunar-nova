import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import useAppStore from '../store';
import AnalyseTab from '../components/agents/AnalyseTab';
import GenerationTab from '../components/agents/GenerationTab';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';


const AgentsHub = ({ activeId }) => {
    const navigate = useNavigate();
    const [activeAgent] = useState('creative');
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
            const res = await fetch(API_BASE_URL + '/api/ai/agent', {
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
                // Gemini gère exclusivement l'image-to-image pour préserver le produit
                provider: 'gemini',
            };

            // Attach reference image (from gen tab or analysis tab) if available
            const refImg = generationRefImage || selectedImage;
            if (refImg) {
                body.imageParams = {
                    data: refImg.data.split(',')[1],
                    mimeType: 'image/jpeg'
                };
            }

            const res = await fetch(API_BASE_URL + '/api/ai/generate-image', {
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

            // L'endpoint n'injecte que l'image dans le formulaire WhatsApp ; le nom,
            // le prix et la description sont affichés plus bas par le copilote pour
            // que l'utilisateur les colle lui-même. Les envoyer au backend laissait
            // croire qu'il en faisait quelque chose.
            const body = {
                instance_id: activeId,
                productName: productName,
                imageBase64: currentGeneratedImage
            };

            showAppNotification(t('prepWhatsappSend'), "info");

            const res = await fetch(API_BASE_URL + '/api/catalog/upload', {
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

                    {activeTab === 'analyse' && <AnalyseTab
                        fileInputRef={fileInputRef}
                        generatedPrompt={generatedPrompt}
                        handleGenerateAnalysis={handleGenerateAnalysis}
                        handleImageUpload={handleImageUpload}
                        historyForAgent={historyForAgent}
                        isLoading={isLoading}
                        loadHistoryItem={loadHistoryItem}
                        productType={productType}
                        selectedImage={selectedImage}
                        setActiveTab={setActiveTab}
                        setProductType={setProductType}
                        setTargetAmbiance={setTargetAmbiance}
                        targetAmbiance={targetAmbiance} />}

                    {activeTab === 'generation' && <GenerationTab
                        activeId={activeId}
                        aspectRatio={aspectRatio}
                        genFileInputRef={genFileInputRef}
                        generatedImageResults={generatedImageResults}
                        generatedPrompt={generatedPrompt}
                        generationRefImage={generationRefImage}
                        handleGenImageUpload={handleGenImageUpload}
                        handleGenerateImage={handleGenerateImage}
                        handleUploadToCatalog={handleUploadToCatalog}
                        isGeneratingImage={isGeneratingImage}
                        isUploadingCatalog={isUploadingCatalog}
                        navigate={navigate}
                        selectedImageIndex={selectedImageIndex}
                        setAspectRatio={setAspectRatio}
                        setGeneratedImageResults={setGeneratedImageResults}
                        setGeneratedPrompt={setGeneratedPrompt}
                        setGenerationRefImage={setGenerationRefImage}
                        setPendingEditImage={setPendingEditImage}
                        setSelectedImageIndex={setSelectedImageIndex} />}
                </div>
            </div>
        </div>
    );
};

export default AgentsHub;
