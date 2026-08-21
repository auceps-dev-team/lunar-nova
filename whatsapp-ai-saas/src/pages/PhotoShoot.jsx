import React, { useState, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { MODELS, POSES, BACKGROUNDS, getModelInitials, getPoseIcon } from '../constants/photoshootPresets';
import SelectionGrid from '../components/photoshoot/SelectionGrid';



const PhotoShoot = ({ activeId: _activeId }) => {
    // ── State ──
    const [productImages, setProductImages] = useState([]); // up to 3
    const [selectedModel, setSelectedModel] = useState(null);
    const [selectedPose, setSelectedPose] = useState(null);
    const [selectedBackground, setSelectedBackground] = useState(null);
    const [selectedAspectRatio, setSelectedAspectRatio] = useState('3:4');
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [generatedResults, setGeneratedResults] = useState([]);
    const [selectedResultIndex, setSelectedResultIndex] = useState(0);
    const [activeSection, setActiveSection] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);
    const sessionContextRef = useRef(null);
    const fileInputRef = useRef(null);

    const { t } = useTranslation();
    const agentHistory = useAppStore(state => state.agentHistory);
    const addAgentHistory = useAppStore(state => state.addAgentHistory);
    const removeAgentHistory = useAppStore(state => state.removeAgentHistory);
    const historyForAgent = agentHistory.filter(h => h.agentId === 'photoshoot');


    // ── Handlers ──
    const loadHistoryItem = (hist) => {
        if (!hist) return;
        setProductImages(hist.productImages || []);
        setSelectedModel(hist.selectedModel || null);
        setSelectedPose(hist.selectedPose || null);
        setSelectedBackground(hist.selectedBackground || null);
        setGeneratedPrompt(hist.generatedPrompt || '');
        setGeneratedResults(hist.generatedResults || []);
        setSelectedAspectRatio(hist.selectedAspectRatio || '3:4');
        sessionContextRef.current = hist.sessionContext || null;
        setSelectedResultIndex(0);
        setActiveSection(null);
    };

    const clearAllHistory = () => {
        historyForAgent.forEach(h => removeAgentHistory(h.id));
    };
    const handleProductUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const remaining = 3 - productImages.length;
        const toProcess = files.slice(0, remaining);

        toProcess.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProductImages(prev => [...prev, { name: file.name, data: reader.result }].slice(0, 3));
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const removeProduct = (idx) => {
        setProductImages(prev => prev.filter((_, i) => i !== idx));
    };

    // ── Phase 1: Analyze & Generate Strategy ──
    const handleAnalyze = async () => {
        if (productImages.length === 0 || isAnalyzing) return;

        setIsAnalyzing(true);
        setGeneratedPrompt('');
        try {
            const model = selectedModel || MODELS[Math.floor(Math.random() * MODELS.length)];
            const pose  = selectedPose  || POSES[Math.floor(Math.random() * POSES.length)];
            const bg    = selectedBackground || BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

            // ── Mettre à jour l'UI pour afficher les paramètres réellement utilisés
            //    (y compris quand ils ont été sélectionnés aléatoirement)
            setSelectedModel(model);
            setSelectedPose(pose);
            setSelectedBackground(bg);

            // Lock current session context so Phase 2 always uses the same model/pose/bg
            sessionContextRef.current = { model, pose, bg };

            const contextMessage = `I need a professional photoshoot prompt.
<PRODUIT>: Photo of the product in the attached image.
<MODELE>: ${model.name} — ${model.gender}, ${model.desc}
<POSE>: ${pose.name} — ${pose.desc}
<BACKGROUND>: ${bg.name} — ${bg.desc}`;

            const agentRes = await fetch(API_BASE_URL + '/api/ai/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    persona: 'photoshoot',
                    promptFormat: 'json',
                    message: contextMessage,
                    imageParams: {
                        data: productImages[0].data.split(',')[1],
                        mimeType: 'image/jpeg'
                    },
                    // Gemini handles all image analysis for photoshoot
                    provider: 'gemini',
                    model: useAppStore.getState().appSettings?.model
                })
            });
            const agentData = await agentRes.json();

            let optimizedPrompt = '';
            if (agentData.status === 'success' && agentData.response) {
                try {
                    // Strip markdown code fences (e.g., ```json ... ```) that some models add
                    let rawResponse = agentData.response;
                    rawResponse = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

                    const parsed = typeof rawResponse === 'string'
                        ? JSON.parse(rawResponse)
                        : rawResponse;
                    optimizedPrompt = parsed.image_generation_prompt || agentData.response;
                } catch {
                    // If JSON parse fails, use the raw response
                    optimizedPrompt = agentData.response;
                }
            } else if (agentData.error) {
                optimizedPrompt = `[Erreur d'analyse: ${agentData.error}]`;
            }
            setGeneratedPrompt(optimizedPrompt);

            // Persist to history
            addAgentHistory({
                id: Date.now().toString(),
                agentId: 'photoshoot',
                date: new Date().toISOString(),
                productImages: productImages,
                selectedModel: model,
                selectedPose: pose,
                selectedBackground: bg,
                sessionContext: { model, pose, bg },
                generatedPrompt: optimizedPrompt,
                selectedAspectRatio: selectedAspectRatio
            });
        } catch (err) {
            console.error('PhotoShoot analysis error:', err);
        } finally {
            setIsAnalyzing(false);
        }
    };


    // ── Phase 2: Generate Image (Imagen 4) ──
    const handleGenerateImage = async () => {
        if (!generatedPrompt || isGeneratingImage) return;

        setIsGeneratingImage(true);
        try {
            // Build a hard-constraint prefix from the locked session context
            // ⚠️ Language must be moderation-safe (no anatomical references that trigger BFL filter)
            const ctx = sessionContextRef.current;
            const hardConstraints = ctx
                ? `STYLE DIRECTION:\n- Talent: ${ctx.model.desc}\n- Pose: ${ctx.pose.name} — ${ctx.pose.desc}\n- Setting: ${ctx.bg.desc}\n\nEDITORIAL FASHION PROMPT:\n`
                : '';


            const genBody = {
                prompt: hardConstraints + generatedPrompt,
                aspectRatio: selectedAspectRatio,
                imageParams: {
                    data: productImages[0].data.split(',')[1],
                    mimeType: 'image/jpeg'
                },
                mode: 'fashion',
                // Gemini gère exclusivement l'image-to-image pour préserver le produit
                provider: 'gemini',
            };

            const genRes = await fetch(API_BASE_URL + '/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(genBody)
            });

            if (!genRes.ok) {
                const txt = await genRes.text();
                console.error('Generation HTTP error', genRes.status, txt);
                alert(`Generation HTTP error ${genRes.status}: ${txt}`);
                return;
            }

            let genData;
            try {
                genData = await genRes.json();
            } catch (e) {
                const txt = await genRes.text();
                console.error('Failed to parse generation JSON:', e, txt);
                alert(`Generation failed: ${txt}`);
                return;
            }

            if (genData.status === 'success' && genData.imageStore) {
                const b64Data = genData.imageStore.startsWith('data:')
                    ? genData.imageStore
                    : `data:image/jpeg;base64,${genData.imageStore}`;

                setGeneratedResults(prev => [b64Data, ...prev]);
                setSelectedResultIndex(0);

                // Update history item with generated image array
                if (historyForAgent.length > 0) {
                    const latestHistory = historyForAgent[0];
                    const updatedImages = latestHistory.generatedResults
                        ? [b64Data, ...latestHistory.generatedResults]
                        : [b64Data];

                    removeAgentHistory(latestHistory.id);
                    addAgentHistory({
                        ...latestHistory,
                        generatedResults: updatedImages
                    });
                }
            } else {
                const msg = genData.error || t('errorImageGen');
                console.error('Generation failed:', msg);

                const lower = typeof msg === 'string' ? msg.toLowerCase() : '';

                // 1) Handle missing API key as before
                if (lower.includes('api key')) {
                    const openSettings = window.confirm(msg + '\n\nWould you like to open Settings to configure your API key?');
                    if (openSettings) {
                        try {
                            window.history.pushState({}, '', '/settings');
                            window.dispatchEvent(new PopStateEvent('popstate'));
                        } catch {
                            window.location.href = '/settings';
                        }
                    }
                    return;
                }

                // 2) Handle backend 404 (page not found)
                if (lower.includes('404') || lower.includes('page not found')) {
                    let message = 'The backend returned 404 (page not found). This usually means the server route is missing or the server needs to be restarted.';
                    message += '\n\nWould you like to open the server root to inspect logs? (' + API_BASE_URL + '/)';
                    const openRoot = window.confirm(message);
                    if (openRoot) window.open(API_BASE_URL + '/', '_blank');
                    return;
                }

                // Fallback: show raw message
                alert(typeof msg === 'string' ? msg : t('errorImageGen'));
            }
        } catch (err) {
            console.error('PhotoShoot generation error:', err);
        } finally {
            setIsGeneratingImage(false);
        }
    };

    // ── Rendering helpers ──


    // ── RENDER ──
    return (
        <div style={{ display: 'flex', height: '100%', gap: '16px', animation: 'fadeIn 0.3s' }}>
            {/* ─── MAIN CONTENT ─── */}
            <div className="flex-1 overflow-hidden flex bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                {/* ─── LEFT PANEL: Setup ─── */}
                <div className="w-[300px] shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1c23] flex flex-col overflow-y-auto">
                    <div className="p-5 border-b border-gray-100 dark:border-gray-800">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                            {t('readyShootTitle')}
                        </h2>
                    </div>

                    <div className="flex-1 p-4 space-y-5">
                        {/* ── Product Upload ── */}
                        <div>
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('products')}</label>
                            <p className="text-xs text-gray-400 mb-2">{t('uploadUpTo3ProductImages')}</p>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleProductUpload} />

                            <div className="flex items-center gap-2 flex-wrap">
                                {productImages.map((img, idx) => (
                                    <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 group">
                                        <img src={img.data} className="w-full h-full object-cover" alt={img.name} />
                                        <button
                                            onClick={() => removeProduct(idx)}
                                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                ))}
                                {productImages.length < 3 && (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:text-[#0b9f84] hover:border-[#0b9f84] transition"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Recent history strip under Image upload in Setup - Keeping it as requested */}
                        {historyForAgent.length > 0 && (
                            <div className="shrink-0 flex items-center gap-3 overflow-x-auto bg-gray-50 dark:bg-gray-900 border border-gray-100 rounded-xl p-3 shadow-sm dark:border-gray-700">
                                <span className="text-[10px] font-semibold text-gray-500 mr-2 flex items-center gap-1 shrink-0">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    {t('recent')}
                                </span>
                                {historyForAgent.slice(0, 5).map(hist => (
                                    <div key={hist.id} onClick={() => loadHistoryItem(hist)} className="w-10 h-10 shrink-0 rounded-lg border border-gray-200 hover:border-[#0b9f84] cursor-pointer overflow-hidden bg-gray-200 dark:bg-gray-800 transition-all hover:-translate-y-1">
                                        {hist.generatedResults?.[0] ? (
                                            <img src={hist.generatedResults[0]} className="w-full h-full object-cover opacity-90" />
                                        ) : hist.productImages?.[0] && (
                                            <img src={hist.productImages[0].data} className="w-full h-full object-cover opacity-90" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Model Selection ── */}
                        <div>
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">{t('model')}</label>
                            <p className="text-xs text-gray-400 mb-2">{selectedModel ? selectedModel.name : t('random')}</p>
                            <button
                                onClick={() => setActiveSection(activeSection === 'model' ? null : 'model')}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${activeSection === 'model' ? 'border-[#0b9f84] bg-[#0b9f84]/5' : 'border-gray-200 dark:border-gray-700 hover:border-[#0b9f84]/50'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    {selectedModel ? (
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-300 overflow-hidden">
                                            {selectedModel.img ? (
                                                <img src={selectedModel.img} alt={selectedModel.name} className="w-full h-full object-cover" />
                                            ) : (
                                                getModelInitials(selectedModel.name)
                                            )}
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                        </div>
                                    )}
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{t('selectModel')}</span>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>

                        {/* ── Pose Selection ── */}
                        <div>
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">{t('pose')}</label>
                            <p className="text-xs text-gray-400 mb-2">{selectedPose ? selectedPose.name : t('random')}</p>
                            <button
                                onClick={() => setActiveSection(activeSection === 'pose' ? null : 'pose')}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${activeSection === 'pose' ? 'border-[#0b9f84] bg-[#0b9f84]/5' : 'border-gray-200 dark:border-gray-700 hover:border-[#0b9f84]/50'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-500">
                                        {getPoseIcon()}
                                    </div>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{t('selectPose')}</span>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>

                        {/* ── Background Selection ── */}
                        <div>
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">{t('background')}</label>
                            <p className="text-xs text-gray-400 mb-2">{selectedBackground ? selectedBackground.name : t('random')}</p>
                            <button
                                onClick={() => setActiveSection(activeSection === 'background' ? null : 'background')}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${activeSection === 'background' ? 'border-[#0b9f84] bg-[#0b9f84]/5' : 'border-gray-200 dark:border-gray-700 hover:border-[#0b9f84]/50'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    </div>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{t('selectBackground')}</span>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                    </div>



                    {/* ── Aspect Ratio ── */}
                    <div className="px-4 pb-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('aspectRatio')}</p>
                        <div className="flex gap-2">
                            {['1:1', '3:4', '4:3', '9:16'].map(ratio => (
                                <button
                                    key={ratio}
                                    onClick={() => setSelectedAspectRatio(ratio)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selectedAspectRatio === ratio
                                        ? 'bg-emerald-500 text-white border-emerald-500'
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-emerald-400'
                                        }`}
                                >
                                    {ratio}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* ── Analyze Button ── */}
                    <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || productImages.length === 0}
                            className={`w-full py-3.5 rounded-xl font-semibold shadow-md transition-all flex justify-center items-center gap-3 ${isAnalyzing
                                ? 'bg-gradient-to-r from-emerald-500/90 to-teal-500/90 text-white cursor-wait'
                                : productImages.length === 0
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white'
                                }`}
                        >
                            {isAnalyzing ? (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-scan-loupe">
                                        <circle cx="11" cy="11" r="8"></circle>
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
                                    {t('analysisConcept')}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* ─── RIGHT PANEL: Grid / Results ─── */}
                <div className="flex-1 overflow-y-auto bg-[#f8f9fb] dark:bg-[#111318] p-6">
                    {activeSection ? (
                        <SelectionGrid
                            activeSection={activeSection}
                            setActiveSection={setActiveSection}
                            selectedModel={selectedModel}
                            setSelectedModel={setSelectedModel}
                            selectedPose={selectedPose}
                            setSelectedPose={setSelectedPose}
                            selectedBackground={selectedBackground}
                            setSelectedBackground={setSelectedBackground}
                        />
                    ) : (generatedResults.length > 0 || isGeneratingImage) ? (
                        <div className="space-y-6 relative">
                            {/* Premium AI Processing Overlay */}
                            {isGeneratingImage && (
                                <div className="absolute inset-0 z-30 bg-white/60 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl flex items-center justify-center p-4 transition-all duration-300">
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

                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('generateDone')}</h3>
                                <span className="text-xs text-gray-400">{generatedResults.length} {t('results')}{generatedResults.length > 1 ? 's' : ''}</span>
                            </div>

                            {/* Main image display */}
                            <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm" style={{ minHeight: '500px' }}>
                                <img
                                    src={generatedResults[selectedResultIndex]}
                                    alt={t('photoShoot')}
                                    className="w-full h-full object-contain"
                                />
                                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-400"></span> {t('generatedResults')}
                                </div>
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <button
                                        className="w-8 h-8 flex items-center justify-center bg-black/40 backdrop-blur-sm hover:bg-red-500/90 text-white/80 hover:text-white rounded-lg shadow-lg transition-all"
                                        onClick={() => {
                                            const newResults = [...generatedResults];
                                            newResults.splice(selectedResultIndex, 1);
                                            setGeneratedResults(newResults);
                                            if (selectedResultIndex >= newResults.length) {
                                                setSelectedResultIndex(Math.max(0, newResults.length - 1));
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
                                            a.href = generatedResults[selectedResultIndex];
                                            a.download = `photoshoot_${Date.now()}.jpg`;
                                            a.click();
                                        }}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        {t('download')}
                                    </button>
                                </div>

                                {/* Floating card picker */}
                                {generatedResults.length > 1 && (
                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 overflow-x-auto bg-black/50 backdrop-blur-md border border-white/20 rounded-2xl p-2 shadow-2xl z-20">
                                        {generatedResults.map((imgSrc, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => setSelectedResultIndex(idx)}
                                                className={`w-14 h-14 shrink-0 rounded-xl border-2 cursor-pointer overflow-hidden bg-gray-200 dark:bg-gray-800 transition-all hover:-translate-y-1 ${idx === selectedResultIndex
                                                    ? 'border-[#0b9f84] ring-2 ring-[#0b9f84]/50 shadow-lg scale-110'
                                                    : 'border-transparent opacity-80 hover:opacity-100'
                                                    }`}
                                            >
                                                <img src={imgSrc} className="w-full h-full object-cover" alt="" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Generated prompt preview */}
                            {generatedPrompt && (
                                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('generatedPrompt')}</h4>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-4">{generatedPrompt}</p>
                                    {/* Gemini gère l'image-to-image */}
                                    <div className="mt-4 mb-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('generationModel')}</p>
                                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Google Gemini (Image-to-Image)</span>
                                        </div>
                                    </div>
                                    {/* Generate again button */}
                                    <button
                                        onClick={handleGenerateImage}
                                        disabled={isGeneratingImage}
                                        className={`mt-4 w-full py-3 rounded-xl font-semibold shadow-md transition-all flex justify-center items-center gap-3 ${isGeneratingImage
                                            ? 'bg-[#0b9f84]/80 text-white cursor-wait'
                                            : 'bg-[#0b9f84] hover:bg-[#088b73] text-white'
                                            }`}
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
                            )}
                        </div>
                    ) : (generatedPrompt || isAnalyzing) ? (
                        /* Prompt view after analysis, before image generation */
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('strategy')}</h3>
                            </div>

                            {isAnalyzing ? (
                                /* Analysis animation overlay */
                                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 relative overflow-hidden" style={{ minHeight: '300px' }}>
                                    <div className="flex flex-col items-center justify-center h-full gap-6">
                                        <div className="relative w-24 h-24">
                                            {productImages[0] && (
                                                <img src={productImages[0].data} alt={t('analyzingProduct')} className="w-full h-full object-cover rounded-xl opacity-60" />
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500 animate-scan-loupe">
                                                    <circle cx="11" cy="11" r="8"></circle>
                                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{t('analyzingProduct')}</p>
                                            <p className="text-xs text-gray-500">{t('analyzingDesc')}</p>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="w-64 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full animate-progress-indeterminate"></div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('generatedPrompt')}</h4>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{generatedPrompt}</p>
                                    {/* Gemini gère l'image-to-image */}
                                    <div className="mt-4 mb-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{t('generationModel')}</p>
                                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Google Gemini (Image-to-Image)</span>
                                        </div>
                                    </div>
                                    {/* Generate Image button */}
                                    <button
                                        onClick={handleGenerateImage}
                                        disabled={isGeneratingImage}
                                        className={`mt-4 w-full py-3 rounded-xl font-semibold shadow-md transition-all flex justify-center items-center gap-3 ${isGeneratingImage
                                            ? 'bg-[#0b9f84]/80 text-white cursor-wait'
                                            : 'bg-[#0b9f84] hover:bg-[#088b73] text-white'
                                            }`}
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
                            )}
                        </div>
                    ) : (
                        /* Empty state */
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                    <circle cx="12" cy="13" r="4"></circle>
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('readyShootTitle')}</h3>
                            <p className="text-sm text-gray-500 max-w-sm">{t('readyShootDesc')}</p>
                        </div>
                    )}
                </div>

                {/* Right Sidebar - Minimized Agent History Log */}
                <div className={`transition-all duration-300 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col shrink-0 ${isHistoryOpen ? 'w-[260px]' : 'w-[64px] items-center'}`}>
                    <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between w-full gap-2">
                        <div onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="flex items-center gap-2 cursor-pointer hover:opacity-70 flex-1">
                            {isHistoryOpen ? (
                                <>
                                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('recents')}</h2>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
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
                                                <span className="text-xs font-medium text-gray-900 dark:text-white truncate pe-2">
                                                    {hist.selectedModel?.name} • {hist.selectedPose?.name}
                                                </span>
                                            </div>
                                            {hist.generatedResults && hist.generatedResults.length > 0 ? (
                                                <div className="flex gap-1 overflow-hidden h-12">
                                                    {hist.generatedResults.slice(0, 2).map((img, i) => (
                                                        <img key={i} src={img} className="w-1/2 h-full object-cover rounded" />
                                                    ))}
                                                </div>
                                            ) : hist.productImages?.[0] && (
                                                <div className="h-12 w-full rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                                                    <img src={hist.productImages[0].data} alt="thumb" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        hist.generatedResults?.[0] ? (
                                            <img src={hist.generatedResults[0]} alt="thumb" className="w-full h-full object-cover" />
                                        ) : hist.productImages?.[0] ? (
                                            <img src={hist.productImages[0].data} alt="thumb" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px]">IMG</div>
                                        )
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PhotoShoot;
