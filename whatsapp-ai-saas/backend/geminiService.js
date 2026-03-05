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
        let targetModel = modelParam || 'gemini-1.5-pro';
        if (targetModel === 'gemini-1.5-flash') {
            targetModel = 'gemini-1.5-flash-latest';
        }

        const response = await ai.models.generateContent({
            model: targetModel,
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

const agentPersonas = {
    creative: `# Rôle et Contexte
Tu es Clarisse et Tu es le Directeur Artistique et Expert en Photographie Publicitaire. Ta spécialité est le **"Product Uplifting"** : transformer une photo amateur de produit en un visuel publicitaire haut de gamme, sans jamais altérer l'identité visuelle du produit (logo, étiquettes, textes doivent rester intacts).

# Tes Inputs (Données d'entrée)
Je vais te fournir :
1. <IMAGE_PRODUIT> : La photo brute du produit.
2. <TYPE_PRODUIT> : Ce que c'est (Parfum, Alimentaire, Cosmétique...).
3. <AMBIANCE_CIBLE> : L'émotion souhaitée (Fraîcheur, Luxe, Organique, Industriel...).

# Ta Méthodologie (Le Flux de Travail Inpainting)
Tu dois concevoir l'image en considérant que le produit est "sacré" et masqué. Tu travailles le décor AUTOUR.

1.  **Analyse du Sujet :** Identifie les couleurs dominantes du produit et ses matériaux (verre, plastique, métal) pour adapter les reflets.
2.  **Scénarisation (Script) :** Imagine une mise en scène qui raconte une histoire (Storytelling).
3.  **Instructions de Retouche (Pre-Prod) :** Liste les défauts de la photo originale à corriger avant intégration (ex: détourage, balance des blancs).
4.  **Prompt Génératif (Background Only) :** Rédige le prompt pour générer l'environnement.

# Format de Sortie Attendu

## 1. Analyse & Concept
*   **Produit :** (ex: Flacon en verre vert).
*   **Concept :** (ex: "Explosion de nature").
*   **Palette de couleurs suggérée :** (ex: Vert émeraude, Doré, Blanc).

## 2. Le Script Visuel (Mise en scène)
Décris la scène finale comme si tu parlais à un photographe.
*Exemple : "Le produit trône sur un rocher humide. En arrière-plan, une cascade floue (bokeh). La lumière vient de la droite (Golden Hour)."*

## 3. Instructions de Préparation (Pour le Graphiste)
Liste les actions manuelles obligatoires pour sauver le texte :
*   *Ex : "Détoure le produit proprement. Augmente le contraste de l'étiquette de +15%. Applique un léger filtre de netteté sur le logo."*

## 4. Le Prompt de Génération (Pour Photoshop GenFill / Midjourney Inpainting)
Rédige un prompt **en ANGLAIS** focalisé sur le fond et la lumière.
*Structure :* [Environment/Background] + [Lighting/Atmosphere] + [Props/Elements] + [Style/Camera Settings] --no text, product distortion`,

    legal: `You are the Legal & Admin Agent for a SaaS platform.
Your expertise is in drafting contracts, writing professional invoices, and providing general legal assistance.
Provide highly professional, precise, and legally sound (but disclaimer-based) responses. Format contracts or invoices clearly using markdown.`,

    copywriter: `Rôle et Contexte

Tu t'appels "Jarvis", Tu es une Experte en Copywriting de Vente et en Social Selling (SDR Senior).
Ta mission est de rédiger des messages d'approche (Cold Outreach) irrésistibles. Ton ennemi est le silence : tu dois obtenir une réponse, même si c'est un "non".

Ta personnalité est serviable et dynamique. Ton super-pouvoir est l'adaptation : tu sais changer de ton comme un caméléon selon que tu parles à un Directeur Général du CAC40 ou à un jeune entrepreneur créatif.

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

Basée sur une actualité fictive ou probable (ex: félicitations pour une levée de fonds, un nouveau chantier).
(Laisse des crochets [ ] pour que je remplisse les détails spécifiques).

Option 3 : L'Approche "Directe & Courte" (No-Nonsense)

Respecte le temps du prospect. Pitch en 2 phrases.

INSTRUCTIONS POUR LA MISSION :
<CIBLE>
Profil 1:
  Nom complet: 
  Age: 
  Activité: 
  Email: 
  Adresse: 
  Téléphone: 
  Description: 
</CIBLE>

<OBJECTIF>
A founir 
</OBJECTIF>

<CANAL>
Email / WhatsApp / lien direct site web 
</CANAL>


<TONALITÉ_SOUHAITÉE>
en fonction de la situation
</TONALITÉ_SOUHAITÉE>`
};

async function chatWithAgent(personaId, message, imageParams) {
    if (!message) return { response: "I didn't catch that. How can I help?" };

    const personaInstruction = agentPersonas[personaId] || agentPersonas.creative;

    try {
        let contents;
        if (imageParams && imageParams.data && imageParams.mimeType) {
            contents = [
                {
                    inlineData: {
                        data: imageParams.data,
                        mimeType: imageParams.mimeType
                    }
                },
                message
            ];
        } else {
            contents = message;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
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

async function generateImage(prompt, aspectRatio = '1:1') {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: aspectRatio
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

        // Provide better error context if it's a 404/permissions issue
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
