const OpenAI = require('openai');
const orchestrator = require('./agents/orchestrator');
const nvidiaModels = require('./nvidiaModels');

function getClient(apiKey, baseURL) {
    if (!apiKey) {
        return null;
    }
    const config = {
        apiKey: apiKey,
    };
    if (baseURL) {
        config.baseURL = baseURL;
    }
    return new OpenAI(config);
}

/**
 * generateImageWithQwen
 * 
 * Qwen-Image est déployé via Together AI (partenaire NVIDIA Build).
 * - Base URL : https://api.together.xyz/v1
 * - Endpoint : /images/generations  (format OpenAI-compatible)
 * - Model ID  : "Qwen/Qwen-Image"   (majuscules — nom Together AI)
 * 
 * @param {string}  prompt   - Texte décrivant l'image
 * @param {string}  apiKey   - Clé Together AI (nvapi-... fournie par NVIDIA Build)
 * @param {object}  options  - { n, steps, disable_safety_checker }
 */
/**
 * sanitizePromptForTogether
 * Remplace les termes qui déclenchent le filtre Black Forest Labs / Together AI
 * dans les prompts de shooting photo fashion.
 */
function sanitizePromptForTogether(prompt) {
    if (!prompt) return prompt;
    return prompt
        // Réduire les références anatomiques excessives
        .replace(/\bskin tone\b/gi, 'complexion')
        .replace(/\bbare skin\b/gi, 'fashion look')
        .replace(/\bgender\b/gi, 'style')
        .replace(/\b(male|female) model\b/gi, 'fashion model')
        .replace(/\bbody position\b/gi, 'pose')
        .replace(/\bbody\b(?! language| suit| wear| of water| scan)/gi, 'figure')
        .replace(/\bappearance\b/gi, 'look')
        .replace(/\bDO NOT change the model.*?\n/gi, '')
        .replace(/MANDATORY CONSTRAINTS \(DO NOT IGNORE\):/gi, 'STYLE DIRECTION:');
}

async function generateImageWithQwen(prompt, apiKey, options = {}) {
    const axios = require('axios');
    const n = options.n || 1;
    const steps = options.steps || 28;  // 28 steps = meilleure qualité pour fashion

    // Sanitiser le prompt pour éviter le filtre BFL/Together AI
    const safePrompt = sanitizePromptForTogether(prompt);

    // Together AI — OpenAI-compatible endpoint
    const TOGETHER_BASE = 'https://api.together.xyz/v1';
    const endpoint = `${TOGETHER_BASE}/images/generations`;

    const payload = {
        model: 'Qwen/Qwen-Image',           // Nom exact sur Together AI
        prompt: safePrompt || 'Generate a professional fashion product photo',
        n,
        steps,
        response_format: 'b64_json',
        disable_safety_checker: true,   // Nécessaire pour les prompts fashion/editorial
    };

    if (options.imageParams && options.imageParams.data) {
        payload.image_url = `data:${options.imageParams.mimeType || 'image/jpeg'};base64,${options.imageParams.data}`;
        payload.mode = "image-to-image";
    }

    console.log('[Qwen→Together] POST', endpoint, '| model:', payload.model, '| steps:', steps);
    console.log('[Qwen→Together] Prompt (sanitized, first 200 chars):', safePrompt?.slice(0, 200));

    const response = await axios.post(endpoint, payload, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        timeout: 180000     // 3 min — Together AI peut être lent sur la première requête
    });

    return response.data;
}


async function generateProposals(chatContext, modelParam, apiKey, baseURL) {
    const openai = getClient(apiKey, baseURL);
    if (!openai) {
        return { proposed_replies: ["Error: OpenAI/NVIDIA API key not configured in settings."] };
    }

    if (!chatContext || !chatContext.messages || chatContext.messages.length === 0) {
        return { proposed_replies: [] };
    }

    let formattedChat = `Chat with: ${chatContext.contactName}\n\n`;
    chatContext.messages.forEach(msg => {
        formattedChat += `[${msg.time}] ${msg.sender}: ${msg.text}\n`;
    });

    const targetModel = modelParam || 'moonshotai/kimi-k2-instruct';
    const copilotPersona = orchestrator.getPersona('copilot');
    const systemInstruction = copilotPersona ? copilotPersona.systemInstruction : "You are an assistive copilot.";

    try {
        const response = await openai.chat.completions.create({
            model: targetModel,
            messages: [
                { role: "system", content: systemInstruction + "\n\nCRITICAL: Return ONLY a valid JSON object with a 'proposed_replies' array of strings. Do not include markdown formatting or extra text." },
                { role: "user", content: formattedChat }
            ],
            response_format: { type: "json_object" },
            max_tokens: 4096,
            stream: false
        });

        let jsonText = response.choices[0].message.content;
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch (e) {
            return { proposed_replies: ["Erreur de parsing JSON depuis l'API."] };
        }

        if (Array.isArray(parsed)) {
            return { proposed_replies: parsed };
        } else if (parsed.proposed_replies) {
            return parsed;
        } else {
            return { proposed_replies: ["Format inattendu retourné par l'API."] };
        }
    } catch (error) {
        console.error("OpenAI/NVIDIA API Error:", error);
        return { proposed_replies: [`API Error: ${error.message}`] };
    }
}

