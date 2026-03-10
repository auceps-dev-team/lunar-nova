require('dotenv').config({ path: require('path').join(__dirname, 'backend', '.env') });
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testImageEdit() {
    try {
        const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-001',
            prompt: 'Make it a red dog',
            config: {
                // Trying to use Image editing with imagen 3.0? No, `@google/genai` uses generateImages for text-to-image.
                // Let's try gemini-2.5-flash which might not generate images, but we will test imagen-3.0
            }
        });
        console.log("Success text to image");
    } catch (e) { console.error("Error", e); }
}

testImageEdit();
