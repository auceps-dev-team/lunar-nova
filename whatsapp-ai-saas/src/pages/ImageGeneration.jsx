import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAppStore from '../store';

// Repli figé : renvoyé par référence, il garde stables les dépendances des hooks.
const EMPTY_ARRAY = [];

const STYLE_PRESETS = [
    { id: 'none', labelKey: 'noStylePreset', icon: '○' },
    { id: 'photorealistic', labelKey: 'stylePhotorealistic', icon: '📷' },
    { id: 'digital-art', labelKey: 'styleDigitalArt', icon: '🎨' },
    { id: 'anime', labelKey: 'styleAnime', icon: '🌸' },
    { id: 'cinematic', labelKey: 'styleCinematic', icon: '🎬' },
    { id: 'minimalist', labelKey: 'styleMinimalist', icon: '◻️' },
    { id: 'fashion', labelKey: 'styleFashion', icon: '👗' },
];

const ASPECT_RATIOS = [
    { id: '1:1', label: '1:1', desc: 'Square' },
    { id: '16:9', label: '16:9', desc: 'Wide' },
    { id: '9:16', label: '9:16', desc: 'Tall' },
    { id: '3:4', label: '3:4', desc: 'Portrait' },
    { id: '4:3', label: '4:3', desc: 'Landscape' },
];

