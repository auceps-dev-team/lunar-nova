const db = require('../db');
const { detectInstalledClis, executeExternalCli } = require('./externalAgentRunner');

// Services IA
const geminiService = require('../geminiService');
const openrouterService = require('../openrouterService');
const ollamaService = require('../ollamaService');
const openaiService = require('../openaiService');

function getNvidiaModels() {
    try {
        delete require.cache[require.resolve('../nvidiaModels')];
    } catch {
        // ignore
    }
    return require('../nvidiaModels');
}

/**
 * Détecte si une chaîne d'erreur correspond à un problème de clé API manquante ou invalide.
 * @param {string} str 
 * @returns {boolean}
 */
function isKeyConfigurationError(str) {
    if (!str || typeof str !== 'string') return false;
    const lower = str.toLowerCase();
    return (
        lower.includes('api key not configured') ||
        lower.includes('api key not valid') ||
        lower.includes('clé api non configurée') ||
        lower.includes('missing api key') ||
        lower.includes('no api key') ||
        lower.includes('insufficient credits') ||
        lower.includes('unsupported state or unable to authenticate') ||
        lower.includes('invalid api key')
    );
}

/**
 * Récupère l'état de disponibilité en temps réel de tous les canaux LLM (API, CLI, MCP).
 */
async function getExecutionChannelsStatus() {
    const strategy = await db.getSetting('ai_execution_strategy', 'auto');
    const autoFallback = (await db.getSetting('auto_fallback_enabled', 'true')) !== 'false';
    const defaultCliAgent = await db.getSetting('default_cli_agent', 'gemini');

    const geminiKey = (await db.getSetting('gemini_api_key', '')) || process.env.GEMINI_API_KEY || '';
    const openrouterKey = (await db.getSetting('openrouter_api_key', '')) || process.env.OPENROUTER_API_KEY || '';
    const openaiKey = (await db.getSetting('openai_api_key', '')) || process.env.NVIDIA_API_KEY || '';
    const ollamaKey = (await db.getSetting('ollama_api_key', '')) || '';

    let installedClis = [];
    try {
        installedClis = await detectInstalledClis();
    } catch {
        installedClis = [];
    }

    const isInstalled = (cmd) => Boolean(installedClis.find(c => c.command === cmd && c.installed));

    return {
        strategy,
        autoFallback,
        defaultCliAgent,
        channels: {
            geminiApi: Boolean(geminiKey) || true,
            openrouterApi: Boolean(openrouterKey),
            openaiApi: Boolean(openaiKey),
            ollamaApi: true,
            geminiCli: isInstalled('gemini') || isInstalled('gemini-cli'),
            claudeCli: isInstalled('claude'),
            ollamaCli: isInstalled('ollama')
        },
        installedClis
    };
}

/**
 * Exécute un appel unitaire sur un fournisseur / canal donné.
 */
async function invokeSingleProvider({
    provider,
    model,
    personaId,
    message,
    imageParams,
    attachments,
    promptFormat,
    messages,
    currentTasks,
    isRealTime,
    dbAgent
}) {
    let effectiveAgent = dbAgent;
    const orchestrator = require('../agents/orchestrator');
    const persona = orchestrator.getPersona(personaId) || orchestrator.getPersona('copilot') || orchestrator.getPersona('creative');

    if (model) {
        if (effectiveAgent) {
            effectiveAgent = { ...effectiveAgent, model_override: model };
        } else if (persona) {
            effectiveAgent = {
                model_override: model,
                system_instruction: persona.systemInstruction,
                response_format: orchestrator.requiresJsonFormat(personaId) ? 'json' : promptFormat
            };
        }
    } else if (!effectiveAgent && persona) {
        effectiveAgent = {
            system_instruction: persona.systemInstruction,
            response_format: orchestrator.requiresJsonFormat(personaId) ? 'json' : promptFormat
        };
    }

    // ── 1. Exécution CLI ──
    if (provider === 'cli') {
        const cliCommand = model || (await db.getSetting('default_cli_agent', 'gemini')) || 'gemini';
        const systemPrompt = persona ? `[Système: ${persona.systemInstruction}]\n\n` : '';
        const fullPrompt = `${systemPrompt}${message || ''}`;

        let args = [];
        if (cliCommand === 'claude') {
            args = ['-p', fullPrompt];
        } else {
            args = [fullPrompt];
        }

        const result = await executeExternalCli({
            command: cliCommand,
            args,
            input: fullPrompt,
            timeout: 30000
        });

        if (!result.success && !result.stdout) {
            throw new Error(result.error || `Échec d'exécution du CLI '${cliCommand}'`);
        }

        const textOutput = (result.stdout || result.stderr || '').trim();
        return { response: textOutput };
    }

    // ── 2. Exécution OpenRouter ──
    if (provider === 'openrouter') {
        const apiKey = await db.getSetting('openrouter_api_key', '');
        if (!apiKey && !process.env.OPENROUTER_API_KEY) {
            throw new Error('OpenRouter API key not configured in settings.');
        }
        return await openrouterService.chatWithAgent(
            personaId,
            message,
            imageParams,
            promptFormat,
            apiKey,
            effectiveAgent,
            messages,
            currentTasks,
            isRealTime
        );
    }

    // ── 3. Exécution Ollama ──
    if (provider === 'ollama') {
        const apiKey = await db.getSetting('ollama_api_key', '');
        return await ollamaService.chatWithAgent(
            personaId,
            message,
            imageParams,
            promptFormat,
            effectiveAgent,
            apiKey,
            messages,
            currentTasks,
            isRealTime
        );
    }

    // ── 4. Exécution OpenAI / NVIDIA ──
    if (provider === 'openai') {
        const nvidiaModels = getNvidiaModels();
        const selectedModel = model || dbAgent?.model_override || (await db.getSetting('default_chat_model', ''));
        const apiKey = await nvidiaModels.resolveKey(selectedModel, db.getSetting.bind(db));

        if (!apiKey) {
            throw new Error('OpenAI/NVIDIA API key not configured in settings.');
        }

        let baseURL = await db.getSetting('openai_base_url', nvidiaModels.NVIDIA_BASE_URL);
        const def = nvidiaModels.getModelDef(selectedModel);
        if (def && def.provider === 'together') {
            baseURL = 'https://api.together.xyz/v1';
        }

        return await openaiService.chatWithAgent(
            personaId,
            message,
            imageParams,
            promptFormat,
            apiKey,
            baseURL,
            effectiveAgent
        );
    }

    // ── 5. Exécution Gemini (Défaut) ──
    return await geminiService.chatWithAgent(
        personaId,
        message,
        imageParams,
        attachments,
        promptFormat,
        effectiveAgent,
        messages,
        currentTasks,
        isRealTime
    );
}

