// quiet: true — sinon dotenv imprime sa bannière sur stdout à chaque require(),
// ce qui corrompt le flux JSON-RPC du serveur MCP et la sortie --json du CLI.
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const { GoogleGenAI } = require('@google/genai');
const db = require('./db');
const { parseLlmJson } = require('./llmJson');

/**
 * Client du SDK, version d'API fixée à `v1beta`.
 *
 * @google/genai 3 appelle par défaut `v1` (1.x appelait `v1beta`). Lu dans les
 * notes de la 3.0.0, non vérifié par un appel réel
 * (https://github.com/googleapis/js-genai/releases/tag/v3.0.0) : les alias
 * `gemini-*-latest`, certains modèles `-preview` et la mise en cache de
 * contexte n'existent pas en `v1`. Or la liste de modèles offerte à
 * l'utilisateur vient de `v1beta/models` (syncGeminiModels) : sans ce réglage,
 * un modèle de cette liste pouvait ne plus exister là où le SDK l'appelle.
 * Test : geminiApiVersion.test.js.
 */
function creerClientGemini(apiKey) {
    return new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
}

// Helper function to get Gemini Client dynamically to support runtime API key updates
async function getGeminiClient(modality = 'none', requestedModel = '') {
    // modality: 'text' or 'none'. Le mode 'image' (et son quota de 40 images
    // par mois sur la clé par défaut) a disparu avec la génération d'image.

    let key = await db.getSetting('gemini_api_key', '');
    let isDefaultKey = false;
    
    if (!key) {
        key = process.env.GEMINI_API_KEY;
        isDefaultKey = true;
    }

    if (!key || key.includes('your-gemini-api-key') || key.length < 10) {
        throw new Error('API key not valid');
    }

    if (isDefaultKey && modality === 'text') {
        // Clé par défaut : modèles de conversation limités.
        const allowedModels = ['gemini-2.5-flash', 'gemini-3-pro', 'gemini-2.5-flash-latest'];
        if (!allowedModels.includes(requestedModel) && requestedModel !== '') {
            throw new Error('MODEL_RESTRICTED');
        }
    }

    return {
        client: creerClientGemini(key),
        isDefaultKey: isDefaultKey
    };
}

const orchestrator = require('./agents/orchestrator');

// S'exécute au lancement pour cacher les modèles Gemini dans la DB
async function syncGeminiModels() {
    try {
        // stderr : ce sync tourne en tâche de fond (setTimeout) quel que soit le
        // process qui require() ce module (serveur Express, CLI, serveur MCP) — le
        // CLI (--json) et le MCP (JSON-RPC sur stdout) ne doivent recevoir aucune
        // sortie non protocolaire, même différée de 3s.
        console.error('[Gemini] Vérification et synchronisation des modèles...');
        const cached = await db.getSetting('gemini_models_cache', null);

        const _fetch = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;
        const key = process.env.GEMINI_API_KEY;
        if (!key) {
            console.error('[Gemini] Aucune clé API, synchronisation ignorée.');
            return;
        }
        const res = await _fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        // Modèles de conversation seulement : les modèles d'image (Imagen,
        // « flash-image », Veo) ne servent plus depuis le retrait de la
        // génération d'image, et en sont exclus.
        const chatModels = [];
        if (data.models) {
            data.models.forEach(m => {
                const id = m.name.replace('models/', '');
                const isImageModel = id.includes('imagen') || id.includes('veo') ||
                    id.includes('flash-image') || id.includes('pro-image');
                if (id.includes('gemini') && !id.includes('embedding') && !id.includes('aqa') && !isImageModel) {
                    chatModels.push({ id: id, name: m.displayName || id });
                }
            });
        }

        const modelsJson = JSON.stringify({ chat: chatModels });

        if (!cached || modelsJson !== cached) {
            await db.setSetting('gemini_models_cache', modelsJson);
            console.error(`[Gemini] Cache mis à jour : ${chatModels.length} modèles chat.`);
        } else {
            console.error('[Gemini] La liste des modèles est déjà à jour.');
        }
    } catch (error) {
        console.error("[Gemini] Échec de la synchronisation des modèles:", error.message);
    }
}

// Retarder de 3 secondes pour s'assurer que la connexion SQLite est prête.
// Jamais sous Vitest : même raison que dans openrouterService.js (écriture
// SQLite en cours à la fin d'un fichier de test → arrêt natif de Vitest).
if (!process.env.VITEST) setTimeout(syncGeminiModels, 3000);

