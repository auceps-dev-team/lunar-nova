const geminiService = require('./geminiService');
const openrouterService = require('./openrouterService');
const ollamaService = require('./ollamaService');
const openaiService = require('./openaiService');
// Chargé une fois. Ce module était autrefois purgé du cache à chaque appel
// (« edited at runtime ») pour qu'une modification de la liste des modèles soit
// vue sans relancer le serveur. Vérifié le 1er octobre 2026 : aucune valeur n'y
// est figée au chargement — les clés sont lues dans les réglages et process.env
// à l'appel, dans resolveKey — et en version packagée le fichier est en lecture
// seule dans app.asar. Le rechargement ne servait donc qu'au développeur qui
// édite la liste ; il coûtait la réévaluation de ~790 lignes à chaque appel LLM.
// Modifier MODELS demande désormais de relancer le backend, comme tout module.
const nvidiaModels = require('./nvidiaModels');
const getNvidiaModels = () => nvidiaModels;
const db = require('./db');
const { resolveProviderCredentials } = require('./services/providerCredentials');

async function getProviderConfig(personaId = null) {
    let provider = await db.getSetting('default_ai_provider', 'gemini');
    let dbAgent = null;

    if (personaId) {
        dbAgent = await db.getAgent(personaId);
        if (dbAgent && dbAgent.provider_override) {
            provider = dbAgent.provider_override;
        }
    }

    return { provider, dbAgent };
}

/**
 * Adaptateurs des tâches de texte « à un coup » (propositions de réponse,
 * classification de commande), par fournisseur. Ils ne font que traduire
 * l'ordre des arguments, propre à chaque service ; la résolution des clés et
 * des URL est commune (providerCredentials) — constat R6 de l'audit.
 *
 * Les services sont appelés par espace de noms, à l'appel : les tests peuvent
 * ainsi les substituer (convention du projet).
 */
const TEXT_TASKS = {
    generateProposals: {
        openrouter: (c, [ctx, model]) => openrouterService.generateProposals(ctx, model, c.apiKey),
        ollama: (c, [ctx, model]) => ollamaService.generateProposals(ctx, model, c.apiKey),
        openai: (c, [ctx, model]) => openaiService.generateProposals(ctx, model, c.apiKey, c.baseURL),
        gemini: (c, [ctx, model]) => geminiService.generateProposals(ctx, model)
    },
    classifyOrderIntent: {
        openrouter: (c, [text, contact, model]) => openrouterService.classifyOrderIntent(text, contact, c.apiKey, model),
        ollama: (c, [text, contact, model]) => ollamaService.classifyOrderIntent(text, contact, c.apiKey, model),
        openai: (c, [text, contact, model]) => openaiService.classifyOrderIntent(text, contact, c.apiKey, c.baseURL, model),
        gemini: (c, [text, contact, model]) => geminiService.classifyOrderIntent(text, contact, model)
    }
};

/**
 * Exécute une tâche de texte sur le fournisseur voulu. Un fournisseur inconnu
 * passe par Gemini ; une clé manquante ou un échec de l'adaptateur aussi, avec
 * une trace dans le journal — comportement figé par aiControllerRouting.test.js.
 */
async function runTextTask(task, provider, modelParam, args) {
    const adapters = TEXT_TASKS[task];
    try {
        const run = adapters[provider] || adapters.gemini;
        const credentials = await resolveProviderCredentials(provider, modelParam);
        return await run(credentials, args);
    } catch (err) {
        console.error(`[aiController] Fallback sur Gemini pour ${task} suite à l'erreur (${provider}) :`, err.message);
        return await adapters.gemini({}, args);
    }
}

async function generateProposals(chatContext, modelParam, providerOverride = null) {
    const { provider: defaultProvider } = await getProviderConfig(null);
    return runTextTask('generateProposals', providerOverride || defaultProvider, modelParam, [chatContext, modelParam]);
}

