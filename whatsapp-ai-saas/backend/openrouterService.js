const orchestrator = require('./agents/orchestrator');
const db = require('./db');
const { parseLlmJson, stripCodeFences } = require('./llmJson');

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_FALLBACK_API_KEY = process.env.OPENROUTER_API_KEY || "";

// S'exécute au lancement pour cacher les modèles d'OpenRouter dans la DB
async function syncOpenRouterModels() {
    try {
        console.log('[OpenRouter] Vérification et synchronisation des modèles...');
        const cached = await db.getSetting('openrouter_models_cache', null);

        const _fetch = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;

        const response = await _fetch("https://openrouter.ai/api/v1/models", {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_FALLBACK_API_KEY}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'WaCopilote'
            }
        });

        const data = await response.json();

        if (data.data && Array.isArray(data.data)) {
            const chatModels = [];
            const imageModels = [];
            data.data.forEach(m => {
                if (m.architecture && m.architecture.modality && m.architecture.modality.includes('image')) {
                    imageModels.push({ id: m.id, name: m.name || m.id });
                } else {
                    chatModels.push({ id: m.id, name: m.name || m.id });
                }
            });
            if (imageModels.length === 0) imageModels.push({ id: 'none', name: 'Aucun modèle d\'image trouvé sur OpenRouter' });

            const modelsJson = JSON.stringify({ chat: chatModels, image: imageModels });

            if (modelsJson !== cached) {
                await db.setSetting('openrouter_models_cache', modelsJson);
                console.log(`[OpenRouter] Base de données mise à jour avec ${chatModels.length} modèles de conversation et ${imageModels.length} modèles d'images.`);
            } else {
                console.log('[OpenRouter] La liste des modèles est déjà à jour dans la base de données.');
            }
        }
    } catch (error) {
        console.error("[OpenRouter] Échec de la synchronisation des modèles:", error.message);
    }
}

// Retarder de 3 secondes pour s'assurer que la connexion SQLite est prête
setTimeout(syncOpenRouterModels, 3000);


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
        const _fetch = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;
        const response = await _fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'WaCopilote',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: targetModel,
                messages: [
                    { role: "system", content: systemInstruction + "\n\nCRITICAL: Return ONLY a valid JSON object with a 'proposed_replies' array of strings. Do not include markdown formatting or extra text." },
                    { role: "user", content: formattedChat }
                ],
                response_format: { type: "json_object" },
                max_tokens: 4096
            })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message || 'OpenRouter Error');
        }

        const parsed = parseLlmJson(data.choices[0].message.content, null);
        if (parsed === null) {
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
        const _fetch = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;
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

        let selectedModel = 'anthropic/claude-3.5-sonnet';
        if (dbAgent && dbAgent.model_override) {
            selectedModel = dbAgent.model_override;
        }

        const response = await _fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'WaCopilote',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: selectedModel,
                messages: messages,
                max_tokens: 4096
            })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message || 'OpenRouter Error');
        }

        let resultText = data.choices[0].message.content;

        if (finalPromptFormat === 'json') {
            resultText = stripCodeFences(resultText);
        }

        return { response: resultText };
    } catch (error) {
        console.error(`OpenRouter Agent Error:`, error);
        return { response: "I am currently offline or experiencing a connection error via OpenRouter. Please try again." };
    }
}

// La clé n'est pas utilisée : le catalogue est servi depuis le cache SQLite,
// alimenté par la synchronisation périodique. Le paramètre reste dans la
// signature, commune à tous les adaptateurs appelés par aiController.
async function listModels(_apiKey) {
    // Lecture directe et immédiate depuis le cache SQLite
    try {
        const cached = await db.getSetting('openrouter_models_cache', null);
        if (cached) {
            return JSON.parse(cached);
        }
        return { chat: [{ id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (En attente de synchro...)' }], image: [] };
    } catch (error) {
        console.error("OpenRouter DB Read Error:", error);
        return { chat: [{ id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Erreur Base de données)' }], image: [] };
    }
}

/**
 * classifyOrderIntent — classification structurée à un seul message (Order Radar).
 */
async function classifyOrderIntent(text, contactName, apiKey, modelParam) {
    const fallback = { is_order: false, confidence: 0, order_type: 'not_an_order', summary: '' };
    if (!apiKey) return fallback;

    const targetModel = modelParam || 'anthropic/claude-3.5-sonnet';
    const orderRadarPersona = orchestrator.getPersona('order_radar');
    const systemInstruction = orderRadarPersona ? orderRadarPersona.systemInstruction : '';

    try {
        const _fetch = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;
        const response = await _fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'WaCopilote',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: targetModel,
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: `Contact: ${contactName}\nMessage: "${text}"` }
                ],
                response_format: { type: "json_object" },
                max_tokens: 512
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message || 'OpenRouter Error');

        return { ...fallback, ...parseLlmJson(data.choices[0].message.content, {}) };
    } catch (error) {
        console.error("[OrderRadar] OpenRouter classification error:", error.message);
        return fallback;
    }
}

module.exports = {
    generateProposals,
    chatWithAgent,
    listModels,
    classifyOrderIntent
};