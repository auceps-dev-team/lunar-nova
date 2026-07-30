import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';
import UpdateManager from '../components/UpdateManager';
import CustomSelect from '../components/CustomSelect';
import { API_BASE_URL } from '../config';
import { DEFAULT_MENU_ITEMS } from '../constants/menuItems';

const Settings = () => {
    const { t } = useTranslation();
    const settings = useAppStore(state => state.appSettings) || { theme: 'light', language: 'en', model: 'gemini-pro-latest', allowAiRead: true };
    const updateSettings = useAppStore(state => state.updateSettings);
    const hiddenMenuItems = settings.hiddenMenuItems || [];

    const toggleMenuItem = (id) => {
        const next = hiddenMenuItems.includes(id)
            ? hiddenMenuItems.filter(x => x !== id)
            : [...hiddenMenuItems, id];
        updateSettings({ hiddenMenuItems: next });
    };
    const setZustandBackendSettings = useAppStore(state => state.setBackendSettings);
    const fetchGlobalModels = useAppStore(state => state.fetchGlobalModels);

    const [backendSettings, setBackendSettings] = useState({
        default_ai_provider: 'gemini',
        default_image_provider: 'openai',
        gemini_api_key: '',
        openrouter_api_key: '',
        ollama_api_key: '',
        openai_api_key: '',
        openai_base_url: 'https://integrate.api.nvidia.com/v1',
        default_image_model: '',
        together_api_key: '',
    });
    const aiQuota = useAppStore(state => state.aiQuota);
    const fetchAiQuota = useAppStore(state => state.fetchAiQuota);

    // Liste des modèles disponibles — gérée par le store (fetchGlobalModels gère déjà
    // la résolution séparée chat-provider / image-provider), plus de duplication locale.
    const availableModels = useAppStore(state => state.availableModels);
    const availableChatModels = availableModels.chat;
    const availableImageModels = availableModels.image;
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const showAppNotification = useAppStore(state => state.showAppNotification);

    // Le backend ne renvoie jamais les clés d'API : il indique seulement lesquelles
    // sont déjà enregistrées, pour que le champ vide ne passe pas pour « non configuré ».
    const [secretsSet, setSecretsSet] = useState({});
    const secretPlaceholder = (key, emptyHint = 'placeholderApiKey') =>
        (secretsSet[key] ? t('apiKeyConfigured') : t(emptyHint));

    useEffect(() => {
        fetch(API_BASE_URL + '/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && data.settings) {
                    setBackendSettings(prev => ({ ...prev, ...data.settings }));
                    setSecretsSet(data.secretsSet || {});
                    refreshModels(data.settings);
                } else {
                    refreshModels();
                }
            })
            .catch(err => {
                console.error(err);
                refreshModels();
            })
            .finally(() => {
                fetchAiQuota();
            });
    }, []);

    // Pousse les réglages courants (y compris les changements pas encore sauvegardés)
    // dans le store Zustand, puis relance fetchGlobalModels() — qui gère déjà la
    // résolution séparée chat-provider / image-provider (src/store.js).
    const refreshModels = (overrides = {}) => {
        setIsLoadingModels(true);
        const merged = { ...backendSettings, ...overrides };
        setZustandBackendSettings(merged);
        fetchGlobalModels()
            .then(() => {
                const { chat, image } = useAppStore.getState().availableModels;
                // Auto-sélectionne un modèle valide si celui en cours n'existe plus pour ce provider
                if (chat.length > 0 && !chat.some(m => m.id === settings.model)) {
                    handleChange('model', chat[0].id);
                }
                setBackendSettings(prev => {
                    if (image.length > 0 && !image.some(m => m.id === prev.default_image_model)) {
                        return { ...prev, default_image_model: image[0].id };
                    }
                    if (image.length === 0 && prev.default_image_model) {
                        return { ...prev, default_image_model: '' };
                    }
                    return prev;
                });
            })
            .catch(err => {
                console.error(err);
                showAppNotification(t('noModelAvailable'), 'error');
            })
            .finally(() => setIsLoadingModels(false));
    };

    const handleBackendChange = (key, value) => {
        setBackendSettings(prev => ({ ...prev, [key]: value }));
        if (key === 'default_ai_provider' || key === 'default_image_provider') {
            refreshModels({ [key]: value });
        }
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            await fetch(API_BASE_URL + '/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backendSettings)
            });
            // Sync the saved settings into Zustand so all pages (PhotoShoot, AgentsHub, etc.)
            // immediately see the new provider/model without a full app restart.
            setZustandBackendSettings(backendSettings);
            fetchGlobalModels();

            showAppNotification(t('successSettingsSaved'), "success");
        } catch (err) {
            console.error(err);
            showAppNotification(t('errorSave'), "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = (key) => {
        updateSettings({ [key]: !settings[key] });
    };

    const handleChange = (key, value) => {
        updateSettings({ [key]: value });
    };


    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('appSettings')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('configureWorkspacePreferences')}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleSaveAll}
                        disabled={isSaving}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow transition disabled:opacity-70"
                    >
                        {isSaving ? t('saving') : t('saveSettings')}
                    </button>
                    <Link
                        to="/agents-manager"
                        className="px-4 py-2 bg-[#0b9f84] hover:bg-[#088b73] text-white text-sm font-medium rounded-lg shadow transition"
                    >
                        {t('manageAiAgents')}
                    </Link>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">

                {/* Theme & Display */}
                <div className="p-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">{t('appearance')}</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t('themeMode')}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('themeDesc')}</p>
                        </div>
                        <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                            <button
                                onClick={() => handleChange('theme', 'light')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${settings.theme === 'light' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                {t('light')}
                            </button>
                            <button
                                onClick={() => handleChange('theme', 'dark')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${settings.theme === 'dark' ? 'bg-gray-800 dark:bg-primary text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                {t('dark')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Language Settings */}
                <div className="p-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">{t('localization')}</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t('interfaceLang')}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('interfaceLangDesc')}</p>
                        </div>
                        <CustomSelect
                            value={settings.language}
                            onChange={(v) => handleChange('language', v)}
                            width="w-48"
                            panelWidth="w-48"
                            options={[
                                { value: 'en', label: t('english') },
                                { value: 'fr', label: t('french') },
                                { value: 'es', label: t('spanish') },
                                { value: 'ar', label: t('arabic') },
                            ]}
                        />
                    </div>
                </div>

                {/* AI Providers & Global Configuration */}
                <div className="p-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">{t('aiEngine')}</h3>

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t('defaultProvider')}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('defaultProviderDesc')}</p>
                        </div>
                        <CustomSelect
                            value={backendSettings.default_ai_provider}
                            onChange={(v) => handleBackendChange('default_ai_provider', v)}
                            width="w-64"
                            panelWidth="w-64"
                            options={[
                                { value: 'gemini', label: t('googleGeminiDefault'), description: 'Gemini Flash / Pro · Free tier' },
                                { value: 'openrouter', label: t('openRouterGptClaude'), description: 'GPT-4o, Claude, Mistral…' },
                                { value: 'ollama', label: t('ollamaLocalFree'), description: 'Local · No API key needed' },
                                { value: 'openai', label: t('openAiCompatibleNvidia'), description: 'NVIDIA, Groq, OpenAI...' },
                            ]}
                        />
                    </div>

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t('defaultImageProvider')}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('defaultImageProviderDesc')}</p>
                        </div>
                        <CustomSelect
                            value={backendSettings.default_image_provider || 'openai'}
                            onChange={(v) => handleBackendChange('default_image_provider', v)}
                            width="w-64"
                            panelWidth="w-64"
                            options={[
                                { value: 'gemini', label: t('googleGeminiDefault'), description: 'Imagen · Free tier' },
                                { value: 'openai', label: t('openAiCompatibleNvidia'), description: 'NVIDIA / Together AI' },
                            ]}
                        />
                    </div>

                    <div className="flex flex-col gap-6 mb-8 bg-gray-50 dark:bg-gray-750 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div className="w-1/2">
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('geminiApiKey')}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('configurePersonalKeyForUnlimitedImages')}</p>
                            </div>
                            <div className="w-1/2 flex justify-end">
                                <input
                                    type="password"
                                    placeholder={secretPlaceholder('gemini_api_key')}
                                    value={backendSettings.gemini_api_key || ''}
                                    onChange={(e) => setBackendSettings(prev => ({ ...prev, gemini_api_key: e.target.value }))}
                                    onBlur={() => refreshModels()}
                                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white w-full max-w-[300px]"
                                />
                            </div>
                        </div>

                        {!aiQuota.hasCustomKey && (
                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('freeTierUsage')}</p>
                                    <p className="text-xs font-bold text-primary">{aiQuota.imageUsed} / {aiQuota.imageLimit} {t('images')}</p>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-500 ${aiQuota.imageUsed >= aiQuota.imageLimit * 0.9 ? 'bg-red-500' : aiQuota.imageUsed >= aiQuota.imageLimit * 0.8 ? 'bg-orange-500' : 'bg-primary'}`}
                                        style={{ width: `${Math.min(100, (aiQuota.imageUsed / aiQuota.imageLimit) * 100)}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <p className="text-[10px] text-gray-400">{t('resetEachMonthOnThe5th')}</p>
                                    {aiQuota.imageUsed >= aiQuota.imageLimit && (
                                        <p className="text-[10px] text-red-500 font-medium">{t('quotaExceededWarning')}</p>
                                    )}
                                </div>
                                <p className="text-[11px] text-emerald-500 dark:text-emerald-400 mt-3 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded border border-emerald-100 dark:border-emerald-800/30">
                                    💡 <strong>Tip:</strong> <a href="https://auceps-digital.agency/projects/saas/wacopilote/" target="_blank" rel="noreferrer" className="underline hover:text-emerald-600">{t('getFreeGeminiKeyHere')}</a> {t('toContinueGeneratingImages')}
                                </p>
                            </div>
                        )}
                    </div>


                    {backendSettings.default_ai_provider === 'openrouter' && (
                        <div className="flex items-center justify-between mb-6 bg-gray-50 dark:bg-gray-750 p-4 rounded-lg">
                            <div className="w-1/2">
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('openRouterApiKey')}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('requiredForClaudeOrGpt4o')}</p>
                            </div>
                            <div className="w-1/2 flex justify-end">
                                <input
                                    type="password"
                                    placeholder={secretPlaceholder('openrouter_api_key', 'placeholderOpenRouterKey')}
                                    value={backendSettings.openrouter_api_key || ''}
                                    onChange={(e) => setBackendSettings(prev => ({ ...prev, openrouter_api_key: e.target.value }))}
                                    onBlur={() => refreshModels()}
                                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white w-full max-w-[300px]"
                                />
                            </div>
                        </div>
                    )}

                    {backendSettings.default_ai_provider === 'ollama' && (
                        <div className="flex items-center justify-between mb-6 bg-gray-50 dark:bg-gray-750 p-4 rounded-lg">
                            <div className="w-1/2">
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('ollamaCloudApiKey')}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('leaveBlankForLocalModels')}</p>
                            </div>
                            <div className="w-1/2 flex justify-end">
                                <input
                                    type="password"
                                    placeholder={secretPlaceholder('ollama_api_key')}
                                    value={backendSettings.ollama_api_key || ''}
                                    onChange={(e) => setBackendSettings(prev => ({ ...prev, ollama_api_key: e.target.value }))}
                                    onBlur={() => refreshModels()}
                                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white w-full max-w-[300px]"
                                />
                            </div>
                        </div>
                    )}

                    {backendSettings.default_ai_provider === 'openai' && (
                        <div className="flex flex-col gap-4 mb-6 bg-gray-50 dark:bg-gray-750 p-4 rounded-lg">
                            {/* Main API Key + Base URL */}
                            <div className="flex items-center justify-between">
                                <div className="w-1/2">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('openaiApiKey')}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('nvidiaSingleKeyDesc')}</p>
                                </div>
                                <div className="w-1/2 flex justify-end">
                                    <input
                                        type="password"
                                        placeholder={secretPlaceholder('openai_api_key')}
                                        value={backendSettings.openai_api_key || ''}
                                        onChange={(e) => setBackendSettings(prev => ({ ...prev, openai_api_key: e.target.value }))}
                                        onBlur={() => refreshModels()}
                                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white w-full max-w-[300px]"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="w-1/2">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('openaiBaseUrl')}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Laissez par défaut pour NVIDIA NIM</p>
                                </div>
                                <div className="w-1/2 flex justify-end">
                                    <input
                                        type="text"
                                        placeholder={t('placeholderOpenAiBaseUrl')}
                                        value={backendSettings.openai_base_url || 'https://integrate.api.nvidia.com/v1'}
                                        onChange={(e) => setBackendSettings(prev => ({ ...prev, openai_base_url: e.target.value }))}
                                        onBlur={() => refreshModels()}
                                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white w-full max-w-[300px]"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="w-1/2">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Together AI API Key</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Requis pour Stable Diffusion & Llama Vision (Together)</p>
                                </div>
                                <div className="w-1/2 flex justify-end">
                                    <input
                                        type="password"
                                        placeholder={secretPlaceholder('together_api_key')}
                                        value={backendSettings.together_api_key || ''}
                                        onChange={(e) => setBackendSettings(prev => ({ ...prev, together_api_key: e.target.value }))}
                                        onBlur={() => refreshModels()}
                                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white w-full max-w-[300px]"
                                    />
                                </div>
                            </div>

                        </div>
                    )}

                    {backendSettings.default_ai_provider === 'openai' ? (
                        <>
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t('llmModel')} (Text)</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Pour les conversations textuelles</p>
                                </div>
                                <CustomSelect
                                    value={settings.model}
                                    onChange={(v) => handleChange('model', v)}
                                    width="w-72"
                                    searchable={availableChatModels.filter(m => m.type === 'text').length > 4}
                                    disabled={isLoadingModels}
                                    panelWidth="w-72"
                                    placeholder={isLoadingModels ? t('loading') : t('noModelAvailable')}
                                    options={availableChatModels.filter(m => m.type === 'text').map(m => ({ value: m.id, label: m.name }))}
                                />
                            </div>

                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-base font-medium text-gray-800 dark:text-gray-100">Modèle de Vision (Analyse)</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Pour analyser les images</p>
                                </div>
                                <CustomSelect
                                    value={backendSettings.default_vision_model || ''}
                                    onChange={(v) => setBackendSettings(prev => ({ ...prev, default_vision_model: v }))}
                                    width="w-72"
                                    searchable={availableChatModels.filter(m => m.type === 'vision').length > 4}
                                    disabled={isLoadingModels}
                                    panelWidth="w-72"
                                    placeholder={isLoadingModels ? t('loading') : t('noModelAvailable')}
                                    options={availableChatModels.filter(m => m.type === 'vision').map(m => ({ value: m.id, label: m.name }))}
                                />
                            </div>

                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-base font-medium text-gray-800 dark:text-gray-100">Modèle de Génération (Text-to-Image)</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Pour générer de nouvelles images</p>
                                </div>
                                <CustomSelect
                                    value={backendSettings.default_image_generate_model || ''}
                                    onChange={(v) => setBackendSettings(prev => ({ ...prev, default_image_generate_model: v }))}
                                    width="w-72"
                                    searchable={availableImageModels.filter(m => m.type === 'image-generate').length > 4}
                                    disabled={isLoadingModels}
                                    panelWidth="w-72"
                                    placeholder={isLoadingModels ? t('loading') : t('imageGenerationNotSupported')}
                                    options={availableImageModels.filter(m => m.type === 'image-generate').map(m => ({ value: m.id, label: m.name }))}
                                />
                            </div>

                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-base font-medium text-gray-800 dark:text-gray-100">Modèle d'Édition (Image-to-Image)</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Pour modifier une image existante</p>
                                </div>
                                <CustomSelect
                                    value={backendSettings.default_image_edit_model || ''}
                                    onChange={(v) => setBackendSettings(prev => ({ ...prev, default_image_edit_model: v }))}
                                    width="w-72"
                                    searchable={availableImageModels.filter(m => m.type === 'image-edit').length > 4}
                                    disabled={isLoadingModels}
                                    panelWidth="w-72"
                                    placeholder={isLoadingModels ? t('loading') : t('imageGenerationNotSupported')}
                                    options={availableImageModels.filter(m => m.type === 'image-edit').map(m => ({ value: m.id, label: m.name }))}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t('llmModel')}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('llmModelDesc')}</p>
                                </div>
                                <CustomSelect
                                    value={settings.model}
                                    onChange={(v) => handleChange('model', v)}
                                    width="w-72"
                                    searchable={availableChatModels.length > 4}
                                    disabled={isLoadingModels}
                                    panelWidth="w-72"
                                    placeholder={isLoadingModels ? t('loading') : t('noModelAvailable')}
                                    options={availableChatModels.map(m => ({ value: m.id, label: m.name }))}
                                />
                            </div>

                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t('imageGenerationModel')}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('selectModelForVisualCreation')}</p>
                                    <p className="text-xs text-primary/80 mt-1">
                                        Vision ·  Image-Edit &nbsp;—&nbsp; {t('appliedToAllImagePages')}
                                    </p>
                                </div>
                                <CustomSelect
                                    value={backendSettings.default_image_model || ''}
                                    onChange={(v) => setBackendSettings(prev => ({ ...prev, default_image_model: v }))}
                                    width="w-72"
                                    searchable={availableImageModels.length > 4}
                                    disabled={isLoadingModels}
                                    panelWidth="w-72"
                                    placeholder={isLoadingModels ? t('loading') : t('imageGenerationNotSupported')}
                                    options={availableImageModels.map(m => ({ value: m.id, label: m.name }))}
                                />
                            </div>
                        </>
                    )}

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t('allowAiRead')}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('allowAiReadDesc')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleToggle('allowAiRead')}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${settings.allowAiRead ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-600'}`}
                            role="switch"
                            aria-checked={settings.allowAiRead}
                        >
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.allowAiRead ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>

                </div>

                {/* WhatsApp Dynamic Messaging Template */}
                <div className="p-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">{t('dynamicWhatsappMessages')}</h3>
                    <div className="mb-4 flex flex-col gap-1">
                        <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t('quickMessageTemplate')}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('autoGeneratedMessageDesc')}</p>
                    </div>
                    <div>
                        <textarea
                            value={backendSettings.dynamic_message_template || ''}
                            onChange={(e) => setBackendSettings(prev => ({ ...prev, dynamic_message_template: e.target.value }))}
                            rows={4}
                            placeholder={t('helloNameThanksForInterest')}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white mb-3"
                        ></textarea>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{t('availableVariables')}</span>
                            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-primary font-mono select-all">[{t('name')}]</code>
                            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-primary font-mono select-all">[{t('email')}]</code>
                            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-primary font-mono select-all">[{t('address')}]</code>
                        </div>
                    </div>
                </div>

            </div>

            {/* ── Onglets visibles dans la barre latérale ── */}
            <div className="mt-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="mb-5">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t('visibleTabsTitle')}</h3>
                    <p className="text-sm text-gray-500 mt-1">{t('visibleTabsDesc')}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {DEFAULT_MENU_ITEMS.map(item => {
                        const isHidden = hiddenMenuItems.includes(item.id);
                        return (
                            <label
                                key={item.id}
                                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                            >
                                <span className={`flex items-center gap-2.5 text-sm font-medium ${isHidden ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">{item.icon}</svg>
                                    {t(item.labelKey)}
                                </span>
                                <input
                                    type="checkbox"
                                    checked={!isHidden}
                                    onChange={() => toggleMenuItem(item.id)}
                                    className="size-4 shrink-0 rounded text-primary focus:ring-primary/50 border-gray-300 cursor-pointer"
                                />
                            </label>
                        );
                    })}
                </div>

                {hiddenMenuItems.length > 0 && (
                    <button
                        onClick={() => updateSettings({ hiddenMenuItems: [] })}
                        className="mt-4 text-xs font-medium text-primary hover:underline"
                    >
                        {t('showAllTabs')}
                    </button>
                )}

                <p className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500">
                    {t('visibleTabsNote')}
                </p>
            </div>

            <div className="mt-6">
                <UpdateManager />
            </div>
        </div>
    );
};

export default Settings;
