import { useTranslation } from 'react-i18next';

/**
 * Modale extraite de src/pages/whatsapp/Contacts.jsx (refactor de découpage —
 * aucun changement de comportement). Les props proviennent du composant parent.
 */
export default function TemplateModal({ handleSaveTemplate, setIsTemplateModalOpen, dynamicTemplate, setDynamicTemplate, isSavingTemplate, insertVariable, templateTextareaRef }) {
    const { t } = useTranslation();

    return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('messageTemplate')}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('configAutoMessage')}</p>
                            </div>
                            <button
                                onClick={() => setIsTemplateModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveTemplate} className="space-y-4">
                            <div>
                                <textarea
                                    ref={templateTextareaRef}
                                    value={dynamicTemplate}
                                    onChange={(e) => setDynamicTemplate(e.target.value)}
                                    rows={5}
                                    placeholder="Bonjour [Nom], merci pour l'intérêt que vous portez à nos services..."
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors outline-none resize-none"
                                ></textarea>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Cliquez pour insérer :</span>
                                    <button type="button" onClick={() => insertVariable('[Nom]')} className="text-[11px] bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-emerald-600 dark:text-emerald-400 font-mono hover:bg-gray-200 dark:hover:bg-zinc-700 transition">[Nom]</button>
                                    <button type="button" onClick={() => insertVariable('[Email]')} className="text-[11px] bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-emerald-600 dark:text-emerald-400 font-mono hover:bg-gray-200 dark:hover:bg-zinc-700 transition">[Email]</button>
                                    <button type="button" onClick={() => insertVariable('[Adresse]')} className="text-[11px] bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-emerald-600 dark:text-emerald-400 font-mono hover:bg-gray-200 dark:hover:bg-zinc-700 transition">[Adresse]</button>
                                </div>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsTemplateModalOpen(false)}
                                    className="flex-1 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingTemplate}
                                    className="flex-1 text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:outline-none focus:ring-emerald-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors disabled:opacity-50"
                                >
                                    {isSavingTemplate ? t('saving') : t('saveTemplate')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
    );
}