async function generateProposals(chatContext, modelParam) {
    if (!chatContext || !chatContext.messages || chatContext.messages.length === 0) {
        return { proposed_replies: [] };
    }

    // Format chat context into a readable string
    let formattedChat = `Chat with: ${chatContext.contactName}\n\n`;
    chatContext.messages.forEach(msg => {
        formattedChat += `[${msg.time}] ${msg.sender}: ${msg.text}\n`;
    });

    try {
        let targetModel = modelParam || 'gemini-2.5-flash';
        if (targetModel === 'gemini-1.5-flash') {
            targetModel = 'gemini-1.5-flash-latest';
        }

        const copilotPersona = orchestrator.getPersona('copilot');

        const { client } = await getGeminiClient('text', targetModel);

        const response = await client.models.generateContent({
            model: targetModel,
            contents: formattedChat,
            config: {
                systemInstruction: (copilotPersona ? copilotPersona.systemInstruction : '') + `\n\nCRITICAL INSTRUCTION: You MUST strictly return a JSON object matching this schema: { "proposed_replies": [ "Option 1 text", "Option 2 text", "Option 3 text" ] } Do not output markdown code blocks.`,
                responseMimeType: "application/json",
            }
        });

        // responseMimeType demande du JSON pur, mais le modèle l'encadre parfois
        // malgré tout — parseLlmJson absorbe les deux cas.
        const parsed = parseLlmJson(response.text, null);
        if (parsed === null) {
            throw new Error('Réponse Gemini non analysable en JSON.');
        }
        return parsed;
    } catch (error) {
        console.error("Gemini API Error:", error);

        // Extract a readable message from the Google API error if possible
        const errMessage = error.message || error.toString();
        let userMessage = "Error connecting to Assistive Copilot.";

        if (errMessage.includes('API key not valid') || errMessage.toLowerCase().includes('api key')) {
            userMessage = "API Key Error: Please check that your Gemini API key is valid in backend/.env.";
        } else if (errMessage.includes('location is not supported')) {
            userMessage = "Region Error: Gemini API is not supported in your region, or requires billing.";
        } else if (errMessage.includes('MODEL_RESTRICTED')) {
            userMessage = "Free Tier Limit: This model is not available on the free tier. Please add your own Gemini API key in Settings.";
        } else {
            userMessage = `AI Error: ${errMessage}`;
        }

        return { proposed_replies: [userMessage] };
    }
}

async function chatWithAgent(personaId, message, imageParams, attachments, promptFormat = 'text', dbAgent = null, chatHistory = null, currentTasks = null) {
    if (!message && (!chatHistory || chatHistory.length === 0)) return { response: "I didn't catch that. How can I help?" };

    let personaInstruction = "";
    let finalPromptFormat = promptFormat;

    if (dbAgent) {
        personaInstruction = dbAgent.system_instruction;
        finalPromptFormat = dbAgent.response_format === 'json' ? 'json' : promptFormat;
    } else {
        // Agent inconnu : repli sur le copilote (l'ancien repli, « creative »,
        // était un directeur artistique d'images, retiré avec la génération).
        const persona = orchestrator.getPersona(personaId) || orchestrator.getPersona('copilot');
        finalPromptFormat = orchestrator.requiresJsonFormat(personaId) ? 'json' : promptFormat;
        personaInstruction = persona.systemInstruction;
    }

    if (currentTasks && personaId === 'ella') {
        personaInstruction += `\n\n[CURRENT_TASKS]: ${JSON.stringify(currentTasks)}`;
    }

    try {
        let contents = [];

        if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
            contents = chatHistory.map(msg => ({
                role: msg.role === 'agent' ? 'model' : 'user',
                parts: [{ text: msg.text }]
            }));

            // Attach all media to the last user message
            if (attachments && attachments.length > 0) {
                const lastMsg = contents[contents.length - 1];
                if (lastMsg.role === 'user') {
                    for (const att of attachments) {
                        const base64Data = att.data.includes(',') ? att.data.split(',')[1] : att.data;
                        lastMsg.parts.push({
                            inlineData: { data: base64Data, mimeType: att.mimeType }
                        });
                    }
                }
            } else if (imageParams && imageParams.data && imageParams.mimeType) {
                const lastMsg = contents[contents.length - 1];
                if (lastMsg.role === 'user') {
                    const base64Data = imageParams.data.includes(',') ? imageParams.data.split(',')[1] : imageParams.data;
                    lastMsg.parts.push({
                        inlineData: { data: base64Data, mimeType: imageParams.mimeType }
                    });
                }
            }
        } else {
            const parts = [{ text: message }];
            if (attachments && attachments.length > 0) {
                for (const att of attachments) {
                    parts.push({ inlineData: { data: att.data, mimeType: att.mimeType } });
                }
            } else if (imageParams && imageParams.data && imageParams.mimeType) {
                parts.push({ inlineData: { data: imageParams.data, mimeType: imageParams.mimeType } });
            }
            
            contents = [{ role: 'user', parts }];
        }

        const config = {
            systemInstruction: personaInstruction,
            generationConfig: {
                maxOutputTokens: 4096,
                temperature: 0.7,
            }
        };
        if (finalPromptFormat === 'json') {
            config.responseMimeType = "application/json";
        }

        let selectedModel = 'gemini-2.5-flash';
        if (dbAgent && dbAgent.model_override) {
            selectedModel = dbAgent.model_override;
        }

        const { client } = await getGeminiClient('text', selectedModel);

        const response = await client.models.generateContent({
            model: selectedModel,
            contents: contents,
            config: config
        });

        return { response: response.text };
    } catch (error) {
        const isKeyErr = error && error.message && (
            error.message.includes('API key not valid') ||
            error.message.includes('API_KEY_INVALID') ||
            error.message.includes('API key not configured')
        );
        if (!isKeyErr) {
            console.error(`Gemini Agent Error (${personaId}):`, error.message || error);
        }
        throw error;
    }
}

