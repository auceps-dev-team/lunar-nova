require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

// Initialize the Gemini client
// Note: Requires GEMINI_API_KEY in the .env file
const ai = new GoogleGenAI({});

const systemInstruction = `You are an expert Assistive Copilot for a WhatsApp Business SaaS.
Your objective is to read the provided chat history strictly as context and propose 3 highly relevant, professional, and concise replies to the user.
Do not include any actions, markdown formatting out of place, or anything that isn't a direct message proposal.
Output a strict JSON object matching this schema:
{
  "proposed_replies": [ "Reply 1", "Reply 2", "Reply 3" ]
}`;

async function generateProposals(chatContext) {
    if (!chatContext || !chatContext.messages || chatContext.messages.length === 0) {
        return { proposed_replies: [] };
    }

    // Format chat context into a readable string
    let formattedChat = `Chat with: ${chatContext.contactName}\n\n`;
    chatContext.messages.forEach(msg => {
        formattedChat += `[${msg.time}] ${msg.sender}: ${msg.text}\n`;
    });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: formattedChat,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
            }
        });

        const jsonText = response.text();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Gemini API Error:", error);
        return { proposed_replies: ["Error connecting to Assistive Copilot"] };
    }
}

const agentPersonas = {
    creative: `You are the Visual & Creative Agent for a SaaS platform.
Your expertise is in generating prompts for high-end product uplifting, photo editing, and visionary art direction.
Provide concise, imaginative, and highly visual responses. Focus on aesthetics and creative strategy.`,

    legal: `You are the Legal & Admin Agent for a SaaS platform.
Your expertise is in drafting contracts, writing professional invoices, and providing general legal assistance.
Provide highly professional, precise, and legally sound (but disclaimer-based) responses. Format contracts or invoices clearly using markdown.`
};

async function chatWithAgent(personaId, message) {
    if (!message) return { response: "I didn't catch that. How can I help?" };

    const personaInstruction = agentPersonas[personaId] || agentPersonas.creative;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: message,
            config: {
                systemInstruction: personaInstruction
            }
        });

        return { response: response.text() };
    } catch (error) {
        console.error(`Gemini Agent Error (${personaId}):`, error);
        return { response: "I am currently offline or experiencing a connection error. Please try again." };
    }
}

module.exports = {
    generateProposals,
    chatWithAgent
};