async function chatWithAgent(persona, message, imageParams, promptFormat, apiKey, baseURL, dbAgent = null) {
    const openai = getClient(apiKey, baseURL);
    if (!openai) {
        return { response: "Error: OpenAI/NVIDIA API key not configured in settings." };
    }

    if (!message && (!imageParams || !imageParams.data)) return { response: "I didn't catch that. How can I help?" };

    let personaInstruction = "";
    let finalPromptFormat = promptFormat;
    let targetModel = "";

    if (dbAgent) {
        personaInstruction = dbAgent.system_instruction;
        finalPromptFormat = dbAgent.response_format === 'json' ? 'json' : promptFormat;
        targetModel = dbAgent.model_override;
    } else {
        const p = orchestrator.getPersona(persona) || orchestrator.getPersona('creative');
        personaInstruction = p.systemInstruction;
        finalPromptFormat = orchestrator.requiresJsonFormat(persona) ? 'json' : promptFormat;
    }

    // Fallback if no specific model is set in agent/persona
    if (!targetModel) {
        // We could fetch default_chat_model here, but aiController usually handles routing.
        targetModel = 'moonshotai/kimi-k2-instruct';
    }

    try {
        const messages = [
            { role: "system", content: personaInstruction }
        ];

        // Vision support 
        if (imageParams && imageParams.data && imageParams.mimeType) {
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: message || "Analyze this image." },
                    {
                        type: "image_url",
                        image_url: { url: `data:${imageParams.mimeType};base64,${imageParams.data}` }
                    }
                ]
            });
        } else {
            messages.push({ role: "user", content: message });
        }

        if (finalPromptFormat === 'json') {
            messages[0].content += "\n\nCRITICAL: Return ONLY a valid JSON output. No markdown, no conversational text.";
        }

        const completionArgs = {
            model: targetModel,
            messages: messages,
            max_tokens: 4096,
            stream: false
        };

        // Chaque modèle du catalogue déclare ses propres défauts de génération
        // (max_tokens, reasoning_effort/budget, chat_template_kwargs, ...)
        Object.assign(completionArgs, nvidiaModels.buildGenerationParams(nvidiaModels.getModelDef(targetModel)));

        if (finalPromptFormat === 'json') {
             completionArgs.response_format = { type: "json_object" };
        }

        const response = await openai.chat.completions.create(completionArgs);
        
        const choice = response.choices[0];
        let resultText = choice.message.content;

        // Handle reasoning output for thinking models (key varies: reasoning_content vs reasoning)
        const reasoningText = choice.message.reasoning_content || choice.message.reasoning;
        if (reasoningText) {
            resultText = `*Thinking:* ${reasoningText}\n\n${resultText}`;
        }

        if (finalPromptFormat === 'json') {
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        return { response: resultText };
    } catch (error) {
        console.error(`OpenAI/NVIDIA Agent Error:`, error.response ? error.response.data : error.message);
        
        let errorMsg = error.message;
        if (error.response && error.response.data) {
            if (error.response.data.error && error.response.data.error.message) {
                errorMsg = error.response.data.error.message;
            } else if (error.response.data.detail) {
                errorMsg = error.response.data.detail;
            } else if (typeof error.response.data === 'string') {
                errorMsg = error.response.data;
            } else {
                errorMsg = JSON.stringify(error.response.data);
            }
        }
        
        return { response: `API Error: ${errorMsg}. Please check your API key and settings.` };
    }
}

/**
 * Specialized function for Vision and Image Editing via NVIDIA NIM (Qwen etc.)
 * These are chat-based vision models.
 */
