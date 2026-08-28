import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAppStore from '../store';
import { API_BASE_URL } from '../config';

/**
 * Assistant de première configuration.
 *
 * Il ne demandait auparavant que la langue. L'utilisateur arrivait ensuite sur
 * une application vide, sans instance ni clé d'API, sans savoir par où
 * commencer. Le parcours couvre désormais le minimum nécessaire pour être
 * opérationnel : langue, identité de l'espace de travail, première instance
 * WhatsApp, clé d'IA.
 *
 * Aucune étape n'est bloquante hormis la langue : chacune peut être passée, et
 * tout se reconfigure ensuite dans les Réglages. Un assistant qui retient
 * l'utilisateur en otage fait plus de tort que de bien.
 */

const STEPS = ['language', 'workspace', 'instance', 'apiKey'];

const LANGUAGES = [
    { code: 'fr', flag: '🇫🇷', label: 'Français' },
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'es', flag: '🇪🇸', label: 'Español' },
    { code: 'ar', flag: '🇸🇦', label: 'العربية' },
];

const PROVIDERS = [
    { id: 'gemini', label: 'Google Gemini', settingKey: 'gemini_api_key', hint: 'aistudio.google.com' },
    { id: 'openai', label: 'NVIDIA NIM', settingKey: 'openai_api_key', hint: 'build.nvidia.com' },
    { id: 'openrouter', label: 'OpenRouter', settingKey: 'openrouter_api_key', hint: 'openrouter.ai' },
    { id: 'ollama', label: 'Ollama (local)', settingKey: 'ollama_api_key', hint: null },
];

