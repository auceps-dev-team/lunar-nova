const { Ollama } = require('ollama');
const orchestrator = require('./agents/orchestrator');
const { parseLlmJson, stripCodeFences } = require('./llmJson');

/**
 * Gets an Ollama client instance.
 * @param {string} apiKey - Optional API key for Ollama Cloud.
 * @returns {Ollama}
 */
function getClient(apiKey) {
    if (apiKey && apiKey.trim() !== '') {
        // Cloud mode: use the official cloud endpoint
        return new Ollama({ host: 'https://ollama.com', headers: { 'Authorization': `Bearer ${apiKey}` } });
    }
    // Local mode: use the standard local endpoint
    return new Ollama({ host: 'http://127.0.0.1:11434' });
}

async function generateProposals(chatContext, modelParam, apiKey) {
    if (!chatContext || !chatContext.messages || chatContext.messages.length === 0) {
        return { proposed_replies: [] };
    }

    let formattedChat = `Chat with: ${chatContext.contactName}\n\n`;
    chatContext.messages.forEach(msg => {
        formattedChat += `[${msg.time}] ${msg.sender}: ${msg.text}\n`;
    });

    const targetModel = modelParam || 'llama3';
    const copilotPersona = orchestrator.getPersona('copilot');
    const systemInstruction = copilotPersona ? copilotPersona.systemInstruction : "You are an assistive copilot.";

    try {
        const ollama = getClient(apiKey);
        const response = await ollama.chat({
            model: targetModel,
            messages: [
                { role: "system", content: systemInstruction + "\n\nCRITICAL: Return ONLY a valid JSON object with a 'proposed_replies' array of strings. Do not include markdown formatting." },
                { role: "user", content: formattedChat }
            ],
            format: "json",
            stream: false,
            options: {
                num_predict: 4096
            }
        });

        const parsed = parseLlmJson(response.message.content, null);
        if (parsed === null) {
            console.error("JSON Parse Error, Content:", response.message.content);
            return { proposed_replies: ["Erreur de parsing JSON depuis Ollama."] };
        }

        if (Array.isArray(parsed)) {
            return { proposed_replies: parsed };
        } else if (parsed.proposed_replies) {
            return parsed;
        } else {
            return { proposed_replies: ["Format inattendu retourné par Ollama."] };
        }
    } catch (error) {
        console.error("Ollama API Error:", error);
        return { proposed_replies: [`Ollama Error: ${error.message}`] };
    }
}

async function chatWithAgent(persona, message, imageParams, promptFormat, dbAgent = null, apiKey = null) {
    if (!message) return { response: "I didn't catch that. How can I help?" };

    let personaInstruction = "";
    let finalPromptFormat = promptFormat;

    if (dbAgent) {
        personaInstruction = dbAgent.system_instruction;
        finalPromptFormat = dbAgent.response_format === 'json' ? 'json' : promptFormat;
    } else {
        const p = orchestrator.getPersona(persona) || orchestrator.getPersona('creative');
        personaInstruction = p.systemInstruction;
        finalPromptFormat = orchestrator.requiresJsonFormat(persona) ? 'json' : promptFormat;
    }

    try {
        const messages = [
            { role: "system", content: personaInstruction }
        ];

        if (imageParams && imageParams.data) {
            messages.push({
                role: "user",
                content: message,
                images: [imageParams.data]
            });
        } else {
            messages.push({ role: "user", content: message });
        }

        if (finalPromptFormat === 'json') {
            messages[0].content += "\n\nCRITICAL: Return ONLY a valid JSON output.";
        }

        let selectedModel = 'llama3';
        if (dbAgent && dbAgent.model_override) {
            selectedModel = dbAgent.model_override;
        }

        const ollama = getClient(apiKey);
        const chatRequest = {
            model: selectedModel,
            messages: messages,
            stream: false,
            options: {
                num_predict: 4096
            }
        };

        if (finalPromptFormat === 'json') {
            chatRequest.format = 'json';
        }

        const response = await ollama.chat(chatRequest);
        let resultText = response.message.content;

        if (finalPromptFormat === 'json') {
            resultText = stripCodeFences(resultText);
        }

        return { response: resultText };
    } catch (error) {
        console.error(`Ollama Agent Error:`, error);
        return { response: "I am currently offline or experiencing a connection error via Ollama. Please check your connection or instance." };
    }
}

async function listModels(apiKey) {
    try {
        const ollama = getClient(apiKey);
        const response = await ollama.list();

        if (response.models && Array.isArray(response.models)) {
            const chatModels = response.models.map(m => ({ id: m.name, name: m.name }));
            return {
                chat: chatModels,
                image: [{ id: 'none', name: 'Génération d\'image non supportée en local' }]
            };
        }

        return { chat: [{ id: 'llama3', name: 'Llama 3' }], image: [] };
    } catch (error) {
        console.error("Ollama List Models Error:", error);
        return { chat: [{ id: 'llama3', name: 'Llama 3 (Indisponible)' }], image: [] };
    }
}

/**
 * classifyOrderIntent — classification structurée à un seul message (Order Radar).
 */
async function classifyOrderIntent(text, contactName, apiKey, modelParam) {
    const fallback = { is_order: false, confidence: 0, order_type: 'not_an_order', summary: '' };
    const targetModel = modelParam || 'llama3';
    const orderRadarPersona = orchestrator.getPersona('order_radar');
    const systemInstruction = orderRadarPersona ? orderRadarPersona.systemInstruction : '';

    try {
        const ollama = getClient(apiKey);
        const response = await ollama.chat({
            model: targetModel,
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: `Contact: ${contactName}\nMessage: "${text}"` }
            ],
            format: "json",
            stream: false,
            options: { num_predict: 512 }
        });

        return { ...fallback, ...parseLlmJson(response.message.content, {}) };
    } catch (error) {
        console.error("[OrderRadar] Ollama classification error:", error.message);
        return fallback;
    }
}

module.exports = {
    generateProposals,
    chatWithAgent,
    listModels,
    classifyOrderIntent
};
