const geminiService = require('./geminiService');
const openrouterService = require('./openrouterService');
const ollamaService = require('./ollamaService');
const openaiService = require('./openaiService');
// nvidiaModels may be edited at runtime; load dynamically to pick changes without restart
function getNvidiaModels() {
    try {
        delete require.cache[require.resolve('./nvidiaModels')];
    } catch {
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

async function generateProposals(chatContext, modelParam, providerOverride = null) {
    const { provider: defaultProvider } = await getProviderConfig(null);
    const provider = providerOverride || defaultProvider;

    if (provider === 'openrouter') {
        const apiKey = await db.getSetting('openrouter_api_key', '');
        return await openrouterService.generateProposals(chatContext, modelParam, apiKey);
    } else if (provider === 'ollama') {
        const apiKey = await db.getSetting('ollama_api_key', '');
        return await ollamaService.generateProposals(chatContext, modelParam, apiKey);
    } else if (provider === 'openai') {
        const apiKey = await resolveNvidiaKey(modelParam);
        const nvidiaModels = getNvidiaModels();
        let baseURL = await db.getSetting('openai_base_url', nvidiaModels.NVIDIA_BASE_URL);
        const modelDef = nvidiaModels.getModelDef(modelParam);
        if (modelDef && modelDef.provider === 'together') {
            baseURL = 'https://api.together.xyz/v1';
        }
        return await openaiService.generateProposals(chatContext, modelParam, apiKey, baseURL);
    } else {
        return await geminiService.generateProposals(chatContext, modelParam);
    }
}

/**
 * classifyOrderIntent — classification structurée à un seul message pour
 * l'agent "Order Radar" (détection d'intention d'achat / commande directe).
 * Même branchement par provider que generateProposals, pour que le classificateur
 * respecte le provider/clé réellement configurés au lieu d'appeler un SDK en dur.
 */
async function classifyOrderIntent(text, contactName, modelParam = null, providerOverride = null) {
    const { provider: defaultProvider } = await getProviderConfig(null);
    const provider = providerOverride || defaultProvider;

    if (provider === 'openrouter') {
        const apiKey = await db.getSetting('openrouter_api_key', '');
        return await openrouterService.classifyOrderIntent(text, contactName, apiKey, modelParam);
    } else if (provider === 'ollama') {
        const apiKey = await db.getSetting('ollama_api_key', '');
        return await ollamaService.classifyOrderIntent(text, contactName, apiKey, modelParam);
    } else if (provider === 'openai') {
        const apiKey = await resolveNvidiaKey(modelParam);
        const nvidiaModels = getNvidiaModels();
        let baseURL = await db.getSetting('openai_base_url', nvidiaModels.NVIDIA_BASE_URL);
        const modelDef = nvidiaModels.getModelDef(modelParam);
        if (modelDef && modelDef.provider === 'together') {
            baseURL = 'https://api.together.xyz/v1';
        }
        return await openaiService.classifyOrderIntent(text, contactName, apiKey, baseURL, modelParam);
    } else {
        return await geminiService.classifyOrderIntent(text, contactName, modelParam);
    }
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
        // But for simplicity, we can just append it for all or conditionally.
        // Wait, if it's Gemini, we pass the attachments array directly to Gemini service.
        if (pdfText && provider !== 'gemini') {
            processedMessage += pdfText;
        }

        // Force fallback to Gemini if audio is present
        if (hasAudio && provider === 'openai') {
            provider = 'gemini'; 
            console.log('[aiController] Audio attachment detected -> falling back to Gemini');
        }
    }

    if (provider === 'openrouter') {
        const apiKey = await db.getSetting('openrouter_api_key', '');
        let effectiveAgent = dbAgent;
        if (modelOverride) {
            if (effectiveAgent) {
                effectiveAgent.model_override = modelOverride;
            } else {
                const orchestrator = require('./agents/orchestrator');
                const p = orchestrator.getPersona(personaId) || orchestrator.getPersona('creative');
                effectiveAgent = { model_override: modelOverride, system_instruction: p.systemInstruction, response_format: orchestrator.requiresJsonFormat(personaId) ? 'json' : promptFormat };
            }
        }
        return await openrouterService.chatWithAgent(personaId, processedMessage, processedImageParams, promptFormat, apiKey, effectiveAgent, messages, currentTasks, isRealTime);
    } else if (provider === 'ollama') {
        const apiKey = await db.getSetting('ollama_api_key', '');
        let effectiveAgent = dbAgent;
        if (modelOverride) {
            if (effectiveAgent) {
                effectiveAgent.model_override = modelOverride;
            } else {
                const orchestrator = require('./agents/orchestrator');
                const p = orchestrator.getPersona(personaId) || orchestrator.getPersona('creative');
                effectiveAgent = { model_override: modelOverride, system_instruction: p.systemInstruction, response_format: orchestrator.requiresJsonFormat(personaId) ? 'json' : promptFormat };
            }
        }
        return await ollamaService.chatWithAgent(personaId, processedMessage, processedImageParams, promptFormat, effectiveAgent, apiKey, messages, currentTasks, isRealTime);
    } else if (provider === 'openai') {
        let selectedModel = modelOverride || dbAgent?.model_override || await db.getSetting('default_chat_model', '');
        const nvidiaModels = getNvidiaModels();
        
        // Auto-select a vision model if the user provided an image but the selected model is text-only
        let def = nvidiaModels.getModelDef(selectedModel);
        if (processedImageParams && processedImageParams.data) {
            if (!def || def.type !== 'vision') {
                const visionModel = nvidiaModels.getDefaultVisionModel();
                if (visionModel) {
                    selectedModel = visionModel.id;
                    def = visionModel;
                }
            }
        }
        
        const apiKey = await resolveNvidiaKey(selectedModel);
        let baseURL = await db.getSetting('openai_base_url', nvidiaModels.NVIDIA_BASE_URL);
        if (def && def.provider === 'together') {
            baseURL = 'https://api.together.xyz/v1';
        }
        
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
        return await openaiService.chatWithAgent(personaId, processedMessage, processedImageParams, promptFormat, apiKey, baseURL, effectiveAgent);
    } else {
        let effectiveAgent = dbAgent;
        if (modelOverride) {
            if (effectiveAgent) {
                effectiveAgent.model_override = modelOverride;
            } else {
                const orchestrator = require('./agents/orchestrator');
                const p = orchestrator.getPersona(personaId) || orchestrator.getPersona('creative');
                effectiveAgent = { 
                    model_override: modelOverride, 
                    system_instruction: p.systemInstruction, 
                    response_format: orchestrator.requiresJsonFormat(personaId) ? 'json' : promptFormat 
                };
            }
        }
        return await geminiService.chatWithAgent(personaId, processedMessage, processedImageParams, attachments, promptFormat, effectiveAgent, messages, currentTasks, isRealTime);
    }
}

async function generateImage(prompt, aspectRatio, imageParams, editMode, mode, providerOverride = null, imageModelOverride = null) {
    // ── Logique principale ──
    // Si une image source est fournie (image-to-image / édition), c'est TOUJOURS Gemini
    // Les modèles NVIDIA/Together ne supportent que le text-to-image pur
    const isEditMode = !!(imageParams && imageParams.data);
    
    if (isEditMode) {
        console.log('[aiController] Image-to-Image mode detected → routing to Gemini');
        const geminiModel = imageModelOverride || 'gemini-3.1-flash-image-preview';
        return await geminiService.generateImage(prompt, aspectRatio, imageParams, editMode, mode, geminiModel);
    }
    
    // ── Text-to-Image pur ──
    // Priorité : providerOverride > default_image_provider > default_ai_provider
    const imageProviderSetting = await db.getSetting('default_image_provider', '');
    const globalProvider = await db.getSetting('default_ai_provider', 'gemini');
    const provider = providerOverride || imageProviderSetting || globalProvider;
    
    let imageModel = imageModelOverride;
    if (!imageModel) {
        if (provider === 'openai') {
            imageModel = await db.getSetting('default_image_generate_model', '');
        }
        if (!imageModel) {
            imageModel = await db.getSetting('default_image_model', '');
        }
    }

    if (provider === 'openrouter') {
        return { error: "Erreur : La génération d'images via OpenRouter n'est pas supportée. Utilisez Gemini ou NVIDIA NIM." };
    } else if (provider === 'ollama') {
        return { error: "Erreur : Ollama local ne supporte pas la génération d'images dans cette version." };
    } else if (provider === 'openai') {
        // Text-to-Image via NVIDIA/Together AI
        const modelDef = getNvidiaModels().getModelDef(imageModel);
        console.log('[generateImage] Text-to-Image | imageModel=', imageModel);
        if (!modelDef || modelDef.type === 'text' || modelDef.type === 'vision') {
            return { error: `Le modèle sélectionné (${modelDef ? modelDef.name : imageModel}) ne supporte pas la génération d'images.` };
        }

        // Résolution de clé et baseURL pour Together AI ou NVIDIA
        let apiKey;
        let baseURL = await db.getSetting('openai_base_url', getNvidiaModels().NVIDIA_BASE_URL);
        
        if (modelDef && modelDef.provider === 'together') {
            apiKey = await db.getSetting('together_api_key', '');
            if (!apiKey) apiKey = await resolveNvidiaKey(imageModel);
            baseURL = 'https://api.together.xyz/v1';
            console.log('[generateImage] Routed to Together AI | key present:', !!apiKey);
        } else {
            apiKey = await resolveNvidiaKey(imageModel);
        }

        return await openaiService.analyzeOrEditImage(prompt, imageParams, apiKey, baseURL, imageModel);
    } else {
        // Gemini text-to-image
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
            .map(m => ({ id: m.id, name: m.name, type: m.type }));
        const imageModels = nm.getModelsByType('image-edit').concat(nm.getModelsByType('image-generate'))
            .map(m => ({ id: m.id, name: m.name, type: m.type }));
        return { chat: chatModels, image: imageModels };
    } else {
        return await geminiService.listModels();
    }
}


module.exports = {
    generateProposals,
    chatWithAgent,
    generateImage,
    listModels,
    classifyOrderIntent
};
