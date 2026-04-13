import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const AgentManager = () => {
    const { t } = useTranslation();
    const [agents, setAgents] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [currentAgent, setCurrentAgent] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const defaultAgent = {
        id: '',
        name: '',
        system_instruction: '',
        response_format: 'text',
        provider_override: ''
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/agents');
            const data = await res.json();
            if (data.status === 'success') {
                setAgents(data.data);
            }
        } catch (err) {
            console.error("Failed to fetch agents", err);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await fetch('http://localhost:3000/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentAgent)
            });
            await fetchAgents();
            setIsEditing(false);
            setCurrentAgent(null);
        } catch (err) {
            console.error("Failed to save agent", err);
            alert(t('agentSaveError'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('deleteAgentConfirm'))) return;
        try {
            await fetch(`http://localhost:3000/api/agents/${id}`, { method: 'DELETE' });
            await fetchAgents();
        } catch (err) {
            console.error("Failed to delete agent", err);
        }
    };

    const openEditor = (agent = null) => {
        setCurrentAgent(agent || { ...defaultAgent, id: `agent_${Date.now()}` });
        setIsEditing(true);
    };

    return (
        <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('customAiAgents')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('manageAssistantsDesc')}</p>
                </div>
                <button
                    onClick={() => openEditor()}
                    className="px-4 py-2 bg-[#0b9f84] hover:bg-[#088b73] text-white text-sm font-medium rounded-lg shadow transition"
                >
                    {t('createAgent')}
                </button>
            </div>

            {isEditing ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card border border-gray-100 dark:border-gray-700 p-6">
                    <h2 className="text-lg font-semibold mb-4">{currentAgent.id.startsWith('agent_') ? t('newAgent') : t('editAgent')}</h2>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('technicalId')}</label>
                            <input
                                type="text"
                                value={currentAgent.id}
                                onChange={(e) => setCurrentAgent({ ...currentAgent, id: e.target.value })}
                                disabled={!currentAgent.id.startsWith('agent_')}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-gray-50 dark:bg-gray-700 text-sm disabled:opacity-60"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('publicName')}</label>
                            <input
                                type="text"
                                value={currentAgent.name}
                                onChange={(e) => setCurrentAgent({ ...currentAgent, name: e.target.value })}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('systemInstructions')}</label>
                            <textarea
                                value={currentAgent.system_instruction}
                                onChange={(e) => setCurrentAgent({ ...currentAgent, system_instruction: e.target.value })}
                                rows={5}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-sm"
                                required
                            />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('outputFormat')}</label>
                                <select
                                    value={currentAgent.response_format || 'text'}
                                    onChange={(e) => setCurrentAgent({ ...currentAgent, response_format: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-sm"
                                >
                                    <option value="text">{t('freeTextFormat')}</option>
                                    <option value="json">{t('jsonFormat')}</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('forceProvider')}</label>
                                <select
                                    value={currentAgent.provider_override || ''}
                                    onChange={(e) => setCurrentAgent({ ...currentAgent, provider_override: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-sm"
                                >
                                    <option value="">{t('useGlobalDefaultProvider')}</option>
                                    <option value="gemini">{t('forceGoogleGemini')}</option>
                                    <option value="openrouter">{t('forceOpenRouter')}</option>
                                    <option value="ollama">{t('forceOllamaLocal')}</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-4 py-2 bg-[#0b9f84] text-white rounded-lg text-sm font-medium shadow disabled:opacity-70"
                            >
                                {isLoading ? t('saving') : t('saveAgent')}
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {agents.map(agent => (
                        <div key={agent.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex flex-col relative group">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{agent.name}</h3>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${agent.provider_override ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                    }`}>
                                    {agent.provider_override || t('globalProvider')}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-3 flex-1">
                                {agent.system_instruction}
                            </p>
                            <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                                <span className="text-xs text-gray-400 font-mono">{agent.id}</span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditor(agent)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded">
                                        ✏️
                                    </button>
                                    <button onClick={() => handleDelete(agent.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {agents.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                            {t('noCustomAgentFound')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AgentManager;