/**
 * Exécute un appel agentique avec cascade de repli intelligente.
 */
async function executeAgentWithFallback(params) {
    const {
        personaId,
        message,
        imageParams,
        attachments,
        promptFormat,
        messages = null,
        currentTasks = null,
        isRealTime = false,
        modelOverride = null,
        providerOverride = null,
        dbAgent = null
    } = params;

    const status = await getExecutionChannelsStatus();
    const strategy = status.strategy;
    const autoFallback = status.autoFallback;

    // Détermination de la cible initiale
    let targetProvider = providerOverride || (dbAgent && dbAgent.provider_override) || (await db.getSetting('default_ai_provider', 'gemini'));
    let targetModel = modelOverride || (dbAgent && dbAgent.model_override) || null;

    if (strategy === 'cli') {
        targetProvider = 'cli';
        targetModel = status.defaultCliAgent || 'gemini';
    }

    // Construction de la cascade ordonnée de tentatives
    const attempts = [];

    // Tentative 1 : Fournisseur configuré
    attempts.push({ provider: targetProvider, model: targetModel, reason: 'fournisseur configuré' });

    if (autoFallback) {
        // Si le fournisseur configuré est OpenAI / NVIDIA sans clé, basculer immédiatement sur Gemini
        if (targetProvider !== 'gemini') {
            attempts.push({ provider: 'gemini', model: 'gemini-2.5-flash', reason: 'auto-fallback Gemini API' });
        }

        // Si Gemini CLI est installé sur la machine
        if (status.channels.geminiCli && targetProvider !== 'cli') {
            attempts.push({ provider: 'cli', model: 'gemini', reason: 'auto-fallback Google Gemini CLI local' });
        }

        // Si Claude Code CLI est installé
        if (status.channels.claudeCli) {
            attempts.push({ provider: 'cli', model: 'claude', reason: 'auto-fallback Claude Code CLI local' });
        }

        // Si OpenRouter a une clé
        if (status.channels.openrouterApi && targetProvider !== 'openrouter') {
            attempts.push({ provider: 'openrouter', model: null, reason: 'auto-fallback OpenRouter API' });
        }

        // Repli ultime Gemini
        if (targetProvider === 'gemini') {
            if (status.channels.geminiCli) {
                attempts.push({ provider: 'cli', model: 'gemini', reason: 'repli Gemini CLI' });
            }
        }
    }

    let lastError = null;

    for (const attempt of attempts) {
        try {
            const result = await invokeSingleProvider({
                provider: attempt.provider,
                model: attempt.model,
                personaId,
                message,
                imageParams,
                attachments,
                promptFormat,
                messages,
                currentTasks,
                isRealTime,
                dbAgent
            });

            if (result && typeof result === 'object' && result.error && isKeyConfigurationError(result.error)) {
                console.error(`[SmartFallback] ${attempt.reason} (${attempt.provider}) a échoué (clé non configurée). Bascule automatique...`);
                lastError = new Error(result.error);
                continue;
            }

            if (result && typeof result.response === 'string' && isKeyConfigurationError(result.response)) {
                console.error(`[SmartFallback] ${attempt.reason} (${attempt.provider}) réponse rejetée (clé non configurée). Bascule automatique...`);
                lastError = new Error(result.response);
                continue;
            }

            if (attempt.reason !== 'fournisseur configuré') {
                console.error(`[SmartFallback] ✅ Agent '${personaId}' secouru avec succès via ${attempt.reason} (${attempt.provider})`);
            }
            return result;
        } catch (err) {
            console.error(`[SmartFallback] Échec sur ${attempt.reason} (${attempt.provider}) : ${err.message}`);
            lastError = err;
            if (!autoFallback) {
                throw err;
            }
        }
    }

    throw lastError || new Error(`Aucun canal LLM n'a pu répondre pour l'agent '${personaId}'.`);
}

module.exports = {
    getExecutionChannelsStatus,
    executeAgentWithFallback,
    isKeyConfigurationError
};
