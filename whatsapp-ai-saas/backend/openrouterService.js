const fetch = require('node-fetch');
const orchestrator = require('./agents/orchestrator');

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function generateProposals(chatContext, modelParam, apiKey) {
    if (!apiKey) {
        return { proposed_replies: ["Error: OpenRouter API key not configured in settings."] };
    }

    if (!chatContext || !chatContext.messages || chatContext.messages.length === 0) {
        return { proposed_replies: [] };
    }

    let formattedChat = `Chat with: ${chatContext.contactName}\n\n`;
    chatContext.messages.forEach(msg => {
        formattedChat += `[${msg.time}] ${msg.sender}: ${msg.text}\n`;
    });

    const targetModel = modelParam || 'anthropic/claude-3.5-sonnet';
    const copilotPersona = orchestrator.getPersona('copilot');
    const systemInstruction = copilotPersona ? copilotPersona.systemInstruction : "You are an assistive copilot.";

    try {
        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Lunar Nova',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: targetModel,
                messages: [
                    { role: "system", content: systemInstruction + "\n\nCRITICAL: Return ONLY a valid JSON object with a 'proposed_replies' array of strings. Do not include markdown formatting or extra text." },
                    { role: "user", content: formattedChat }
                ],
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message || 'OpenRouter Error');
        }

        let jsonText = data.choices[0].message.content;
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch (e) {
            return { proposed_replies: ["Erreur de parsing JSON depuis OpenRouter."] };
        }

        if (Array.isArray(parsed)) {
            return { proposed_replies: parsed };
        } else if (parsed.proposed_replies) {
            return parsed;
        } else {
            return { proposed_replies: ["Format inattendu retourné par l'API."] };
        }
    } catch (error) {
        console.error("OpenRouter API Error:", error);
        return { proposed_replies: [`OpenRouter Error: ${error.message}`] };
    }
}

async function chatWithAgent(persona, message, imageParams, promptFormat, apiKey, dbAgent = null) {
    if (!apiKey) {
        return { response: "Error: OpenRouter API key not configured in settings." };
    }
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

        // OpenRouter Vision supports image_url (base64)
        if (imageParams && imageParams.data && imageParams.mimeType) {
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: message },
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

        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Lunar Nova',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'anthropic/claude-3.5-sonnet', // Default robust model
                messages: messages
            })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message || 'OpenRouter Error');
        }

        let resultText = data.choices[0].message.content;

        if (finalPromptFormat === 'json') {
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        return { response: resultText };
    } catch (error) {
        console.error(`OpenRouter Agent Error:`, error);
        return { response: "I am currently offline or experiencing a connection error via OpenRouter. Please try again." };
    }
}

async function listModels(apiKey) {
    if (!apiKey) {
        return [{ id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Clé API requise)' }];
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Lunar Nova'
            }
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || 'OpenRouter Error');
        }

        if (data.data && Array.isArray(data.data)) {
            return data.data.map(m => ({ id: m.id, name: m.name || m.id }));
        }

        return [{ id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' }];
    } catch (error) {
        console.error("OpenRouter List Models Error:", error);
        return [{ id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Erreur Fetch)' }];
    }
}

module.exports = {
    generateProposals,
    chatWithAgent,
    listModels
};
