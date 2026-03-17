require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { GoogleGenAI } = require('@google/genai');

// Initialize the Gemini client
// Note: Requires GEMINI_API_KEY in the .env file
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const orchestrator = require('./agents/orchestrator');
const db = require('./db');

// S'exécute au lancement pour cacher les modèles Gemini dans la DB
async function syncGeminiModels() {
    try {
        console.log('[Gemini] Vérification et synchronisation des modèles...');
        const cached = await db.getSetting('gemini_models_cache', null);

        const _fetch = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;
        const res = await _fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await res.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const chatModels = [];
        const imageModels = [];
        if (data.models) {
            data.models.forEach(m => {
                const id = m.name.replace('models/', '');
                if (id.includes('gemini') && !id.includes('embedding') && !id.includes('aqa')) {
                    chatModels.push({ id: id, name: m.displayName || id });
                }
                if (id.includes('imagen') || id.includes('veo')) {
                    imageModels.push({ id: id, name: m.displayName || id });
                }
            });
        }

        console.log(`[Gemini] Début du ping de vérification sur ${chatModels.length} modèles conversationnels (pour écarter les inaccessibles)...`);
        const verifiedChatModels = [];

        for (const m of chatModels) {
            try {
                // Ping test minimal
                await ai.models.generateContent({
                    model: m.id,
                    contents: "ping",
                    config: { maxOutputTokens: 1 }
                });
                verifiedChatModels.push(m);
            } catch (err) {
                // Si c'est un problème de quota (429) ou de sécurité, c'est que le modèle est accessible techniquement
                if (err.status === 429 || (err.message && err.message.toLowerCase().includes('quota'))) {
                    verifiedChatModels.push(m);
                } else {
                    console.log(`[Gemini] ⚠️ Modèle ignoré (non accessible / facturation) : ${m.id}`);
                }
            }
            // Petit délai pour éviter de déclencher trop vite le Rate Limit de l'API gratuite
            await new Promise(r => setTimeout(r, 400));
        }

        // Manual fallback for Imagen if it isn't listed
        if (imageModels.length === 0) {
            imageModels.push({ id: 'imagen-4.0-generate-001', name: 'Imagen 4' });
        }

        const modelsJson = JSON.stringify({ chat: verifiedChatModels, image: imageModels });

        if (modelsJson !== cached) {
            await db.setSetting('gemini_models_cache', modelsJson);
            console.log(`[Gemini] Base de données mise à jour avec ${verifiedChatModels.length} modèles validés et ${imageModels.length} modèles d'images.`);
        } else {
            console.log('[Gemini] La liste des modèles est déjà à jour dans la base de données.');
        }
    } catch (error) {
        console.error("[Gemini] Échec de la synchronisation des modèles:", error.message);
    }
}

// Retarder de 3 secondes pour s'assurer que la connexion SQLite est prête
setTimeout(syncGeminiModels, 3000);

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
        let targetModel = modelParam || 'gemini-1.5-pro';
        if (targetModel === 'gemini-1.5-flash') {
            targetModel = 'gemini-1.5-flash-latest';
        }

        const copilotPersona = orchestrator.getPersona('copilot');

        const response = await ai.models.generateContent({
            model: targetModel,
            contents: formattedChat,
            config: {
                systemInstruction: copilotPersona ? copilotPersona.systemInstruction : '',
                responseMimeType: "application/json",
            }
        });

        const jsonText = response.text;
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Gemini API Error:", error);

        // Extract a readable message from the Google API error if possible
        const errMessage = error.message || error.toString();
        let userMessage = "Error connecting to Assistive Copilot.";

        if (errMessage.includes('API key not valid') || errMessage.toLowerCase().includes('api key')) {
            userMessage = "API Key Error: Please check that your Gemini API key is valid in backend/.env.";
        } else if (errMessage.includes('location is not supported')) {
            userMessage = "Region Error: Gemini API is not supported in your region, or requires billing.";
        } else {
            userMessage = `AI Error: ${errMessage}`;
        }

        return { proposed_replies: [userMessage] };
    }
}