const ImageGeneration = () => {
    const { t } = useTranslation();
    const [prompt, setPrompt] = useState('');
    const [selectedStyle, setSelectedStyle] = useState('none');
    const [selectedRatio, setSelectedRatio] = useState('1:1');
    const [selectedModel, setSelectedModel] = useState('');
    const [selectedProvider, setSelectedProvider] = useState('gemini'); // gemini par défaut (toujours dispo)
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImages, setGeneratedImages] = useState([]);
    const [selectedImageIdx, setSelectedImageIdx] = useState(null);
    const [error, setError] = useState(null);

    // Available NVIDIA/Together text-to-image models
    const availableImageModels = useAppStore(state => state.availableModels?.image) || EMPTY_ARRAY;
    const backendImageModel = useAppStore(state => state.backendSettings?.default_image_model) || '';

    // Auto-select first model if none selected
    React.useEffect(() => {
        if (!selectedModel && availableImageModels.length > 0) {
            setSelectedModel(availableImageModels[0].id);
        } else if (!selectedModel && backendImageModel) {
            setSelectedModel(backendImageModel);
        }
    }, [availableImageModels, backendImageModel, selectedModel]);

    const handleGenerate = async () => {
        if (!prompt.trim() || isGenerating) return;
        setIsGenerating(true);
        setError(null);

        try {
            // Build the enhanced prompt with style
            let enhancedPrompt = prompt.trim();
            if (selectedStyle !== 'none') {
                enhancedPrompt = `[Style: ${selectedStyle}] ${enhancedPrompt}`;
            }

            const body = {
                prompt: enhancedPrompt,
                aspectRatio: selectedRatio,
                mode: 'creative',
            };

            // Si provider NVIDIA/Together, on envoie provider + imageModel
            if (selectedProvider === 'openai') {
                body.provider = 'openai';
                body.imageModel = selectedModel || backendImageModel || undefined;
            } else {
                // Gemini text-to-image (toujours disponible)
                body.provider = 'gemini';
            }

            console.log('[ImageGeneration] Generating with:', body);

            const res = await fetch('http://127.0.0.1:3000/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            console.log('[ImageGeneration] Response:', data);

            if (data.status === 'success' && data.imageStore) {
                const imgSrc = data.imageStore.startsWith('data:')
                    ? data.imageStore
                    : `data:image/jpeg;base64,${data.imageStore}`;
                
                const newEntry = {
                    id: Date.now(),
                    src: imgSrc,
                    prompt: prompt.trim(),
                    style: selectedStyle,
                    ratio: selectedRatio,
                    model: selectedProvider === 'openai' ? selectedModel : 'Gemini',
                    timestamp: new Date().toLocaleString(),
                };
                setGeneratedImages(prev => [newEntry, ...prev]);
                setSelectedImageIdx(0);
            } else {
                setError(data.error || t('errorImageGen'));
            }
        } catch (err) {
            console.error('[ImageGeneration] Error:', err);
            setError(t('errorGenServer'));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = (img) => {
        const link = document.createElement('a');
        link.download = `generated-${img.id}.png`;
        link.href = img.src;
        link.click();
    };

    const handleDeleteImage = (idx) => {
        setGeneratedImages(prev => prev.filter((_, i) => i !== idx));
        if (selectedImageIdx === idx) setSelectedImageIdx(null);
        else if (selectedImageIdx > idx) setSelectedImageIdx(selectedImageIdx - 1);
    };

    return (
        <div className="h-full flex flex-col gap-6 max-w-[1400px] mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                        </div>
                        {t('imageGenPageTitle')}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-[52px]">{t('imageGenPageDesc')}</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">{t('textToImageOnly')}</span>
                </div>
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
                {/* Left Panel — Controls */}
                <div className="w-[380px] shrink-0 flex flex-col gap-4 overflow-y-auto scrollbar-hide pb-4">

                    {/* Provider Toggle */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provider</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSelectedProvider('gemini')}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${
                                    selectedProvider === 'gemini'
                                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/30'
                                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-emerald-400'
                                }`}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                                Google Gemini
                            </button>
                            <button
                                onClick={() => setSelectedProvider('openai')}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${
                                    selectedProvider === 'openai'
                                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/30'
                                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-emerald-400'
                                }`}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                NVIDIA / Together
                            </button>
                        </div>
                    </div>

                    {/* Model Selector — only for NVIDIA/Together */}
                    {selectedProvider === 'openai' && (
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('generationModel')}</label>
                            <div className="relative">
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 px-3 text-sm text-gray-800 dark:text-gray-200 outline-none appearance-none cursor-pointer focus:border-[#0b9f84] transition-colors"
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
                    )}

                    {/* Model Badge — for Gemini */}
                    {selectedProvider === 'gemini' && (
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('generationModel')}</label>
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Google Gemini (Text-to-Image)</span>
                            </div>
                        </div>
                    )}

                    {/* Prompt */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prompt</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={t('promptPlaceholder')}
                            className="w-full h-[140px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-800 dark:text-gray-200 outline-none resize-none focus:border-[#0b9f84] transition-colors"
                            onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleGenerate(); }}
                        />
                        <p className="text-[10px] text-gray-400">Ctrl+Enter {t('generateImage').toLowerCase()}</p>
                    </div>

                    {/* Style Presets */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('stylePreset')}</label>
                        <div className="grid grid-cols-4 gap-2">
                            {STYLE_PRESETS.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedStyle(s.id)}
                                    className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-all ${
                                        selectedStyle === s.id
                                            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 shadow-sm'
                                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-300'
                                    }`}
                                >
                                    <span className="text-base">{s.icon}</span>
                                    <span className="truncate w-full text-center leading-tight">{t(s.labelKey)}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Aspect Ratio */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('aspectRatio')}</label>
                        <div className="flex gap-2">
                            {ASPECT_RATIOS.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => setSelectedRatio(r.id)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                        selectedRatio === r.id
                                            ? 'bg-[#0b9f84] text-white border-[#0b9f84] shadow-md shadow-emerald-500/30'
                                            : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-[#0b9f84]'
                                    }`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all flex justify-center items-center gap-3 ${
                            isGenerating
                                ? 'bg-[#0b9f84] text-white cursor-wait opacity-80'
                                : !prompt.trim()
                                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-[#0b9f84] to-emerald-600 hover:from-[#088b73] hover:to-emerald-700 text-white shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                    >
                        {isGenerating ? (
                            <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                {t('generating')}
                            </>
                        ) : (
                            <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                {t('generateImage')}
                            </>
                        )}
                    </button>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-start gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    )}
                </div>

                {/* Right Panel — Gallery */}
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#0b9f84]"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                            {t('generatedGallery')}
                        </h2>
                        {generatedImages.length > 0 && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">{generatedImages.length} images</span>
                        )}
                    </div>

                    {generatedImages.length === 0 ? (
                        /* Empty State */
                        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-12">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-4">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#0b9f84]"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">{t('noImagesGenerated')}</p>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto scrollbar-hide">
                            {/* Selected Image Preview */}
                            {selectedImageIdx !== null && generatedImages[selectedImageIdx] && (
                                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 relative group">
                                    <img
                                        src={generatedImages[selectedImageIdx].src}
                                        alt="Generated"
                                        className="w-full max-h-[400px] object-contain rounded-xl bg-gray-100 dark:bg-gray-800"
                                    />
                                    <div className="absolute top-5 right-5 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleDownload(generatedImages[selectedImageIdx])}
                                            className="p-2 bg-black/50 backdrop-blur-sm rounded-lg text-white hover:bg-black/70 transition-colors"
                                            title={t('download')}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteImage(selectedImageIdx)}
                                            className="p-2 bg-red-500/50 backdrop-blur-sm rounded-lg text-white hover:bg-red-500/70 transition-colors"
                                            title={t('delete')}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                    {/* Prompt caption */}
                                    <div className="mt-2 px-2 pb-1">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 italic">"{generatedImages[selectedImageIdx].prompt}"</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                                                {generatedImages[selectedImageIdx].model?.split('/').pop() || 'AI'}
                                            </span>
                                            <span className="text-[10px] text-gray-400">{generatedImages[selectedImageIdx].timestamp}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Thumbnail Grid */}
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                {generatedImages.map((img, idx) => (
                                    <div
                                        key={img.id}
                                        onClick={() => setSelectedImageIdx(idx)}
                                        className={`aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:-translate-y-1 hover:shadow-lg ${
                                            selectedImageIdx === idx
                                                ? 'border-[#0b9f84] ring-2 ring-emerald-500/30 shadow-md'
                                                : 'border-transparent hover:border-emerald-300 dark:hover:border-emerald-700'
                                        }`}
                                    >
                                        <img src={img.src} alt="" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageGeneration;
