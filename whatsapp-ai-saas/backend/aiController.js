const geminiService = require('./geminiService');
const openrouterService = require('./openrouterService');
const ollamaService = require('./ollamaService');
const openaiService = require('./openaiService');
// nvidiaModels may be edited at runtime; load dynamically to pick changes without restart
function getNvidiaModels() {
    try {
        delete require.cache[require.resolve('./nvidiaModels')];
    } catch (e) {
        // ignore
    }
    return require('./nvidiaModels');
}
const db = require('./db');

/**
 * Résolution de clé NVIDIA à 3 niveaux :
 *   1. Clé spécifique au modèle en DB (configurée par l'utilisateur)
 *   2. Clé globale openai_api_key en DB
 *   3. Clé système dans .env (fallback silencieux)
 */
async function resolveNvidiaKey(modelId) {
    const nvidiaModels = getNvidiaModels();
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
        const nvidiaModels = getNvidiaModels();
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
        let selectedModel = modelOverride || dbAgent?.model_override || await db.getSetting('default_chat_model', '');
        const nvidiaModels = getNvidiaModels();
        
        // Auto-select a vision model if the user provided an image but the selected model is text-only
        if (imageParams && imageParams.data) {
            const def = nvidiaModels.getModelDef(selectedModel);
            if (!def || def.type !== 'vision') {
                const visionModel = nvidiaModels.getDefaultVisionModel();
                if (visionModel) selectedModel = visionModel.id;
            }
        }
        
        const apiKey = await resolveNvidiaKey(selectedModel);
        const baseURL = await db.getSetting('openai_base_url', nvidiaModels.NVIDIA_BASE_URL);
        
        // Pass the modelOverride down by merging into a faux dbAgent if needed
        let effectiveAgent = dbAgent;
        if (selectedModel) {
            const overrideDef = getNvidiaModels().getModelDef(selectedModel);
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
    // Priorité pour la génération d'images :
    //   1. valeur explicite du body (providerOverride)
    //   2. default_image_provider  (setting dédié à la génération)
    //   3. default_ai_provider     (fallback global)
    const imageProviderSetting = await db.getSetting('default_image_provider', '');
    const globalProvider = await db.getSetting('default_ai_provider', 'gemini');
    const provider = providerOverride || imageProviderSetting || globalProvider;
    const imageModel = imageModelOverride || await db.getSetting('default_image_model', '');

    if (provider === 'openrouter') {
        return { error: "Erreur : La génération d'images via OpenRouter n'est pas supportée. Utilisez Gemini ou NVIDIA NIM." };
    } else if (provider === 'ollama') {
        return { error: "Erreur : Ollama local ne supporte pas la génération d'images dans cette version." };
    } else if (provider === 'openai') {
        // Fallback intelligent vers Gemini si une image source (Virtual Try-on / Édition) est fournie.
        // Qwen-Image via l'API Together AI utilisée ici est uniquement Text-to-Image.
        if (imageParams && imageParams.data) {
            console.warn('[aiController] Image-to-Image requested but Qwen/OpenAI currently supports only Text-to-Image. Falling back to Gemini Image Editing.');
            return await geminiService.generateImage(prompt, aspectRatio, imageParams, editMode, mode, 'gemini-3.1-flash-image-preview');
        }

        // Vérifier que le modèle image sélectionné est bien un modèle vision/image-edit
        const modelDef = getNvidiaModels().getModelDef(imageModel);
        console.log('[generateImage] imageModel=', imageModel);
        console.log('[generateImage] modelDef=', modelDef);
        if (!modelDef || modelDef.type === 'text' || modelDef.type === 'vision') {
            return { error: `Le modèle sélectionné (${modelDef ? modelDef.name : imageModel}) ne supporte pas la génération d'images. Sélectionnez "Qwen Image (Together AI)" dans le menu Modèle de génération.` };
        }

        // ── Résolution de clé : Together AI pour Qwen-Image ─────────────────
        // qwen/qwen-image est déployé via Together AI — clé dédiée 'together_api_key'
        let apiKey;
        const isQwenModel = imageModel && imageModel.toLowerCase().includes('qwen/qwen-image');
        if (isQwenModel) {
            apiKey = await db.getSetting('together_api_key', '');
            if (!apiKey) {
                // Fallback sur la clé spécifique au modèle en DB
                apiKey = await resolveNvidiaKey(imageModel);
            }
            console.log('[generateImage] Qwen→Together AI | key present:', !!apiKey);
        } else {
            apiKey = await resolveNvidiaKey(imageModel);
        }

        const baseURL = await db.getSetting('openai_base_url', getNvidiaModels().NVIDIA_BASE_URL);
        return await openaiService.analyzeOrEditImage(prompt, imageParams, apiKey, baseURL, imageModel);
    } else {
        if (imageModel && imageModel.startsWith('qwen/')) {
            return { error: `Le modèle ${imageModel} nécessite le fournisseur OpenAI/NVIDIA (default_ai_provider=openai). Vérifiez vos paramètres.` };
        }
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
        // Retourner le catalogue statique NVIDIA/Together AI
        // (évite une requête API qui nécessiterait une clé NVIDIA valide)
        const nm = getNvidiaModels();
        const chatModels = nm.getModelsByType('text').concat(nm.getModelsByType('vision'))
            .map(m => ({ id: m.id, name: m.name }));
        const imageModels = nm.getModelsByType('image-edit').concat(nm.getModelsByType('image-generate'))
            .map(m => ({ id: m.id, name: m.name }));
        return { chat: chatModels, image: imageModels };
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
