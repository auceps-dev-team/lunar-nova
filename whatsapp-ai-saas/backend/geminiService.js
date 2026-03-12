require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { GoogleGenAI } = require('@google/genai');

// Initialize the Gemini client
// Note: Requires GEMINI_API_KEY in the .env file
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const orchestrator = require('./agents/orchestrator');

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

async function chatWithAgent(personaId, message, imageParams, promptFormat = 'text') {
    if (!message) return { response: "I didn't catch that. How can I help?" };

    const persona = orchestrator.getPersona(personaId) || orchestrator.getPersona('creative');

    // Default to the persona config, fallback to passed args
    const finalPromptFormat = orchestrator.requiresJsonFormat(personaId) ? 'json' : promptFormat;
    const personaInstruction = persona.systemInstruction;

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

${prompt}

The output image should be a ${dims.label} aspect ratio (approximately ${dims.w}x${dims.h} pixels). Create a photorealistic, magazine-quality editorial photo.`
};

async function generateImage(prompt, configAspectRatio = '1:1', imageParams = null, editMode = false, mode = 'product') {
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

            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-image-preview',
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
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
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

module.exports = {
    generateProposals,
    chatWithAgent,
    generateImage
};