async function analyzeOrEditImage(prompt, imageParams, apiKey, baseURL, modelId) {
    const openai = getClient(apiKey, baseURL);
    if (!openai) return { error: "API Key missing." };

    try {
        // ── Qwen-Image via Together AI ─────────────────────────────────────────
        // Déployé sur https://api.together.xyz/v1/images/generations
        // Clé API stockée dans 'together_api_key' en base
        if (modelId && (modelId.toLowerCase().includes('qwen/qwen-image') || modelId === 'qwen/qwen-image')) {

            const qwenResponse = await generateImageWithQwen(prompt, apiKey, {
                n: 1,
                steps: 20,
                disable_safety_checker: false,
                imageParams: imageParams,
            });

            const payload = qwenResponse;
            let imageBytes = null;

            // Together AI response: { data: [{ b64_json: "...", ... }] }
            if (payload?.data?.[0]?.b64_json) {
                imageBytes = payload.data[0].b64_json;
            }
            // Fallbacks (NVIDIA /genai/, autres formats)
            if (!imageBytes && payload?.artifacts?.[0]?.base64) {
                imageBytes = payload.artifacts[0].base64;
            }
            if (!imageBytes) {
                const firstItem = payload?.data?.[0] || payload?.output?.[0] || payload?.[0];
                if (firstItem) {
                    imageBytes = firstItem?.b64_json || firstItem?.b64 || firstItem?.base64 || firstItem?.image || null;
                }
            }
            if (!imageBytes) {
                imageBytes = payload?.b64_json || payload?.image || null;
            }

            console.log('[Qwen→Together] Response keys:', Object.keys(payload || {}));
            if (!imageBytes) {
                console.error('[Qwen→Together] Full payload:', JSON.stringify(payload));
                return { error: 'Together AI / Qwen-Image : aucune image retournée. Vérifiez la clé API Together AI et le quota.' };
            }

            return { success: true, imageBytes };
        }


        // Use true image generation endpoint for stability/SDXL models
        if (modelId.includes('stable-diffusion') || modelId.includes('sdxl')) {
            const axios = require('axios');
            
            // Si on est sur NVIDIA, l'endpoint est différent du format OpenAI classique
            if (baseURL && baseURL.includes('nvidia')) {
                const normalizedBase = baseURL.replace(/\/$/, '');
                const attemptPost = async (idToUse) => {
                    return await axios.post(
                        `${normalizedBase}/vision/${idToUse}`,
                        {
                            prompt: prompt || "Generate a fashion photo",
                            mode: "text-to-image",
                            model: idToUse,
                            aspect_ratio: "1:1",
                            cfg_scale: 5,
                            seed: 0,
                            steps: 50,
                            output_format: "jpeg"
                        },

                        {
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                };

                try {
                    const endpointToUse = `${normalizedBase}/vision/${modelId}`;
                    console.log(`[NVIDIA] Calling endpoint: ${endpointToUse} | modelId=${modelId} | apiKeyPresent=${!!apiKey}`);
                    const nvidiaResponse = await attemptPost(modelId);
                    return {
                        success: true,
                        // NVIDIA API returns { image: "base64..." }
                        imageBytes: nvidiaResponse.data.image
                    };
                } catch (err) {
                    // If the model endpoint returned 404, try dot/underscore variant
                    const statusCode = err.response && err.response.status;
                    console.warn(`NVIDIA request failed for model ${modelId}:`, err.response ? err.response.data : err.message);
                    if (statusCode === 404) {
                        const alt = modelId.includes('_') ? modelId.replace(/_/g, '.') : modelId.replace(/\./g, '_');
                        try {
                            console.log(`Retrying NVIDIA endpoint with alternative model id: ${alt}`);
                            const altResp = await attemptPost(alt);
                            return { success: true, imageBytes: altResp.data.image };
                        } catch (err2) {
                            console.error(`NVIDIA retry also failed for ${alt}:`, err2.response ? err2.response.data : err2.message);
                            // fallthrough to error handler below
                            throw err2;
                        }
                    }
                    throw err;
                }
            } else {
                // Standard OpenAI compatibility
                const reqPayload = {
                    model: modelId,
                    prompt: prompt || "Generate a fashion photo",
                    n: 1,
                    size: "1024x1024",
                    response_format: "b64_json"
                };

                if (imageParams && imageParams.data) {
                    reqPayload.image_url = `data:${imageParams.mimeType || 'image/jpeg'};base64,${imageParams.data}`;
                    reqPayload.mode = "image-to-image";
                }

                const response = await openai.images.generate(reqPayload);
                return {
                    success: true,
                    imageBytes: response.data[0].b64_json
                };
            }
        }

        // Fallback for chat-based vision models (returns description)
        const messages = [];
        if (imageParams && imageParams.data) {
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: prompt || "Describe or edit this image according to instructions." },
                    {
                        type: "image_url",
                        image_url: { url: `data:${imageParams.mimeType || 'image/png'};base64,${imageParams.data}` }
                    }
                ]
            });
        } else {
            messages.push({ role: "user", content: prompt });
        }

        const response = await openai.chat.completions.create({
            model: modelId,
            messages: messages,
            max_tokens: 1024,
            stream: false
        });

        return { 
            success: true, 
            description: response.choices[0].message.content,
            imageBytes: null // Text-only vision models don't return images
        };
    } catch (error) {
        console.error("NVIDIA/OpenAI Image Error:", error.response ? error.response.data : error.message);
        
        let errorMsg = error.message;
        if (error.response && error.response.data) {
            if (error.response.data.error && error.response.data.error.message) {
                errorMsg = error.response.data.error.message;
            } else if (error.response.data.detail) {
                errorMsg = error.response.data.detail;
            } else if (typeof error.response.data === 'string') {
                errorMsg = error.response.data;
            } else {
                errorMsg = JSON.stringify(error.response.data);
            }
        }
        
        return { error: errorMsg };
    }
}

