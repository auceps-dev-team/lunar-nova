const { Ollama } = require('ollama');
const orchestrator = require('./agents/orchestrator');

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
            stream: false
        });

        let jsonText = response.message.content;
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch (e) {
            console.error("JSON Parse Error:", e, "Content:", jsonText);
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

        const ollama = getClient(apiKey);
        const options = {
            model: 'llama3', // Default local model
            messages: messages,
            stream: false
        };

        if (finalPromptFormat === 'json') {
            options.format = 'json';
        }

        const response = await ollama.chat(options);
        let resultText = response.message.content;

        if (finalPromptFormat === 'json') {
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
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

module.exports = {
    generateProposals,
    chatWithAgent,
    listModels
};
