const fetch = require('node-fetch');
const orchestrator = require('./agents/orchestrator');

const OLLAMA_URL = "http://localhost:11434/api/chat";

async function generateProposals(chatContext, modelParam) {
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
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: targetModel,
                messages: [
                    { role: "system", content: systemInstruction + "\n\nCRITICAL: Return ONLY a valid JSON object with a 'proposed_replies' array of strings. Do not include markdown formatting." },
                    { role: "user", content: formattedChat }
                ],
                format: "json", // Ollama supports this format parameter to force json
                stream: false
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        let jsonText = data.message.content;
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch (e) {
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
        return { proposed_replies: [`Ollama Error: Assurez-vous que Ollama tourne sur le port 11434. (${error.message})`] };
    }
}

async function chatWithAgent(persona, message, imageParams, promptFormat, dbAgent = null) {
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

        // Ollama supports images in base64 via 'images' array inside the message
        if (imageParams && imageParams.data) {
            messages.push({
                role: "user",
                content: message,
                images: [imageParams.data] // Base64 string directly
            });
        } else {
            messages.push({ role: "user", content: message });
        }

        if (finalPromptFormat === 'json') {
            messages[0].content += "\n\nCRITICAL: Return ONLY a valid JSON output.";
        }

        const body = {
            model: 'llama3', // Default local model
            messages: messages,
            stream: false
        };

        if (finalPromptFormat === 'json') {
            body.format = 'json';
        }

        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        let resultText = data.message.content;

        if (finalPromptFormat === 'json') {
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        return { response: resultText };
    } catch (error) {
        console.error(`Ollama Agent Error:`, error);
        return { response: "I am currently offline or experiencing a connection error via Ollama. Please check if Ollama is running." };
    }
}

async function listModels() {
    try {
        const response = await fetch("http://localhost:11434/api/tags");
        const data = await response.json();

        if (data.models && Array.isArray(data.models)) {
            const chatModels = data.models.map(m => ({ id: m.name, name: m.name }));
            return { chat: chatModels, image: [{ id: 'none', name: 'Génération d\'image non supportée en local' }] };
        }

        return { chat: [{ id: 'llama3', name: 'Llama 3' }], image: [] };
    } catch (error) {
        console.error("Ollama List Models Error:", error);
        return { chat: [{ id: 'llama3', name: 'Llama 3 (Ollama Hors Ligne)' }], image: [] };
    }
}

module.exports = {
    generateProposals,
    chatWithAgent,
    listModels
};
