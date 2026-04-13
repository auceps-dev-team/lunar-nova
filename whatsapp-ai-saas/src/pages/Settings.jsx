import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';
import UpdateManager from '../components/UpdateManager';
const Settings = () => {
    const { t } = useTranslation();
    const settings = useAppStore(state => state.appSettings) || { theme: 'light', language: 'en', model: 'gemini-pro-latest', allowAiRead: true };
    const updateSettings = useAppStore(state => state.updateSettings);

    const [backendSettings, setBackendSettings] = useState({
        default_ai_provider: 'gemini',
        gemini_api_key: '',
        openrouter_api_key: '',
        ollama_api_key: '',
        default_image_model: ''
    });
    const aiQuota = useAppStore(state => state.aiQuota);
    const fetchAiQuota = useAppStore(state => state.fetchAiQuota);

    const [availableChatModels, setAvailableChatModels] = useState([]);
    const [availableImageModels, setAvailableImageModels] = useState([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const showAppNotification = useAppStore(state => state.showAppNotification);

    useEffect(() => {
        fetch('http://localhost:3000/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && data.settings) {
                    setBackendSettings(prev => ({ ...prev, ...data.settings }));
                }
            })
            .catch(console.error)
            .finally(() => {
                fetchModels();
                fetchAiQuota();
            });
    }, []);


    const fetchModels = (providerOverride) => {
        setIsLoadingModels(true);
        const provider = providerOverride || backendSettings.default_ai_provider;

        // Pass the API key if it's OpenRouter so we can test it before saving
        const apiKeyParam = provider === 'openrouter' && backendSettings.openrouter_api_key
            ? `&apiKey=${encodeURIComponent(backendSettings.openrouter_api_key)}`
            : '';

        fetch(`http://localhost:3000/api/ai/models?provider=${provider}${apiKeyParam}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    let newChat = [];
                    let newImage = [];
                    if (data.models && data.models.chat) {
                        newChat = data.models.chat;
                        newImage = data.models.image;
                    } else if (Array.isArray(data.models)) {
                        newChat = data.models;
                    }

                    setAvailableChatModels(newChat);
                    setAvailableImageModels(newImage);

                    // Auto-select first model if current is invalid
                    if (newChat.length > 0 && !newChat.some(m => m.id === settings.model)) {
                        handleChange('model', newChat[0].id);
                    }

                    setBackendSettings(prev => {
                        let updatedImageModel = prev.default_image_model;
                        if (newImage.length > 0 && !newImage.some(m => m.id === prev.default_image_model)) {
                            updatedImageModel = newImage[0].id;
                        } else if (newImage.length === 0) {
                            updatedImageModel = '';
                        }
                        return { ...prev, default_image_model: updatedImageModel };
                    });
                }
            })
            .catch(console.error)
            .finally(() => setIsLoadingModels(false));
    };

    const handleBackendChange = (key, value) => {
        setBackendSettings(prev => ({ ...prev, [key]: value }));
        if (key === 'default_ai_provider') {
            fetchModels(value);
        }
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            await fetch('http://localhost:3000/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backendSettings)
            });
            showAppNotification(t('successSettingsSaved'), "success");
            fetchModels();
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

    const language = settings.language || 'en';

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
                        <select
                            value={settings.language}
                            onChange={(e) => handleChange('language', e.target.value)}
                            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white min-w-[150px]"
                        >
                            <option value="en">English (Default)</option>
                            <option value="fr">Français</option>
                            <option value="es">Español</option>
                            <option value="ar">العربية (Arabic)</option>
                        </select>
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
                        <select
                            value={backendSettings.default_ai_provider}
                            onChange={(e) => handleBackendChange('default_ai_provider', e.target.value)}
                            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white min-w-[200px]"
                        >
                            <option value="gemini">{t('googleGeminiDefault')}</option>
                            <option value="openrouter">{t('openRouterGptClaude')}</option>
                            <option value="ollama">{t('ollamaLocalFree')}</option>
                        </select>
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
                                    placeholder={t('placeholderApiKey')}
                                    value={backendSettings.gemini_api_key || ''}
                                    onChange={(e) => setBackendSettings(prev => ({ ...prev, gemini_api_key: e.target.value }))}
                                    onBlur={() => fetchModels()}
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
                                    placeholder={t('placeholderOpenRouterKey')}
                                    value={backendSettings.openrouter_api_key || ''}
                                    onChange={(e) => setBackendSettings(prev => ({ ...prev, openrouter_api_key: e.target.value }))}
                                    onBlur={() => fetchModels()}
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
                                    placeholder={t('placeholderApiKey')}
                                    value={backendSettings.ollama_api_key || ''}
                                    onChange={(e) => setBackendSettings(prev => ({ ...prev, ollama_api_key: e.target.value }))}
                                    onBlur={() => fetchModels()}
                                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white w-full max-w-[300px]"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t('llmModel')}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('llmModelDesc')}</p>
                        </div>
                        <select
                            value={settings.model}
                            onChange={(e) => handleChange('model', e.target.value)}
                            disabled={isLoadingModels}
                            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white min-w-[200px] disabled:opacity-50"
                        >
                            {isLoadingModels ? (
                                <option value="">{t('loading')}</option>
                            ) : availableChatModels.length > 0 ? (
                                availableChatModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))
                            ) : (
                                <option value="" disabled>{t('noModelAvailable')}</option>
                            )}
                        </select>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t('imageGenerationModel')}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('selectModelForVisualCreation')}</p>
                        </div>
                        <select
                            value={backendSettings.default_image_model || ''}
                            onChange={(e) => setBackendSettings(prev => ({ ...prev, default_image_model: e.target.value }))}
                            disabled={isLoadingModels}
                            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white min-w-[200px] disabled:opacity-50"
                        >
                            {isLoadingModels ? (
                                <option value="">{t('loading')}</option>
                            ) : availableImageModels.length > 0 ? (
                                availableImageModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))
                            ) : (
                                <option value="" disabled>{t('imageGenerationNotSupported')}</option>
                            )}
                        </select>
                    </div>

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

            <div className="mt-6">
                <UpdateManager />
            </div>
        </div>
    );
};

export default Settings;
