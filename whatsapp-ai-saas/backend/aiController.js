const geminiService = require('./geminiService');
const openrouterService = require('./openrouterService');
const ollamaService = require('./ollamaService');
const openaiService = require('./openaiService');
const nvidiaModels = require('./nvidiaModels');
const db = require('./db');

/**
 * Résolution de clé NVIDIA à 3 niveaux :
 *   1. Clé spécifique au modèle en DB (configurée par l'utilisateur)
 *   2. Clé globale openai_api_key en DB
 *   3. Clé système dans .env (fallback silencieux)
 */
async function resolveNvidiaKey(modelId) {
    return nvidiaModels.resolveKey(modelId, db.getSetting.bind(db));
}

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

async function generateProposals(chatContext, modelParam) {
    const { provider } = await getProviderConfig(null);

    if (provider === 'openrouter') {
        const apiKey = await db.getSetting('openrouter_api_key', '');
        return await openrouterService.generateProposals(chatContext, modelParam, apiKey);
    } else if (provider === 'ollama') {
        const apiKey = await db.getSetting('ollama_api_key', '');
        return await ollamaService.generateProposals(chatContext, modelParam, apiKey);
    } else if (provider === 'openai') {
        const apiKey = await resolveNvidiaKey(modelParam);
        const baseURL = await db.getSetting('openai_base_url', nvidiaModels.NVIDIA_BASE_URL);
        return await openaiService.generateProposals(chatContext, modelParam, apiKey, baseURL);
    } else {
        return await geminiService.generateProposals(chatContext, modelParam);
    }
}

async function chatWithAgent(personaId, message, imageParams, promptFormat, messages = null, currentTasks = null, isRealTime = false, modelOverride = null) {
    const { provider, dbAgent } = await getProviderConfig(personaId);

    if (provider === 'openrouter') {
        const apiKey = await db.getSetting('openrouter_api_key', '');
        return await openrouterService.chatWithAgent(personaId, message, imageParams, promptFormat, apiKey, dbAgent, messages, currentTasks, isRealTime);
    } else if (provider === 'ollama') {
        const apiKey = await db.getSetting('ollama_api_key', '');
        return await ollamaService.chatWithAgent(personaId, message, imageParams, promptFormat, dbAgent, apiKey, messages, currentTasks, isRealTime);
    } else if (provider === 'openai') {
        const selectedModel = modelOverride || dbAgent?.model_override || await db.getSetting('default_chat_model', '');
        const apiKey = await resolveNvidiaKey(selectedModel);
        const baseURL = await db.getSetting('openai_base_url', nvidiaModels.NVIDIA_BASE_URL);
        
        // Pass the modelOverride down by merging into a faux dbAgent if needed
        let effectiveAgent = dbAgent;
        if (selectedModel) {
            const overrideDef = nvidiaModels.getModelDef(selectedModel);
            // Allow override only if it's a valid chat/vision model
            if (overrideDef && (overrideDef.type === 'text' || overrideDef.type === 'vision')) {
                if (effectiveAgent) {
                    effectiveAgent.model_override = selectedModel;
                } else {
                    const orchestrator = require('./agents/orchestrator');
                    const p = orchestrator.getPersona(personaId) || orchestrator.getPersona('creative');
                    effectiveAgent = { 
                        model_override: selectedModel, 
                        system_instruction: p.systemInstruction, 
                        response_format: orchestrator.requiresJsonFormat(personaId) ? 'json' : promptFormat 
                    };
                }
            }
        }
        
        return await openaiService.chatWithAgent(personaId, message, imageParams, promptFormat, apiKey, baseURL, effectiveAgent);
    } else {
        return await geminiService.chatWithAgent(personaId, message, imageParams, promptFormat, dbAgent, messages, currentTasks, isRealTime);
    }
}

async function generateImage(prompt, aspectRatio, imageParams, editMode, mode, providerOverride = null, imageModelOverride = null) {
    // Priorité : valeur explicite du body > settings DB
    const provider   = providerOverride   || await db.getSetting('default_ai_provider', 'gemini');
    const imageModel = imageModelOverride || await db.getSetting('default_image_model', '');

    if (provider === 'openrouter') {
        return { error: "Erreur : La génération d'images via OpenRouter n'est pas supportée. Utilisez Gemini ou NVIDIA NIM." };
    } else if (provider === 'ollama') {
        return { error: "Erreur : Ollama local ne supporte pas la génération d'images dans cette version." };
    } else if (provider === 'openai') {
        // Vérifier que le modèle image sélectionné est bien un modèle vision/image-edit
        const modelDef = nvidiaModels.getModelDef(imageModel);
        if (!modelDef || modelDef.type === 'text' || modelDef.type === 'vision') {
            return { error: `Le modèle sélectionné (${modelDef ? modelDef.name : imageModel}) est conçu pour l'analyse de texte/image, pas pour la génération d'images. Veuillez sélectionner un modèle de génération (ex: Stable Diffusion 3).` };
        }
        const baseURL = await db.getSetting('openai_base_url', nvidiaModels.NVIDIA_BASE_URL);
        const apiKey = await resolveNvidiaKey(imageModel);
        return await openaiService.analyzeOrEditImage(prompt, imageParams, apiKey, baseURL, imageModel);
    } else {
        return await geminiService.generateImage(prompt, aspectRatio, imageParams, editMode, mode, imageModel);
    }
}



async function listModels(providerOverride = null, apiKeyOverride = null) {
    const provider = providerOverride || await db.getSetting('default_ai_provider', 'gemini');

    if (provider === 'openrouter') {
        const apiKey = apiKeyOverride || await db.getSetting('openrouter_api_key', '');
        return await openrouterService.listModels(apiKey);
    } else if (provider === 'ollama') {
        const apiKey = apiKeyOverride || await db.getSetting('ollama_api_key', '');
        return await ollamaService.listModels(apiKey);
    } else if (provider === 'openai') {
        const apiKey = apiKeyOverride || await db.getSetting('openai_api_key', '');
        const baseURL = await db.getSetting('openai_base_url', 'https://integrate.api.nvidia.com/v1');
        return await openaiService.listModels(apiKey, baseURL);
    } else {
        return await geminiService.listModels();
    }
}

module.exports = {
    generateProposals,
    chatWithAgent,
    generateImage,
    listModels
};
