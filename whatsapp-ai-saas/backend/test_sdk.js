require('dotenv').config({ path: require('path').join(__dirname, 'backend', '.env') });
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testAgentImage() {
    try {
        console.log("Testing Agent Image...");
        // A simple 1x1 transparent png
        const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: "Describe this image" },
                        { inlineData: { data: base64, mimeType: "image/png" } }
                    ]
                }
            ]
        });
        console.log("Agent Success:", response.text);
    } catch (e) {
        console.error("Agent Error:", e.message);
    }
}

async function testImageEdit() {
    try {
        console.log("Testing Image Editing...");
        const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp-image-generation',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { data: base64, mimeType: "image/png" } },
                        { text: "Make it red" }
                    ]
                }
            ],
            config: {
                responseModalities: ["IMAGE", "TEXT"]
            }
        });
        console.log("Image Edit Success. Got image?");
    } catch (e) {
        console.error("Image Edit Error:", e.message);
    }
}

testAgentImage().then(testImageEdit);