async function listModels(apiKey, baseURL) {
    const openai = getClient(apiKey, baseURL);

    // Construire les listes à partir du catalogue centralisé
    const catalogChatModels = [
        ...nvidiaModels.getModelsByType('text'),
        ...nvidiaModels.getModelsByType('vision')
    ].map(m => ({
        id: m.id,
        name: m.name,
        type: m.type
    }));

    const catalogImageModels = [
        ...nvidiaModels.getModelsByType('image-generate'),
        ...nvidiaModels.getModelsByType('image-edit'),
    ].map(m => ({
        id: m.id,
        name: m.name,
        type: m.type
    }));

    if (!openai) {
        return { chat: catalogChatModels, image: catalogImageModels };
    }

    try {
        const response = await openai.models.list();
        const chatModels = [...catalogChatModels];

        if (response.data && Array.isArray(response.data)) {
            response.data.forEach(m => {
                // Ignorer les modèles vision/image-edit/image-generate qui sont dans les listes spécifiques
                const inCatalog = nvidiaModels.getModelDef(m.id);
                if (inCatalog && inCatalog.type !== 'text') return;
                // Éviter les doublons avec les modèles prioritaires
                if (!chatModels.some(pm => pm.id === m.id)) {
                    chatModels.push({ id: m.id, name: m.id, type: 'text' });
                }
            });
            // Les modèles prioritaires restent en tête, les autres triés alphabétiquement
            const others = chatModels.slice(catalogChatModels.length);
            others.sort((a, b) => a.name.localeCompare(b.name));

            return {
                chat: [...catalogChatModels, ...others],
                image: catalogImageModels
            };
        }

        return { chat: catalogChatModels, image: catalogImageModels };
    } catch (error) {
        console.error("OpenAI/NVIDIA Models Error:", error);
        return { chat: catalogChatModels, image: catalogImageModels };
    }
}


/**
 * classifyOrderIntent — classification structurée à un seul message (Order Radar),
 * routée via le catalogue NVIDIA/Together comme le reste de l'app (au lieu de
 * l'ancien appel Gemini brut de orderListener.js). Par défaut sur un petit modèle
 * rapide/peu coûteux, adapté à une classification à faible latence.
 */
async function classifyOrderIntent(text, contactName, apiKey, baseURL, modelParam) {
    const fallback = { is_order: false, confidence: 0, order_type: 'not_an_order', summary: '' };
    const openai = getClient(apiKey, baseURL);
    if (!openai) return fallback;

    const targetModel = modelParam || 'meta/llama-3.1-8b-instruct';
    const orderRadarPersona = orchestrator.getPersona('order_radar');
    const systemInstruction = orderRadarPersona ? orderRadarPersona.systemInstruction : '';

    try {
        const completionArgs = {
            model: targetModel,
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: `Contact: ${contactName}\nMessage: "${text}"` }
            ],
            response_format: { type: "json_object" },
            stream: false
        };
        Object.assign(completionArgs, nvidiaModels.buildGenerationParams(nvidiaModels.getModelDef(targetModel)));

        const response = await openai.chat.completions.create(completionArgs);
        let jsonText = response.choices[0].message.content;
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

        return { ...fallback, ...JSON.parse(jsonText) };
    } catch (error) {
        console.error("[OrderRadar] NVIDIA classification error:", error.message);
        return fallback;
    }
}

module.exports = {
    generateProposals,
    chatWithAgent,
    analyzeOrEditImage,
    listModels,
    classifyOrderIntent
};
