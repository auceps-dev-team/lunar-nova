require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({});

async function test() {
    try {
        console.log("Generating image with imagen 1...");
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-001',
            prompt: 'A futuristic city',
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1'
            }
        });
        console.log("Success! Image generated.", response.generatedImages.length);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
