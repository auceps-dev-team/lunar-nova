import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../store';
import { getTranslation as t } from '../locales';

const Settings = () => {
    const settings = useAppStore(state => state.appSettings) || { theme: 'light', language: 'en', model: 'gemini-pro-latest', allowAiRead: true };
    const updateSettings = useAppStore(state => state.updateSettings);

    const [backendSettings, setBackendSettings] = useState({
        default_ai_provider: 'gemini',
        openrouter_api_key: ''
    });
    const [availableModels, setAvailableModels] = useState([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    useEffect(() => {
        fetch('http://localhost:3000/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && data.settings) {
                    setBackendSettings(prev => ({ ...prev, ...data.settings }));
                }
            })
            .catch(console.error)
            .finally(() => fetchModels());
    }, []);

    const fetchModels = () => {
        setIsLoadingModels(true);
        fetch('http://localhost:3000/api/ai/models')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    setAvailableModels(data.models || []);
                }
            })
            .catch(console.error)
            .finally(() => setIsLoadingModels(false));
    };

    const handleBackendChange = async (key, value) => {
        setBackendSettings(prev => ({ ...prev, [key]: value }));
        try {
            await fetch('http://localhost:3000/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value })
            });
            if (key === 'default_ai_provider' || key === 'openrouter_api_key') {
                fetchModels();
            }
        } catch (err) {
            console.error(err);
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
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t(language, 'appSettings')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Configure your Workspace preferences and AI models.</p>
                </div>
                <Link
                    to="/agents-manager"
                    className="px-4 py-2 bg-[#0b9f84] hover:bg-[#088b73] text-white text-sm font-medium rounded-lg shadow transition"
                >
                    Gérer les Agents IA
                </Link>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">

                {/* Theme & Display */}
                <div className="p-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">{t(language, 'appearance')}</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t(language, 'themeMode')}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t(language, 'themeDesc')}</p>
                        </div>
                        <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                            <button
                                onClick={() => handleChange('theme', 'light')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${settings.theme === 'light' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                {t(language, 'light')}
                            </button>
                            <button
                                onClick={() => handleChange('theme', 'dark')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${settings.theme === 'dark' ? 'bg-gray-800 dark:bg-primary text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                {t(language, 'dark')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Language Settings */}
                <div className="p-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">{t(language, 'localization')}</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t(language, 'interfaceLang')}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t(language, 'interfaceLangDesc')}</p>
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
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Moteur d'Intelligence Artificielle</h3>

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-100">Fournisseur par défaut</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Le moteur utilisé pour les interactions générales (Assistive Copilot, etc.)</p>
                        </div>
                        <select
                            value={backendSettings.default_ai_provider}
                            onChange={(e) => handleBackendChange('default_ai_provider', e.target.value)}
                            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white min-w-[200px]"
                        >
                            <option value="gemini">Google Gemini (Défaut)</option>
                            <option value="openrouter">OpenRouter (GPT-4, Claude)</option>
                            <option value="ollama">Ollama (Local / Gratuit)</option>
                        </select>
                    </div>

                    {backendSettings.default_ai_provider === 'openrouter' && (
                        <div className="flex items-center justify-between mb-6 bg-gray-50 dark:bg-gray-750 p-4 rounded-lg">
                            <div className="w-1/2">
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Clé API OpenRouter</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Requis pour utiliser Claude 3.5 ou GPT-4o via OpenRouter.</p>
                            </div>
                            <div className="w-1/2 flex justify-end">
                                <input
                                    type="password"
                                    placeholder="sk-or-v1-..."
                                    value={backendSettings.openrouter_api_key || ''}
                                    onChange={(e) => setBackendSettings(prev => ({ ...prev, openrouter_api_key: e.target.value }))}
                                    onBlur={(e) => handleBackendChange('openrouter_api_key', e.target.value)}
                                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white w-full max-w-[300px]"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t(language, 'llmModel')}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t(language, 'llmModelDesc')}</p>
                        </div>
                        <select
                            value={settings.model}
                            onChange={(e) => handleChange('model', e.target.value)}
                            disabled={isLoadingModels}
                            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white min-w-[200px] disabled:opacity-50"
                        >
                            {isLoadingModels ? (
                                <option value="">Chargement...</option>
                            ) : availableModels.length > 0 ? (
                                availableModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))
                            ) : (
                                <option value={settings.model}>{settings.model}</option>
                            )}
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t(language, 'allowAiRead')}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t(language, 'allowAiReadDesc')}</p>
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
            </div>
        </div>
    );
};

export default Settings;
