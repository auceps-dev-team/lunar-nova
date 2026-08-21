import { useTranslation } from 'react-i18next';

/**
 * Onglet extrait de src/pages/AgentsHub.jsx (refactor de découpage — aucun
 * changement de comportement). Les props proviennent du composant parent.
 */
export default function GenerationTab({ activeId, aspectRatio, genFileInputRef, generatedImageResults, generatedPrompt, generationRefImage, handleGenImageUpload, handleGenerateImage, handleUploadToCatalog, isGeneratingImage, isUploadingCatalog, navigate, selectedImageIndex, setAspectRatio, setGeneratedImageResults, setGeneratedPrompt, setGenerationRefImage, setPendingEditImage, setSelectedImageIndex }) {
    const { t } = useTranslation();

    return (
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
                                    <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                                        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Google Gemini (Image-to-Image)</span>
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
    );
}
