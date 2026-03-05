require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const ai = new GoogleGenAI({});

async function fetchModels() {
    try {
        console.log("Fetching available models...");
        // the client might be ai.models, let's explore it
        // The list models endpoint sometimes requires an options object or pagination
        // Let's use the REST API manually if the SDK fails

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await res.json();

        let models = data.models ? data.models.map(m => m.name).join('\n') : JSON.stringify(data);
        fs.writeFileSync('models_out.txt', models, 'utf8');
        console.log("Written to models_out.txt");
    } catch (e) {
        console.error("Error fetching models:", e);
    }
}

fetchModels();