async function listModels() {
    const FALLBACK_CHAT = [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }];

    try {
        const cached = await db.getSetting('gemini_models_cache', null);
        if (cached && cached !== 'null') {
            // Un cache écrit avant le retrait de la génération d'image porte
            // encore une clé `image` : seule la liste de conversation est rendue.
            const parsed = JSON.parse(cached);
            return { chat: Array.isArray(parsed.chat) && parsed.chat.length > 0 ? parsed.chat : FALLBACK_CHAT };
        }
        return { chat: FALLBACK_CHAT };
    } catch (error) {
        console.error("Gemini DB Read Error:", error);
        return { chat: FALLBACK_CHAT };
    }
}

/**
 * classifyOrderIntent — classification structurée à un seul message (Order Radar).
 * Utilise le client Gemini résolu normalement (clé utilisateur > clé système),
 * contrairement à l'ancien classifyWithGemini() de orderListener.js qui
 * appelait GoogleGenAI directement avec process.env.GEMINI_API_KEY.
 */
async function classifyOrderIntent(text, contactName, modelParam) {
    const fallback = { is_order: false, confidence: 0, order_type: 'not_an_order', summary: '' };
    try {
        const targetModel = modelParam || 'gemini-2.5-flash';
        const orderRadarPersona = orchestrator.getPersona('order_radar');
        const { client } = await getGeminiClient('text', targetModel);

        const response = await client.models.generateContent({
            model: targetModel,
            contents: `Contact: ${contactName}\nMessage: "${text}"`,
            config: {
                systemInstruction: orderRadarPersona ? orderRadarPersona.systemInstruction : '',
                responseMimeType: "application/json",
            }
        });

        return { ...fallback, ...parseLlmJson(response.text, {}) };
    } catch (error) {
        console.error("[OrderRadar] Gemini classification error:", error.message);
        return fallback;
    }
}

/**
 * Transcrit un extrait audio. Utilisé pour les notes vocales WhatsApp, que
 * l'observateur de commandes ne sait pas lire (elles ne portent pas de texte).
 *
 * Contrairement à classifyOrderIntent, cette fonction **lève** en cas d'échec
 * au lieu de renvoyer un repli vide : une transcription ratée silencieusement
 * se confondrait avec un vocal sans parole, et le vocal disparaîtrait du flux
 * sans que personne ne le sache. L'appelant décide quoi en faire.
 *
 * @param {Buffer|string} audio  octets, ou base64 (préfixe `data:` toléré)
 * @param {string} mimeType      ex. 'audio/ogg; codecs=opus'
 * @param {object} [options]
 * @param {string} [options.model]         modèle à utiliser
 * @param {string} [options.languageHint]  langue attendue, guide le modèle
 * @returns {Promise<{ text: string, language: string|null, model: string }>}
 */
async function transcribeAudio(audio, mimeType, options = {}) {
    if (!audio) throw new Error('transcribeAudio : aucun audio fourni.');
    if (!mimeType) throw new Error('transcribeAudio : mimeType obligatoire.');

    const base64 = Buffer.isBuffer(audio)
        ? audio.toString('base64')
        : String(audio).includes(',') ? String(audio).split(',')[1] : String(audio);

    if (!base64) throw new Error('transcribeAudio : audio vide après normalisation.');

    const targetModel = options.model || 'gemini-2.5-flash';
    const { client } = await getGeminiClient('text', targetModel);

    const hint = options.languageHint
        ? ` L'audio est probablement en ${options.languageHint}.`
        : '';

    const response = await client.models.generateContent({
        model: targetModel,
        contents: [{
            role: 'user',
            parts: [
                { inlineData: { data: base64, mimeType } },
                {
                    text: `Transcris cet audio mot à mot.${hint} Réponds en JSON strict `
                        + `{"text": "<transcription>", "language": "<code ISO 639-1>"}. `
                        + `Si l'audio ne contient aucune parole intelligible, renvoie `
                        + `{"text": "", "language": null}. N'ajoute ni commentaire ni traduction.`
                }
            ]
        }],
        config: { responseMimeType: 'application/json' }
    });

    const parsed = parseLlmJson(response.text, null);
    if (!parsed || typeof parsed.text !== 'string') {
        throw new Error('transcribeAudio : réponse du modèle inexploitable.');
    }

    return {
        text: parsed.text,
        language: parsed.language || null,
        model: targetModel
    };
}

module.exports = {
    creerClientGemini,
    generateProposals,
    chatWithAgent,
    listModels,
    classifyOrderIntent,
    transcribeAudio
};