async function chatWithAgent(personaId, message, imageParams, promptFormat = 'text', dbAgent = null) {
    if (!message) return { response: "I didn't catch that. How can I help?" };

    let personaInstruction = "";
    let finalPromptFormat = promptFormat;

    if (dbAgent) {
        personaInstruction = dbAgent.system_instruction;
        finalPromptFormat = dbAgent.response_format === 'json' ? 'json' : promptFormat;
    } else {
        const persona = orchestrator.getPersona(personaId) || orchestrator.getPersona('creative');
        finalPromptFormat = orchestrator.requiresJsonFormat(personaId) ? 'json' : promptFormat;
        personaInstruction = persona.systemInstruction;
    }

    try {
        let contents;
        if (imageParams && imageParams.data && imageParams.mimeType) {
            contents = [
                {
                    role: 'user',
                    parts: [
                        { text: message },
                        {
                            inlineData: {
                                data: imageParams.data,
                                mimeType: imageParams.mimeType
                            }
                        }
                    ]
                }
            ];
        } else {
            contents = message;
        }

        const config = { systemInstruction: personaInstruction };
        if (finalPromptFormat === 'json') {
            config.responseMimeType = "application/json";
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: config
        });

        return { response: response.text };
    } catch (error) {
        console.error(`Gemini Agent Error (${personaId}):`, error);
        return { response: "I am currently offline or experiencing a connection error. Please try again." };
    }
}

const PROMPT_TEMPLATES = {
    product: (prompt, dims) => `Generate a high-end commercial product photograph. The EXACT product shown in the reference image must be center-stage. 
    
CRITICAL: The product's identity, labels, logo, and shape must remain 100% IDENTICAL. Do NOT alter the product. 

${prompt}

The output image should be a ${dims.label} aspect ratio. Create a clean, premium visual for a business catalog with professional studio lighting.`,

    fashion: (prompt, dims) => `Generate a high-end fashion photoshoot image. A professional model is wearing the EXACT product shown in the reference image.
    
    CRITICAL: The garment/product in the reference image must appear IDENTICALLY on the model — same color, material, texture, pattern, logos, labels, and design details. Do NOT change the product in any way.
    
    SAFETY & MODESTY RULES:
    - The model MUST be wearing a complete, professional, and modest outfit.
    - If the product is a top (T-shirt, polo, shirt), the model MUST also be wearing matching pants, a long skirt, or professional trousers.
    - The model MUST look directly at the camera (maintaining eye contact).
    - Suggestive poses, semi-nude results, swimsuits, or underwear looks are STRICTLY FORBIDDEN.
    - Ensure the model is fully clothed in a way that is appropriate for a high-end commercial fashion catalogue.

    ${prompt}

    The output image should be a ${dims.label} aspect ratio (approximately ${dims.w}x${dims.h} pixels). Create a photorealistic, magazine-quality editorial photo.`
};

