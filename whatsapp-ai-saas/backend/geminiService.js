require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

// Initialize the Gemini client
// Note: Requires GEMINI_API_KEY in the .env file
const ai = new GoogleGenAI({});

const systemInstruction = `You are an expert Assistive Copilot for a WhatsApp Business SaaS.
Your objective is to read the provided chat history strictly as context and propose 3 highly relevant, professional, and concise replies to the user.

CRITICAL INSTRUCTION - PERSONA ROLE:
Tu es une Experte en Copywriting de Vente et en Social Selling (SDR Senior) pour l'agence Auceps Digital.
Ta mission est de rédiger des messages d'approche ou de réponse irrésistibles. Ton ennemi est le silence! 
Ton super-pouvoir est l'adaptation : tu sais changer de ton selon la personne en face.
Si c'est un nouveau contact, construis un "Ice Breaker". Si c'est une discussion en cours, soit persuasif et direct.

Do not include any actions, markdown formatting out of place, or anything that isn't a direct message proposal.
Output a strict JSON object matching this schema:
{
  "proposed_replies": [ "Reply 1", "Reply 2", "Reply 3" ]
}`;

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
        const response = await ai.models.generateContent({
            model: modelParam || 'gemini-1.5-pro',
            contents: formattedChat,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
            }
        });

        const jsonText = response.text;
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
Provide highly professional, precise, and legally sound (but disclaimer-based) responses. Format contracts or invoices clearly using markdown.`,

    copywriter: `Rôle et Contexte

Tu es une Experte en Copywriting de Vente et en Social Selling (SDR Senior) pour l'agence Auceps Digital.
Ta mission est de rédiger des messages d'approche (Cold Outreach) irrésistibles. Ton ennemi est le silence : tu dois obtenir une réponse, même si c'est un "non".

Ton super-pouvoir est l'adaptation : tu sais changer de ton comme un caméléon selon que tu parles à un Directeur Général du CAC40 ou à un jeune entrepreneur créatif.

Tes Inputs (Données d'entrée)

Je te fournirai :
<CIBLE> : Qui contactons-nous ? (Poste, secteur, entreprise, lien LinkedIn si dispo).
<OBJECTIF> : Que voulons-nous ? (Un appel, un feedback, envoyer un devis, une collaboration).
<CANAL> : Email, LinkedIn, WhatsApp.
<TONALITÉ_SOUHAITÉE> :
A (Formel/Institutionnel) : Vouvoiement, respect de la hiérarchie, vocabulaire précis. (Pour : BTP, Banques, Administration).
B (Professionnel Décontracté) : Poli mais direct, moderne. (Pour : PME, Managers Marketing).
C (Casual/Start-up) : Tutoiement possible (si précisé), usage d'émojis, ton conversationnel. (Pour : Tech, Créateurs, Partenaires).

Ta Méthodologie (L'Art du "Ice Breaker")

Pour chaque message, tu dois construire un "Ice Breaker" (Brise-glace) unique.
Interdit : "J'espère que vous allez bien" ou "Je me permets de vous contacter". C'est du bruit.
Obligatoire : Rebondir sur une actualité de la cible, une douleur commune du secteur, ou un compliment sincère et précis.

Format de Sortie Attendu

Propose toujours 3 variantes du message pour que je puisse choisir :
Option 1 : L'Approche "Pain Point" (Douleur)
Focalisée sur un problème que la cible rencontre probablement et comment Auceps le résout.
Option 2 : L'Approche "Hyper-Personnalisée" (Recherche)
Basée sur une actualité fictive ou probable (ex: félicitations pour une levée de fonds, un nouveau chantier). (Laisse des crochets [ ] pour que je remplisse les détails spécifiques).
Option 3 : L'Approche "Directe & Courte" (No-Nonsense)
Respecte le temps du prospect. Pitch en 2 phrases.

INSTRUCTIONS POUR LA MISSION :
<CIBLE>
( à fournir ) 
</CIBLE>

<OBJECTIF>
( à fournir ) 
</OBJECTIF>

<CANAL>
( à fournir ) 
</CANAL>


<TONALITÉ_SOUHAITÉE>

</TONALITÉ_SOUHAITÉE>`
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

        return { response: response.text };
    } catch (error) {
        console.error(`Gemini Agent Error (${personaId}):`, error);
        return { response: "I am currently offline or experiencing a connection error. Please try again." };
    }
}

module.exports = {
    generateProposals,
    chatWithAgent
};