const OnboardingModal = () => {
    const { t, i18n } = useTranslation();
    const updateSettings = useAppStore(state => state.updateSettings);
    const updateUserProfile = useAppStore(state => state.updateUserProfile);
    const appSettings = useAppStore(state => state.appSettings);
    const instances = useAppStore(state => state.instances) || [];
    const setInstances = useAppStore(state => state.setInstances);

    const [stepIndex, setStepIndex] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    const [selectedLang, setSelectedLang] = useState(appSettings?.language || 'fr');
    const [companyName, setCompanyName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [instanceName, setInstanceName] = useState('');
    const [provider, setProvider] = useState('gemini');
    const [apiKey, setApiKey] = useState('');

    const step = STEPS[stepIndex];
    const isLast = stepIndex === STEPS.length - 1;

    const goNext = () => setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
    const goBack = () => setStepIndex(i => Math.max(i - 1, 0));

    const applyLanguage = () => {
        i18n.changeLanguage(selectedLang);
        updateSettings({ language: selectedLang });
    };

    const createFirstInstance = () => {
        const id = `wa-tab-${Date.now()}`;
        const name = instanceName.trim() || `Instance ${instances.length + 1}`;
        setInstances([
            ...instances,
            { id, name, status: 'offline' },
        ]);
        if (window.electronAPI) window.electronAPI.createInstance(id);
        // Miroir en écriture côté backend (table wa_instances), voir App.jsx.
        fetch(`${API_BASE_URL}/api/wa/instances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, status: 'offline' })
        }).catch(() => { });
    };

    const saveApiKey = async () => {
        if (!apiKey.trim()) return;
        const entry = PROVIDERS.find(p => p.id === provider);
        if (!entry) return;
        try {
            await fetch(`${API_BASE_URL}/api/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    [entry.settingKey]: apiKey.trim(),
                    default_ai_provider: provider,
                }),
            });
        } catch (err) {
            // Le backend peut encore démarrer. On n'interrompt pas la mise en
            // route pour autant : la clé se saisit aussi dans les Réglages.
            console.error('[Onboarding] Enregistrement de la clé impossible :', err);
        }
    };

    /** Termine l'assistant en appliquant ce que l'utilisateur a bien voulu renseigner. */
    const finish = async () => {
        setIsSaving(true);
        applyLanguage();

        if (companyName.trim() || firstName.trim()) {
            updateUserProfile({
                ...(companyName.trim() && { companyName: companyName.trim() }),
                ...(firstName.trim() && { firstName: firstName.trim() }),
            });
        }
        if (instanceName.trim() && instances.length === 0) createFirstInstance();
        await saveApiKey();

        updateSettings({ language: selectedLang, hasCompletedOnboarding: true });
        setIsSaving(false);
    };

    const handlePrimary = async () => {
        if (step === 'language') applyLanguage();
        if (step === 'instance' && instanceName.trim() && instances.length === 0) createFirstInstance();
        if (isLast) await finish();
        else goNext();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
            <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-500">

                {/* Progression */}
                <div className="flex items-center gap-2 mb-8">
                    {STEPS.map((s, i) => (
                        <div
                            key={s}
                            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= stepIndex ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                        />
                    ))}
                </div>

                {step === 'language' && (
                    <>
                        <h2 className="text-2xl font-display font-bold text-gray-900 dark:text-white text-center">
                            {t('onboardWelcomeTitle')}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-6 text-center">
                            {t('onboardLanguageDesc')}
                        </p>
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            {LANGUAGES.map(l => (
                                <button
                                    key={l.code}
                                    onClick={() => setSelectedLang(l.code)}
                                    className={`flex items-center gap-3 p-4 border rounded-xl transition-all ${selectedLang === l.code
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-500/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                                >
                                    <span className="text-2xl">{l.flag}</span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{l.label}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {step === 'workspace' && (
                    <>
                        <h2 className="text-2xl font-display font-bold text-gray-900 dark:text-white text-center">
                            {t('onboardWorkspaceTitle')}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-6 text-center">
                            {t('onboardWorkspaceDesc')}
                        </p>
                        <div className="space-y-4 mb-8">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('onboardCompanyLabel')}</label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={e => setCompanyName(e.target.value)}
                                    placeholder={t('onboardCompanyPlaceholder')}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('onboardFirstNameLabel')}</label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={e => setFirstName(e.target.value)}
                                    placeholder={t('onboardFirstNamePlaceholder')}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                />
                            </div>
                        </div>
                    </>
                )}

                {step === 'instance' && (
                    <>
                        <h2 className="text-2xl font-display font-bold text-gray-900 dark:text-white text-center">
                            {t('onboardInstanceTitle')}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-6 text-center">
                            {t('onboardInstanceDesc')}
                        </p>
                        <div className="space-y-2 mb-4">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('onboardInstanceLabel')}</label>
                            <input
                                type="text"
                                value={instanceName}
                                onChange={e => setInstanceName(e.target.value)}
                                placeholder={t('onboardInstancePlaceholder')}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-8 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                            {t('onboardInstanceNote')}
                        </p>
                    </>
                )}

                {step === 'apiKey' && (
                    <>
                        <h2 className="text-2xl font-display font-bold text-gray-900 dark:text-white text-center">
                            {t('onboardApiKeyTitle')}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-6 text-center">
                            {t('onboardApiKeyDesc')}
                        </p>
                        <div className="space-y-4 mb-6">
                            <div className="grid grid-cols-2 gap-2">
                                {PROVIDERS.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setProvider(p.id)}
                                        className={`p-3 border rounded-xl text-sm font-medium transition-all ${provider === p.id
                                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <div className="space-y-2">
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                    placeholder={t('onboardApiKeyPlaceholder')}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                />
                                {PROVIDERS.find(p => p.id === provider)?.hint && (
                                    <p className="text-xs text-gray-400">
                                        {t('onboardApiKeyHint')} {PROVIDERS.find(p => p.id === provider).hint}
                                    </p>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-8 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                            {t('onboardApiKeyNote')}
                        </p>
                    </>
                )}

                {/* Navigation */}
                <div className="flex items-center gap-3">
                    {stepIndex > 0 && (
                        <button
                            onClick={goBack}
                            disabled={isSaving}
                            className="px-5 py-3.5 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                            {t('onboardBack')}
                        </button>
                    )}
                    <button
                        onClick={handlePrimary}
                        disabled={isSaving}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-emerald-600/20 disabled:opacity-60 disabled:hover:scale-100"
                    >
                        {isSaving ? t('onboardFinishing') : isLast ? t('onboardStart') : t('onboardContinue')}
                    </button>
                </div>

                {stepIndex > 0 && !isLast && (
                    <button
                        onClick={goNext}
                        className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        {t('onboardSkipStep')}
                    </button>
                )}
                {isLast && (
                    <button
                        onClick={finish}
                        disabled={isSaving}
                        className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
                    >
                        {t('onboardSkipAndStart')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default OnboardingModal;