/**
 * classifyOrderIntent — classification structurée à un seul message pour
 * l'agent "Order Radar" (détection d'intention d'achat / commande directe).
 * Même routage que generateProposals, pour que le classificateur respecte le
 * fournisseur et la clé réellement configurés au lieu d'appeler un SDK en dur.
 */
async function classifyOrderIntent(text, contactName, modelParam = null, providerOverride = null) {
    const { provider: defaultProvider } = await getProviderConfig(null);
    return runTextTask('classifyOrderIntent', providerOverride || defaultProvider, modelParam, [text, contactName, modelParam]);
}

async function chatWithAgent(personaId, message, imageParams, attachments, promptFormat, messages = null, currentTasks = null, isRealTime = false, modelOverride = null, providerOverride = null) {
    const { provider: dbProvider, dbAgent } = await getProviderConfig(personaId);
    let provider = providerOverride || dbProvider;

    // Process attachments
    let processedMessage = message || '';
    let processedImageParams = imageParams;
    let hasAudio = false;

    if (attachments && attachments.length > 0) {
        let pdfText = '';
        const pdfParse = require('pdf-parse');
        
        for (const att of attachments) {
            if (att.mimeType.startsWith('image/')) {
                if (!processedImageParams) {
                    const base64Data = att.data.includes(',') ? att.data.split(',')[1] : att.data;
                    processedImageParams = { data: base64Data, mimeType: att.mimeType };
                }
            } else if (att.mimeType === 'application/pdf') {
                try {
                    const base64Data = att.data.includes(',') ? att.data.split(',')[1] : att.data;
                    const buffer = Buffer.from(base64Data, 'base64');
                    const pdfData = await pdfParse(buffer);
                    pdfText += `\n\n--- Content of ${att.fileName || 'document.pdf'} ---\n${pdfData.text}\n`;
                } catch (e) {
                    console.error('PDF Parse Error:', e);
                }
            } else if (att.mimeType.startsWith('audio/')) {
                hasAudio = true;
            }
        }

        // Only append pdfText if not using Gemini, since Gemini reads PDFs natively when passed as attachments
        if (pdfText && provider !== 'gemini') {
            processedMessage += pdfText;
        }

        // Force fallback to Gemini if audio is present
        if (hasAudio && provider === 'openai') {
            provider = 'gemini'; 
            console.error('[aiController] Audio attachment detected -> falling back to Gemini');
        }
    }

    const { executeAgentWithFallback } = require('./services/agentFallbackRouter');
    return await executeAgentWithFallback({
        personaId,
        message: processedMessage,
        imageParams: processedImageParams,
        attachments,
        promptFormat,
        messages,
        currentTasks,
        isRealTime,
        modelOverride,
        providerOverride: provider,
        dbAgent
    });
}

// La génération d'image (Imagen, NVIDIA, Together) a été retirée : WaCopilote
// se recentre sur WhatsApp multi-comptes et sur les agents de rédaction.
// listModels ne renvoie donc plus que des modèles de conversation.
async function listModels(providerOverride = null, apiKeyOverride = null) {
    const provider = providerOverride || await db.getSetting('default_ai_provider', 'gemini');

    if (provider === 'openrouter') {
        const apiKey = apiKeyOverride || await db.getSetting('openrouter_api_key', '');
        return await openrouterService.listModels(apiKey);
    } else if (provider === 'ollama') {
        const apiKey = apiKeyOverride || await db.getSetting('ollama_api_key', '');
        return await ollamaService.listModels(apiKey);
    } else if (provider === 'openai') {
        // Retourner le catalogue statique NVIDIA/Together AI
        // (évite une requête API qui nécessiterait une clé NVIDIA valide)
        const nm = getNvidiaModels();
        const chatModels = nm.getModelsByType('text').concat(nm.getModelsByType('vision'))
            .map(m => ({ id: m.id, name: m.name, type: m.type }));
        return { chat: chatModels };
    } else {
        return await geminiService.listModels();
    }
}


module.exports = {
    generateProposals,
    chatWithAgent,
    listModels,
    classifyOrderIntent
};
