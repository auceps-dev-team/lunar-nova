require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({});

async function test() {
    try {
        console.log("Fetching models...");
        const response = await ai.models.list();
        for (const m of response.models) {
            console.log(m.name, m.supportedActions);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
