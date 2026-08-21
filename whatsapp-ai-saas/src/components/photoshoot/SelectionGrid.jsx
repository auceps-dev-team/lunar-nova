import { useTranslation } from 'react-i18next';
import { MODELS, POSES, BACKGROUNDS, CATEGORY_COLORS, getModelInitials, getPoseIcon } from '../../constants/photoshootPresets';

/**
 * Grille de sélection modèle / pose / fond du Studio Photo.
 * Extraite de src/pages/PhotoShoot.jsx (refactor de découpage — aucun
 * changement de comportement). Rend la grille correspondant à activeSection ;
 * renvoie null sinon (l'écran « résultats » est géré par la page).
 */
export default function SelectionGrid({
    activeSection,
    setActiveSection,
    selectedModel,
    setSelectedModel,
    selectedPose,
    setSelectedPose,
    selectedBackground,
    setSelectedBackground,
}) {
    const { t } = useTranslation();

    if (activeSection === 'model') {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('selectAModel')}</h3>
                    <button onClick={() => setActiveSection(null)} className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition">{t('back')}</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {MODELS.map(m => (
                        <div
                            key={m.id}
                            onClick={() => { setSelectedModel(m); setActiveSection(null); }}
                            className={`group relative rounded-2xl border-2 p-4 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg ${selectedModel?.id === m.id
                                ? 'border-[#5468ff] bg-[#5468ff]/5 shadow-md ring-2 ring-[#5468ff]/30'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-[#5468ff]/50'
                                }`}
                        >
                            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center text-2xl font-bold text-gray-500 dark:text-gray-300 mb-3 overflow-hidden">
                                {m.img ? (
                                    <img src={m.img} alt={m.name} className="w-full h-full object-cover" />
                                ) : (
                                    getModelInitials(m.name)
                                )}
                            </div>
                            <div className="text-center">
                                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1 ${CATEGORY_COLORS[m.gender]}`}>{m.gender}</span>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{m.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{m.desc}</p>
                            </div>
                            {selectedModel?.id === m.id && (
                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#5468ff] flex items-center justify-center">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (activeSection === 'pose') {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('selectAPose')}</h3>
                    <button onClick={() => setActiveSection(null)} className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition">{t('back')}</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {POSES.map(p => (
                        <div
                            key={p.id}
                            onClick={() => { setSelectedPose(p); setActiveSection(null); }}
                            className={`group relative rounded-2xl border-2 p-4 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg ${selectedPose?.id === p.id
                                ? 'border-[#5468ff] bg-[#5468ff]/5 shadow-md ring-2 ring-[#5468ff]/30'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-[#5468ff]/50'
                                }`}
                        >
                            <div className="w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-3 overflow-hidden">
                                {p.img ? (
                                    <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                    getPoseIcon()
                                )}
                            </div>
                            <div className="text-center">
                                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1 bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">{t('pose')}</span>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                            </div>
                            {selectedPose?.id === p.id && (
                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#5468ff] flex items-center justify-center">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (activeSection === 'background') {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('selectABackground')}</h3>
                    <button onClick={() => setActiveSection(null)} className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition">{t('back')}</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {BACKGROUNDS.map(b => (
                        <div
                            key={b.id}
                            onClick={() => { setSelectedBackground(b); setActiveSection(null); }}
                            className={`group relative rounded-2xl border-2 p-4 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg ${selectedBackground?.id === b.id
                                ? 'border-[#5468ff] bg-[#5468ff]/5 shadow-md ring-2 ring-[#5468ff]/30'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-[#5468ff]/50'
                                }`}
                        >
                            <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-3 overflow-hidden ${b.category === 'studio' ? 'bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-700 dark:to-gray-600' :
                                b.category === 'outdoor' ? 'bg-gradient-to-br from-green-100 to-emerald-200 dark:from-green-900/30 dark:to-emerald-800/30' :
                                    'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30'
                                }`}>
                                {b.img ? (
                                    <img src={b.img} alt={b.name} className="w-full h-full object-cover" />
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={
                                        b.category === 'studio' ? 'text-gray-500' : b.category === 'outdoor' ? 'text-emerald-600' : 'text-amber-600'
                                    }>
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                        <polyline points="21 15 16 10 5 21"></polyline>
                                    </svg>
                                )}
                            </div>
                            <div className="text-center">
                                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1 ${CATEGORY_COLORS[b.category]}`}>{b.category}</span>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{b.name}</p>
                            </div>
                            {selectedBackground?.id === b.id && (
                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#5468ff] flex items-center justify-center">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Default: show results or empty state (géré par la page)
    return null;
}
