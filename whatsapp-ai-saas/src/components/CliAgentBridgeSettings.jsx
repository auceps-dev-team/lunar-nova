import React, { useState, useEffect } from 'react';
import { Terminal, Cpu, Copy, Check, Play, RefreshCw, ShieldCheck, ExternalLink, Code } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import useAppStore from '../store';

const CliAgentBridgeSettings = () => {
    const { t } = useTranslation();
    const showAppNotification = useAppStore(state => state.showAppNotification);

    const [statusData, setStatusData] = useState(null);
    const [mcpConfigData, setMcpConfigData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [copiedMcp, setCopiedMcp] = useState(false);
    const [copiedCmd, setCopiedCmd] = useState(null);

    // Test console state
    const [testAgent, setTestAgent] = useState('copywriter');
    const [testPrompt, setTestPrompt] = useState('Rédige une phrase d\'accroche percutante pour tester le bridge CLI.');
    const [isRunningTest, setIsRunningTest] = useState(false);
    const [testOutput, setTestOutput] = useState(null);

    const loadCliStatus = async () => {
        try {
            const [statusRes, mcpRes] = await Promise.all([
                fetch(API_BASE_URL + '/api/cli/status'),
                fetch(API_BASE_URL + '/api/cli/mcp-config')
            ]);
            if (statusRes.ok) {
                const sData = await statusRes.json();
                setStatusData(sData);
            }
            if (mcpRes.ok) {
                const mData = await mcpRes.json();
                setMcpConfigData(mData);
            }
        } catch (err) {
            console.error('[CliBridgeUI] Erreur chargement status CLI:', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadCliStatus();
    }, []);

    const handleRefresh = () => {
        setIsRefreshing(true);
        loadCliStatus();
    };

    const handleCopyMcp = () => {
        if (!mcpConfigData?.formattedString) return;
        navigator.clipboard.writeText(mcpConfigData.formattedString);
        setCopiedMcp(true);
        showAppNotification?.('success', t('mcpConfigCopied') || 'Configuration MCP copiée dans le presse-papier !');
        setTimeout(() => setCopiedMcp(false), 2500);
    };

    const handleCopyCommand = (cmdText, cmdId) => {
        navigator.clipboard.writeText(cmdText);
        setCopiedCmd(cmdId);
        setTimeout(() => setCopiedCmd(null), 2000);
    };

    const handleRunTest = async () => {
        if (!testPrompt.trim()) return;
        setIsRunningTest(true);
        setTestOutput(null);

        try {
            const res = await fetch(API_BASE_URL + '/api/ai/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent: testAgent,
                    message: testPrompt,
                    promptFormat: 'text'
                })
            });
            const data = await res.json();
            setTestOutput(data);
        } catch (err) {
            setTestOutput({ success: false, error: err.message });
        } finally {
            setIsRunningTest(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-gray-50/50 to-white dark:from-gray-800 dark:to-gray-750">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
                        <Terminal size={22} className="stroke-[2.2]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                {t('cliBridgeTitle') || 'Bridge CLI & Protocoles Agentiques (MCP)'}
                            </h3>
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                v{statusData?.version || '1.46.0'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {t('cliBridgeDesc') || 'Pilotez WaCopilote depuis votre terminal / Claude / Cursor ou déléguez aux CLI de votre machine.'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing || isLoading}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                    {t('refreshDetection') || 'Rafraîchir les outils'}
                </button>
            </div>

            <div className="p-6 space-y-8">
                {/* ── Section 1 : Inbound (Piloter WaCopilote par CLI) ── */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Cpu size={16} className="text-primary" />
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                            {t('inboundCliHeading') || '1. Contrôler WaCopilote depuis la Ligne de Commande & Serveurs MCP'}
                        </h4>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                        {t('inboundCliExplanation') || 'Le binaire `wacopilote` permet d\'invoquer les 27 agents directement depuis n\'importe quel terminal, script bash/powershell, ou d\'intégrer WaCopilote dans vos outils agentiques via le standard MCP (Model Context Protocol).'}
                    </p>

                    {/* Commandes Clés */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        {[
                            { id: 'list', title: t('cmdListTitle') || 'Lister les 27 agents', cmd: 'node bin/wacopilote.js list-agents' },
                            { id: 'run', title: t('cmdRunTitle') || 'Appeler un agent', cmd: 'node bin/wacopilote.js run --agent copywriter --prompt "Ton prompt ici"' },
                            { id: 'pipe', title: t('cmdPipeTitle') || 'Piping Unix / Fichier', cmd: 'cat brief.txt | node bin/wacopilote.js run --agent outbound_strategist --json' },
                            { id: 'mcp', title: t('cmdMcpTitle') || 'Serveur MCP stdio', cmd: 'node bin/wacopilote.js mcp' }
                        ].map((c) => (
                            <div key={c.id} className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700/80 flex flex-col justify-between">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{c.title}</span>
                                    <button
                                        onClick={() => handleCopyCommand(c.cmd, c.id)}
                                        className="text-gray-400 hover:text-primary transition-colors p-1"
                                        title={t('copyCommand') || 'Copier la commande'}
                                    >
                                        {copiedCmd === c.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <code className="text-[11px] bg-gray-100 dark:bg-gray-800 text-primary dark:text-primary-light p-2 rounded-lg font-mono break-all select-all">
                                    {c.cmd}
                                </code>
                            </div>
                        ))}
                    </div>

                    {/* Bloc Configuration MCP */}
                    <div className="bg-gray-900 text-gray-100 rounded-xl p-4 border border-gray-800 shadow-inner">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Code size={16} className="text-emerald-400" />
                                <span className="text-xs font-semibold text-emerald-400">
                                    {t('mcpConfigTitle') || 'Configuration MCP pour Cursor / Claude Code / Antigravity'}
                                </span>
                            </div>
                            <button
                                onClick={handleCopyMcp}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors"
                            >
                                {copiedMcp ? <Check size={13} /> : <Copy size={13} />}
                                {copiedMcp ? (t('copied') || 'Copié !') : (t('copyMcpConfig') || 'Copier la config')}
                            </button>
                        </div>
                        <pre className="text-[11px] font-mono bg-black/40 p-3 rounded-lg overflow-x-auto text-emerald-200/90 leading-relaxed">
                            {mcpConfigData?.formattedString || '{\n  "mcpServers": {\n    "wacopilote": {\n      "command": "node",\n      "args": [".../bin/wacopilote.js", "mcp"]\n    }\n  }\n}'}
                        </pre>
                    </div>
                </div>

                {/* ── Section 2 : Outbound (Délégation aux CLI de la machine) ── */}
                <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck size={16} className="text-primary" />
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                            {t('outboundCliHeading') || '2. Outils & CLI Détectés sur votre Machine'}
                        </h4>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                        {t('outboundCliExplanation') || 'WaCopilote inspecte votre environnement local pour déléguer des tâches complexes aux agents autonomes ou utilitaires installés.'}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                        {(statusData?.installedClis || [
                            { command: 'gemini', installed: false },
                            { command: 'claude', installed: false },
                            { command: 'ollama', installed: false },
                            { command: 'python', installed: false },
                            { command: 'node', installed: true, version: 'v20.x' },
                            { command: 'git', installed: true, version: 'git' }
                        ]).map((cli) => (
                            <div
                                key={cli.command}
                                className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${cli.installed
                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                                    : 'bg-gray-50 dark:bg-gray-900/60 border-gray-100 dark:border-gray-800'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide">
                                        {cli.command}
                                    </span>
                                    <span className={`size-2 rounded-full ${cli.installed ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                </div>
                                <span className={`text-[10px] truncate ${cli.installed ? 'text-emerald-700 dark:text-emerald-300 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                                    {cli.installed ? (cli.version || 'Installé') : (t('notDetected') || 'Non détecté')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Section 3 : Console de Test Rapide ── */}
                <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-3">
                        <Play size={16} className="text-primary" />
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                            {t('cliTestHeading') || '3. Console de Test Rapide du Bridge'}
                        </h4>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-xl border border-gray-100 dark:border-gray-700 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="w-full sm:w-48">
                                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                    {t('selectAgent') || 'Agent à tester :'}
                                </label>
                                <select
                                    value={testAgent}
                                    onChange={(e) => setTestAgent(e.target.value)}
                                    className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="copywriter">Jarvis (SDR Senior)</option>
                                    <option value="creative">Clarisse (DA)</option>
                                    <option value="outbound_strategist">Antoine (Outbound)</option>
                                    <option value="seo_specialist">Romain (SEO)</option>
                                    <option value="growth_hacker">Julien (Growth)</option>
                                    <option value="ella">Ella (Life Architect)</option>
                                </select>
                            </div>

                            <div className="flex-1 min-w-[240px]">
                                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                    {t('testPrompt') || 'Prompt d\'essai :'}
                                </label>
                                <input
                                    type="text"
                                    value={testPrompt}
                                    onChange={(e) => setTestPrompt(e.target.value)}
                                    className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="Entrez votre prompt..."
                                />
                            </div>

                            <div className="self-end">
                                <button
                                    onClick={handleRunTest}
                                    disabled={isRunningTest || !testPrompt.trim()}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-white shadow-sm disabled:opacity-50 transition-all"
                                >
                                    {isRunningTest ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                                    {isRunningTest ? (t('running') || 'Exécution...') : (t('runTest') || 'Tester l\'appel')}
                                </button>
                            </div>
                        </div>

                        {testOutput && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                                    {t('testResult') || 'Réponse de l\'agent :'}
                                </span>
                                <div className="text-xs font-mono bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                                    {testOutput.response || (testOutput.error ? `Erreur: ${testOutput.error}` : JSON.stringify(testOutput, null, 2))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CliAgentBridgeSettings;
