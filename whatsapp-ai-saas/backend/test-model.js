const fs = require('fs');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({});

async function checkModels() {
    try {
        const models = [];
        const response = await ai.models.list();
        for await (const model of response) {
            if (model.name.includes("gemini")) {
                models.push(model.name);
            }
        }
        fs.writeFileSync('models.json', JSON.stringify(models, null, 2));
        console.log("Done");
    } catch (e) {
        console.error("List error:", e.message);
    }
}

checkModels();