async function generateImage(prompt, configAspectRatio = '1:1', imageParams = null, editMode = false, mode = 'product', imageModel = '') {
    // --- STRATEGY --- 
    // If a reference image is provided: use Gemini Flash Image (image editing/uplifting mode)
    //   → This PRESERVES the product identity (logo, shape, labels)
    // If no image: use Imagen 4 for pure text-to-image

    // Map UI aspect ratios to Gemini accepted format
    const aspectMap = {
        '1:1': '1:1',
        '3:4': '3:4',
        '4:3': '4:3',
        '9:16': '9:16',
        '16:9': '16:9'
    };
    const geminiAspectRatio = aspectMap[configAspectRatio] || '1:1';

    // Map aspect ratios to pixel dimensions for prompt guidance
    const dimensionMap = {
        '1:1': { w: 1024, h: 1024, label: 'square (1:1)' },
        '3:4': { w: 768, h: 1024, label: 'vertical/portrait (3:4)' },
        '4:3': { w: 1024, h: 768, label: 'horizontal/landscape (4:3)' },
        '16:9': { w: 1280, h: 720, label: 'widescreen (16:9)' }
    };
    const dims = dimensionMap[configAspectRatio] || dimensionMap['1:1'];

    if (imageParams && imageParams.data && imageParams.mimeType) {
        // ---- IMAGE EDITING / PRODUCT UPLIFTING MODE ----
        try {
            let finalPrompt = prompt;
            if (editMode) {
                console.log(`[generateImage] Pure edit mode active. Using raw prompt: ${prompt}`);
            } else {
                const template = PROMPT_TEMPLATES[mode] || PROMPT_TEMPLATES.product;
                console.log(`[generateImage] Image reference received — using mode: ${mode} (aspect: ${dims.label})`);
                finalPrompt = template(prompt, dims);
            }

            const editModel = imageModel && imageModel.includes('gemini') ? imageModel : 'gemini-3.1-flash-image-preview';

            if (imageModel && imageModel.includes('imagen')) {
                return { error: "Erreur : Vous avez sélectionné un modèle Text-to-Image (Imagen) pour une tâche de retouche d'image (Image-to-Image). Veuillez sélectionner un modèle multimodal (ex: Gemini Flash) dans les paramètres pour cette action." };
            }

            const response = await ai.models.generateContent({
                model: editModel,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                inlineData: {
                                    data: imageParams.data,
                                    mimeType: imageParams.mimeType
                                }
                            },
                            { text: finalPrompt }
                        ]
                    }
                ],
                config: {
                    responseModalities: ['IMAGE', 'TEXT'],
                }
            });

            // Extract the image from the response
            if (response.candidates && response.candidates[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        return { imageBytes: part.inlineData.data };
                    }
                }
            }
            return { error: "L'édition d'image n'a pas retourné de résultat visuel." };
        } catch (error) {
            console.error("Gemini Image Edit Error:", error);
            // Fallback to Imagen 4 text-only if edit fails
            console.log('[generateImage] Edit mode failed, falling back to Imagen 4...');
        }
    }

    // ---- TEXT-TO-IMAGE MODE (Imagen 4) ----
    try {
        const genModel = imageModel && imageModel.includes('imagen') ? imageModel : 'imagen-4.0-generate-001';

        if (imageModel && imageModel.includes('gemini')) {
            return { error: "Erreur : Vous avez sélectionné un modèle Multimodal (Gemini Flash) pour une tâche de création pure (Text-to-Image). Veuillez sélectionner un modèle Imagen dans les paramètres." };
        }

        const response = await ai.models.generateImages({
            model: genModel,
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: geminiAspectRatio
            }
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            return { imageBytes: response.generatedImages[0].image.imageBytes };
        } else {
            return { error: 'No image generated.' };
        }
    } catch (error) {
        console.error("Imagen API Error:", error);
        const errMessage = error.message || error.toString();
        let userMessage = errMessage;

        if (errMessage.includes('404') || errMessage.includes('not found')) {
            userMessage = "La génération d'image n'est pas activée avec cette clé API (Imagen 4 non disponible).";
        } else if (errMessage.includes('billing')) {
            userMessage = "La génération d'image nécessite un compte payant / billing activé sur Google Cloud.";
        }

        return { error: userMessage };
    }
}

async function listModels() {
    try {
        const cached = await db.getSetting('gemini_models_cache', null);
        if (cached) {
            return JSON.parse(cached);
        }
        return {
            chat: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (En attente de synchro...)' }],
            image: [{ id: 'imagen-4.0-generate-001', name: 'Imagen 4 (En attente de synchro...)' }]
        };
    } catch (error) {
        console.error("Gemini DB Read Error:", error);
        return {
            chat: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Erreur Base de données)' }],
            image: [{ id: 'imagen-4.0-generate-001', name: 'Imagen 4 (Erreur Base de données)' }]
        };
    }
}

module.exports = {
    generateProposals,
    chatWithAgent,
    generateImage,
    listModels
};
