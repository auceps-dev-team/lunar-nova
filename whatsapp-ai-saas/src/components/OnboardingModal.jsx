import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAppStore from '../store';

const OnboardingModal = () => {
    const { i18n } = useTranslation();
    const updateSettings = useAppStore(state => state.updateSettings);
    const appSettings = useAppStore(state => state.appSettings);
    
    // Fallback to local state during the selection
    const [selectedLang, setSelectedLang] = useState(appSettings?.language || 'fr');

    const handleSave = () => {
        i18n.changeLanguage(selectedLang);
        updateSettings({ 
            language: selectedLang,
            hasCompletedOnboarding: true 
        });
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center justify-center mb-6">
                    <div className="size-16 mb-4 flex items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                    </div>
                    <h2 className="text-2xl font-display font-bold text-gray-900 dark:text-white text-center">
                        Bienvenue sur WaCopilote
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                        Pour commencer, veuillez choisir la langue principale de l'interface. / Select your language.
                    </p>
                </div>

                <div className="space-y-4 mb-8">
                    <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-emerald-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🇫🇷</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">Français</span>
                        </div>
                        <input 
                            type="radio" 
                            name="language" 
                            value="fr" 
                            checked={selectedLang === 'fr'}
                            onChange={() => setSelectedLang('fr')}
                            className="w-5 h-5 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                        />
                    </label>

                    <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-emerald-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🇬🇧</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">English</span>
                        </div>
                        <input 
                            type="radio" 
                            name="language" 
                            value="en" 
                            checked={selectedLang === 'en'}
                            onChange={() => setSelectedLang('en')}
                            className="w-5 h-5 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                        />
                    </label>
                </div>

                <button 
                    onClick={handleSave}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-600/20"
                >
                    Continuer / Continue
                </button>
            </div>
        </div>
    );
};

export default OnboardingModal;
