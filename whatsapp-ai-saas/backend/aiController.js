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
        return await ollamaService.generateProposals(chatContext, modelParam);
    } else {
        // Default to Gemini
        return await geminiService.generateProposals(chatContext, modelParam);
    }
}

async function chatWithAgent(personaId, message, imageParams, promptFormat) {
    const { provider, dbAgent } = await getProviderConfig(personaId);

    if (provider === 'openrouter') {
        const apiKey = await db.getSetting('openrouter_api_key', '');
        return await openrouterService.chatWithAgent(personaId, message, imageParams, promptFormat, apiKey, dbAgent);
    } else if (provider === 'ollama') {
        return await ollamaService.chatWithAgent(personaId, message, imageParams, promptFormat, dbAgent);
    } else {
        // Default to Gemini
        return await geminiService.chatWithAgent(personaId, message, imageParams, promptFormat, dbAgent);
    }
}

async function generateImage(prompt, aspectRatio, imageParams, editMode, mode) {
    // Toujours utiliser Gemini pour la génération et retouche d'image
    return await geminiService.generateImage(prompt, aspectRatio, imageParams, editMode, mode);
}

module.exports = {
    generateProposals,
    chatWithAgent,
    generateImage
};