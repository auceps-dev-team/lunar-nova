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

        // Specialized logic for GLM-4.7 (Thinking mode)
        if (targetModel === 'z-ai/glm-4.7' || targetModel === 'z-ai/glm4.7') {
            completionArgs.extra_body = {
                "chat_template_kwargs": {
                    "enable_thinking": true,
                    "clear_thinking": false
                }
            };
            completionArgs.max_tokens = 16384;
        }

        if (finalPromptFormat === 'json') {
             completionArgs.response_format = { type: "json_object" };
        }

        const response = await openai.chat.completions.create(completionArgs);
        
        const choice = response.choices[0];
        let resultText = choice.message.content;

        // Handle reasoning_content for models that provide it (like GLM-4.7)
        if (choice.message.reasoning_content) {
            resultText = `*Thinking:* ${choice.message.reasoning_content}\n\n${resultText}`;
        }

        if (finalPromptFormat === 'json') {
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        return { response: resultText };
    } catch (error) {
        console.error(`OpenAI/NVIDIA Agent Error:`, error.response ? error.response.data : error.message);
        
        let errorMsg = error.message;
        if (error.response && error.response.data) {
            if (error.response.data.detail) {
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
        // Use true image generation endpoint for stability/SDXL models
        if (modelId.includes('stable-diffusion') || modelId.includes('sdxl') || modelId === 'stabilityai/stable-diffusion-3-medium') {
            const axios = require('axios');
            
            // Si on est sur NVIDIA, l'endpoint est diffAcrent du format OpenAI classique
            if (baseURL.includes('nvidia')) {
                const nvidiaResponse = await axios.post(
                    `https://ai.api.nvidia.com/v1/genai/${modelId}`,
                    {
                        prompt: prompt || "Generate a fashion photo",
                        mode: "text-to-image",
                        model: "sd3",
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
                return {
                    success: true,
                    // NVIDIA API returns { image: "base64..." }
                    imageBytes: nvidiaResponse.data.image
                };
            } else {
                // Standard OpenAI compatibility
                const response = await openai.images.generate({
                    model: modelId,
                    prompt: prompt || "Generate a fashion photo",
                    n: 1,
                    size: "1024x1024",
                    response_format: "b64_json"
                });
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
            if (error.response.data.detail) {
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
    const catalogChatModels = nvidiaModels.getModelsByType('text').map(m => ({
        id: m.id,
        name: m.name,
        type: m.type
    }));

    const catalogImageModels = [
        ...nvidiaModels.getModelsByType('vision'),
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
                // Ignorer les modèles vision/image-edit qui sont dans catalogImageModels
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


module.exports = {
    generateProposals,
    chatWithAgent,
    analyzeOrEditImage,
    listModels
};
