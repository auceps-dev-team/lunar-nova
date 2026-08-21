import { useTranslation } from 'react-i18next';

/**
 * Onglet extrait de src/pages/AgentsHub.jsx (refactor de découpage — aucun
 * changement de comportement). Les props proviennent du composant parent.
 */
export default function AnalyseTab({ fileInputRef, generatedPrompt, handleGenerateAnalysis, handleImageUpload, historyForAgent, isLoading, loadHistoryItem, productType, selectedImage, setActiveTab, setProductType, setTargetAmbiance, targetAmbiance }) {
    const { t } = useTranslation();

    return (
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
    );
}
