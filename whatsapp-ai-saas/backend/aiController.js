const geminiService = require('./geminiService');
const openrouterService = require('./openrouterService');
const ollamaService = require('./ollamaService');
const db = require('./db');

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
    } else {
        // Default to Gemini
        return await geminiService.generateProposals(chatContext, modelParam);
    }
}

async function chatWithAgent(personaId, message, imageParams, promptFormat, messages = null, currentTasks = null) {
    const { provider, dbAgent } = await getProviderConfig(personaId);

    if (provider === 'openrouter') {
        const apiKey = await db.getSetting('openrouter_api_key', '');
        return await openrouterService.chatWithAgent(personaId, message, imageParams, promptFormat, apiKey, dbAgent, messages, currentTasks);
    } else if (provider === 'ollama') {
        const apiKey = await db.getSetting('ollama_api_key', '');
        return await ollamaService.chatWithAgent(personaId, message, imageParams, promptFormat, dbAgent, apiKey, messages, currentTasks);
    } else {
        // Default to Gemini
        return await geminiService.chatWithAgent(personaId, message, imageParams, promptFormat, dbAgent, messages, currentTasks);
    }
}

async function generateImage(prompt, aspectRatio, imageParams, editMode, mode) {
    const provider = await db.getSetting('default_ai_provider', 'gemini');
    let imageModel = await db.getSetting('default_image_model', '');

    if (provider === 'openrouter') {
        const apiKey = await db.getSetting('openrouter_api_key', '');
        // For now OpenRouter image generation might need specific implementation, 
        // falling back to basic chat completion or a specific image endpoint if supported.
        // If not, we block text models from being used for image generation.
        if (!imageModel || imageModel === 'none' || imageModel.includes('Génération d\'image non supportée')) {
            return { error: "Erreur : Ce modèle OpenRouter (ou le fournisseur actuel) ne supporte pas la génération d'images, veuillez choisir un fournisseur ou modèle compatible dans les paramètres." };
        }
        // Since OpenRouter doesn't have a standardized image generation endpoint like Gemini Imagen, 
        // we return an error for now unless it's a known supported model (which requires additional impl).
        return { error: "Erreur : La génération d'images via OpenRouter nécessite une intégration spécifique à l'API d'image. Veuillez utiliser Gemini pour l'instant." };
    } else if (provider === 'ollama') {
        return { error: "Erreur : Ollama local ne supporte pas nativement la génération d'images dans cette version. Veuillez configurer Gemini dans les paramètres." };
    } else {
        // Default to Gemini
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
