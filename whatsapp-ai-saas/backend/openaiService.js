const OpenAI = require('openai');
const orchestrator = require('./agents/orchestrator');
const nvidiaModels = require('./nvidiaModels');
const { parseLlmJson, stripCodeFences } = require('./llmJson');

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

    const targetModel = modelParam || 'meta/llama-3.1-8b-instruct';
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

        const parsed = parseLlmJson(response.choices[0].message.content, null);
        if (parsed === null) {
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
        // Agent inconnu : repli sur le copilote (« creative », l'ancien repli,
        // est parti avec la génération d'image).
        const p = orchestrator.getPersona(persona) || orchestrator.getPersona('copilot');
        personaInstruction = p.systemInstruction;
        finalPromptFormat = orchestrator.requiresJsonFormat(persona) ? 'json' : promptFormat;
    }

    // Fallback if no specific model is set in agent/persona
    if (!targetModel) {
        // We could fetch default_chat_model here, but aiController usually handles routing.
        targetModel = 'meta/llama-3.1-8b-instruct';
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
            resultText = stripCodeFences(resultText);
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

// Modèles d'image d'un fournisseur (diffusion, génération). Depuis le retrait
// de la génération d'image, ils ne sont plus dans le catalogue : sans ce
// filtre, un modèle comme Stable Diffusion renvoyé par l'API serait proposé
// en silence comme modèle de conversation.
const IMAGE_MODEL_PATTERN = /qwen-image|diffusion|sdxl|flux|dall-?e|imagen|gpt-image/i;

async function listModels(apiKey, baseURL) {
    const openai = getClient(apiKey, baseURL);

    // Construire la liste à partir du catalogue centralisé
    const catalogChatModels = [
        ...nvidiaModels.getModelsByType('text'),
        ...nvidiaModels.getModelsByType('vision')
    ].map(m => ({
        id: m.id,
        name: m.name,
        type: m.type
    }));

    if (!openai) {
        return { chat: catalogChatModels };
    }

    try {
        const response = await openai.models.list();
        const chatModels = [...catalogChatModels];

        if (response.data && Array.isArray(response.data)) {
            response.data.forEach(m => {
                // Ignorer les modèles du catalogue autres que texte (déjà listés) et les modèles d'image
                const inCatalog = nvidiaModels.getModelDef(m.id);
                if (inCatalog && inCatalog.type !== 'text') return;
                if (IMAGE_MODEL_PATTERN.test(m.id)) return;
                // Éviter les doublons avec les modèles prioritaires
                if (!chatModels.some(pm => pm.id === m.id)) {
                    chatModels.push({ id: m.id, name: m.id, type: 'text' });
                }
            });
            // Les modèles prioritaires restent en tête, les autres triés alphabétiquement
            const others = chatModels.slice(catalogChatModels.length);
            others.sort((a, b) => a.name.localeCompare(b.name));

            return { chat: [...catalogChatModels, ...others] };
        }

        return { chat: catalogChatModels };
    } catch (error) {
        console.error("OpenAI/NVIDIA Models Error:", error);
        return { chat: catalogChatModels };
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
        return { ...fallback, ...parseLlmJson(response.choices[0].message.content, {}) };
    } catch (error) {
        console.error("[OrderRadar] NVIDIA classification error:", error.message);
        return fallback;
    }
}

module.exports = {
    generateProposals,
    chatWithAgent,
    listModels,
    classifyOrderIntent
};
