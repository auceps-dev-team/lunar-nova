const db = require('../db');
// Accès par namespace (et non déstructuré) : permet aux tests de substituer
// ces fonctions à chaud (convention du projet — cf. nvidiaModels.test.js,
// contactAgent.test.js : pas de vi.mock sur les modules CommonJS inlinés).
const externalAgentRunner = require('./externalAgentRunner');

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
 * Détecte si une réponse textuelle indique un échec de connexion ou une absence de service.
 * @param {string} text
 * @returns {boolean}
 */
function isOfflineOrErrorResponse(text) {
    if (!text || typeof text !== 'string') return true;
    const lower = text.toLowerCase().trim();
    return (
        lower.startsWith('i am currently offline') ||
        lower.includes('connection error. please try again') ||
        lower.includes('api key not configured') ||
        lower.includes('api key not valid') ||
        lower.includes('error: openai/nvidia api key') ||
        lower.includes('error: api key not valid')
    );
}

/**
 * Récupère l'état de disponibilité en temps réel de tous les canaux LLM (API, CLI, MCP).
 */
async function getExecutionChannelsStatus() {
    const strategy = await db.getSetting('ai_execution_strategy', 'auto');
    const autoFallback = (await db.getSetting('auto_fallback_enabled', 'true')) !== 'false';
    const defaultCliAgent = await db.getSetting('default_cli_agent', 'gemini');

    const rawGeminiKey = (await db.getSetting('gemini_api_key', '')) || process.env.GEMINI_API_KEY || '';
    const hasGeminiKey = Boolean(rawGeminiKey && !rawGeminiKey.includes('your-gemini-api-key') && rawGeminiKey.trim().length > 10);

    const rawOpenrouterKey = (await db.getSetting('openrouter_api_key', '')) || process.env.OPENROUTER_API_KEY || '';
    const hasOpenrouterKey = Boolean(rawOpenrouterKey && !rawOpenrouterKey.includes('your-openrouter-key') && rawOpenrouterKey.trim().length > 10);

    const rawOpenaiKey = (await db.getSetting('openai_api_key', '')) || process.env.NVIDIA_API_KEY || '';
    const hasOpenaiKey = Boolean(rawOpenaiKey && !rawOpenaiKey.includes('your-nvidia-key') && rawOpenaiKey.trim().length > 10);

    let installedClis = [];
    try {
        installedClis = await externalAgentRunner.detectInstalledClis();
    } catch {
        installedClis = [];
    }

    const isInstalled = (cmd) => Boolean(installedClis.find(c => c.command === cmd && c.installed));

    // Le serveur MCP est livré avec l'application (même arborescence) : le
    // canal est disponible dès que le module se résout — vérification à coût
    // nul plutôt qu'un `true` aveugle.
    let mcpServerAvailable = false;
    try {
        require.resolve('../mcp/wacopiloteMcpServer');
        mcpServerAvailable = true;
    } catch {
        mcpServerAvailable = false;
    }

    // C4 : les lectures de clés ci-dessus (db.getSetting → decrypt) ont pu
    // échouer silencieusement si la clé maître ne correspond plus aux secrets
    // stockés — sans cela, les canaux API apparaissent simplement « sans clé »
    // et l'utilisateur ne sait pas qu'il doit ressaisir ses clés. L'état de
    // dégradation du chiffrement remonte avec le statut des canaux.
    const { getDecryptionStatus } = require('../secretStore');
    const decryption = getDecryptionStatus();

    return {
        strategy,
        autoFallback,
        defaultCliAgent,
        // C4 : true = au moins un secret stocké est illisible pour ce processus.
        secretsDegraded: decryption.degraded,
        secretsDegradedAt: decryption.failedAt,
        channels: {
            geminiApi: hasGeminiKey,
            openrouterApi: hasOpenrouterKey,
            openaiApi: hasOpenaiKey,
            ollamaApi: true,
            geminiCli: isInstalled('gemini') || isInstalled('gemini-cli'),
            claudeCli: isInstalled('claude'),
            ollamaCli: isInstalled('ollama'),
            mcpServer: mcpServerAvailable
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

    // ── 0. Exécution MCP (serveur local in-process) ──
    // La stratégie « mcp » emprunte exactement le chemin produit des clients
    // MCP externes (Cursor, Claude Code) : le tool `call_agent` du serveur
    // stdio, appelé ici en process. La garde de réentrance du routeur
    // transforme l'appel imbriqué (call_agent → chatWithAgent → routeur) en
    // exécution directe du fournisseur par défaut — voir executeAgentWithFallback.
    if (provider === 'mcp') {
        const { handleToolCall } = require('../mcp/wacopiloteMcpServer');
        const result = await handleToolCall('call_agent', {
            agent: personaId,
            prompt: message,
            provider: null,
            model: model || null
        });
        const response = (result && typeof result.response === 'string')
            ? result.response
            : JSON.stringify(result ?? null);
        if (!response || isOfflineOrErrorResponse(response)) {
            throw new Error(`Le canal MCP n'a pas produit de réponse exploitable pour '${personaId}'.`);
        }
        return { response };
    }

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
        } else if (cliCommand === 'gemini' || cliCommand === 'gemini-cli') {
            args = ['-p', fullPrompt, '-o', 'text'];
        } else if (cliCommand === 'ollama') {
            args = ['run', 'llama3', fullPrompt];
        } else {
            args = [fullPrompt];
        }

        const rawGeminiKey = (await db.getSetting('gemini_api_key', '')) || process.env.GEMINI_API_KEY || '';

        // Workspace Trust (C3) : depuis le durcissement GHSA-wpqr-6v78-jr5g
        // (gemini-cli 0.39.1+), le mode headless refuse un dossier de travail
        // non trusté (FatalUntrustedWorkspaceError) même avec une clé valide.
        // On passe la VARIABLE D'ENVIRONNEMENT et non le flag --skip-trust :
        // les gemini-cli 0.38.x rejettent ce flag inconnu (« Unknown arguments:
        // skip-trust », exit non nul) et brûleraient toute la cascade, tandis
        // que la variable est ignorée silencieusement par les versions qui
        // n'en ont pas besoin. Scopée au seul canal gemini : le cwd d'exécution
        // est le dossier contrôlé de l'application, pas un dépôt arbitraire.
        const isGeminiCli = cliCommand === 'gemini' || cliCommand === 'gemini-cli';

        const result = await externalAgentRunner.executeExternalCli({
            command: cliCommand,
            args,
            input: '',
            env: {
                ...process.env,
                ...(rawGeminiKey ? { GEMINI_API_KEY: rawGeminiKey } : {}),
                ...(isGeminiCli ? { GEMINI_CLI_TRUST_WORKSPACE: 'true' } : {})
            },
            timeout: 35000
        });

        if (!result.success && !result.stdout) {
            // Observabilité (C1) : stderr porte la raison réelle de l'échec du
            // binaire (authentification Gemini, workspace non trusté, Node
            // trop ancien…). Auparavant capturé puis jeté : seul un message
            // générique remontait, masquant le diagnostic. La dernière ligne
            // non vide est généralement l'erreur ; bornée à 300 caractères.
            const stderrHint = ((result.stderr || '').trim().split('\n').filter(Boolean).pop()) || '';
            const detail = result.error
                || (stderrHint ? `CLI '${cliCommand}' : ${stderrHint.slice(0, 300)}` : '')
                || `Échec d'exécution du CLI '${cliCommand}'`;
            throw new Error(detail);
        }

        let textOutput = (result.stdout || result.stderr || '').trim();
        if (textOutput.startsWith('Warning: no stdin data')) {
            textOutput = textOutput.replace(/^Warning: no stdin data[^\n]*\n?/, '').trim();
        }
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
// Garde de réentrance : le canal MCP re-passe par aiController.chatWithAgent
// (c'est exactement le chemin qu'empruntent les clients MCP externes). Sans
// cette garde, une stratégie « mcp » bouclerait à l'infini :
// routeur → MCP → chatWithAgent → routeur → … En réentrée, le routeur
// délègue l'exécution directe au fournisseur par défaut configuré.
let fallbackInFlight = false;

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

    if (fallbackInFlight) {
        let directProvider = providerOverride
            || (dbAgent && dbAgent.provider_override)
            || await db.getSetting('default_ai_provider', 'gemini');
        // Ceinture et bretelles : un fournisseur « mcp » résolu en réentrée
        // retomberait dans handleToolCall → boucle. Force un fournisseur API.
        if (directProvider === 'mcp') directProvider = 'gemini';
        return invokeSingleProvider({
            provider: directProvider,
            model: modelOverride || (dbAgent && dbAgent.model_override) || null,
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
    }

    fallbackInFlight = true;
    try {
        return await runFallbackCascade(params);
    } finally {
        fallbackInFlight = false;
    }
}

async function runFallbackCascade(params) {
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
    } else if (strategy === 'mcp') {
        // Stratégie « mcp » : passer par le tool call_agent du serveur local,
        // le même chemin que les clients MCP externes.
        targetProvider = 'mcp';
        targetModel = modelOverride || null;
    }

    // Construction de la cascade ordonnée de tentatives
    const attempts = [];

    // Tentative 1 : Fournisseur configuré
    attempts.push({ provider: targetProvider, model: targetModel, reason: 'fournisseur configuré' });

    if (autoFallback) {
        // Si Gemini API a une clé valide et n'est pas le fournisseur cible
        if (status.channels.geminiApi && targetProvider !== 'gemini') {
            attempts.push({ provider: 'gemini', model: 'gemini-2.5-flash', reason: 'auto-fallback Gemini API' });
        }

        // Si Google Gemini CLI est installé sur la machine
        if (status.channels.geminiCli && (targetProvider !== 'cli' || targetModel !== 'gemini')) {
            attempts.push({ provider: 'cli', model: 'gemini', reason: 'auto-fallback Google Gemini CLI local' });
        }

        // Si Claude Code CLI est installé
        if (status.channels.claudeCli && (targetProvider !== 'cli' || targetModel !== 'claude')) {
            attempts.push({ provider: 'cli', model: 'claude', reason: 'auto-fallback Claude Code CLI local' });
        }

        // Si OpenRouter a une clé valide
        if (status.channels.openrouterApi && targetProvider !== 'openrouter') {
            attempts.push({ provider: 'openrouter', model: null, reason: 'auto-fallback OpenRouter API' });
        }

        // Si le fournisseur configuré était Gemini mais sans clé ou a échoué, basculer sur Gemini CLI
        if (targetProvider === 'gemini') {
            if (status.channels.geminiCli) {
                attempts.push({ provider: 'cli', model: 'gemini', reason: 'auto-fallback Google Gemini CLI local' });
            }
            if (status.channels.claudeCli) {
                attempts.push({ provider: 'cli', model: 'claude', reason: 'auto-fallback Claude Code CLI local' });
            }
        }

        // Dernier repli : le serveur MCP local (tool call_agent, même surface
        // que les clients externes). En réentrée, il exécute le fournisseur
        // par défaut via la garde du routeur.
        if (status.channels.mcpServer && targetProvider !== 'mcp') {
            attempts.push({ provider: 'mcp', model: null, reason: 'auto-fallback serveur MCP local' });
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

            const respText = (result && typeof result.response === 'string') ? result.response : '';

            if (!result || isOfflineOrErrorResponse(respText) || (result.error && isKeyConfigurationError(result.error))) {
                const errDetail = result?.error || respText || 'Réponse vide ou hors-ligne';
                console.error(`[SmartFallback] ${attempt.reason} (${attempt.provider}) non concluant (${errDetail}). Bascule sur le canal suivant...`);
                lastError = new Error(errDetail);
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
