import { useTranslation } from 'react-i18next';

/**
 * Modale extraite de src/pages/whatsapp/Contacts.jsx (refactor de découpage —
 * aucun changement de comportement). Les props proviennent du composant parent.
 */
export default function BulkEditModal({ allSegments, bulkSegmentId, handleBulkUpdate, isSubmittingBulk, setBulkSegmentId, setIsBulkEditModalOpen }) {
    const { t } = useTranslation();

    return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('bulkEditSegment')}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('bulkEditSegmentDesc')}</p>
                            </div>
                            <button
                                onClick={() => setIsBulkEditModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <form onSubmit={handleBulkUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('selectNewSegment')}</label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                    value={bulkSegmentId}
                                    onChange={(e) => setBulkSegmentId(e.target.value)}
                                    required
                                >
                                    <option value="">{t('chooseSegment')}</option>
                                    {allSegments.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsBulkEditModalOpen(false)}
                                    className="flex-1 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingBulk}
                                    className="flex-1 text-white bg-[#0b9f84] hover:bg-[#088b73] focus:ring-4 focus:outline-none focus:ring-[#0b9f84]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors disabled:opacity-50"
                                >
                                    {isSubmittingBulk ? t('updating') : t('update')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
    );
}
