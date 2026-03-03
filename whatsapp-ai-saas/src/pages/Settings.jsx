import React from 'react';
import useAppStore from '../store';
import { getTranslation as t } from '../locales';

const Settings = () => {
    const settings = useAppStore(state => state.appSettings) || { theme: 'light', language: 'en', model: 'gemini-1.5-pro', allowAiRead: true };
    const updateSettings = useAppStore(state => state.updateSettings);

    const handleToggle = (key) => {
        updateSettings({ [key]: !settings[key] });
    };

    const handleChange = (key, value) => {
        updateSettings({ [key]: value });
    };

    const language = settings.language || 'en';

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t(language, 'appSettings')}</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Configure your Workspace preferences and AI models.</p>
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

                {/* AI & Copilot settings */}
                <div className="p-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">{t(language, 'aiCopilotDefaults')}</h3>

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-base font-medium text-gray-800 dark:text-gray-100">{t(language, 'llmModel')}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t(language, 'llmModelDesc')}</p>
                        </div>
                        <select
                            value={settings.model}
                            onChange={(e) => handleChange('model', e.target.value)}
                            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none bg-white dark:bg-gray-700 dark:text-white min-w-[200px]"
                        >
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash (Faster)</option>
                            <option value="gpt-4" disabled>GPT-4 (Premium Only)</option>
                            <option value="claude-3" disabled>Claude 3 (Premium Only)</option>
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
