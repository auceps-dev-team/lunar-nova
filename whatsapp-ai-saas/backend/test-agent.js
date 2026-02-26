require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({});

const systemInstruction = `Rôle et Contexte

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
Option 2 : L'Approche "Hyper-Personnalisée" (Recherche)
Option 3 : L'Approche "Directe & Courte" (No-Nonsense)`;

const targetInput = `
INSTRUCTIONS POUR LA MISSION :
<CIBLE>
Profil 1:
Nom complet: Clarisse Diabaté
Age: 33
Activité: Étudiant en design graphique
Description: Professionnel créatif avec un œil pour les détails et l'esthétique moderne.
Compétences: Animation 2D, Retouche photo, Motion design, Infographie, Sketch, Adobe InDesign, Adobe XD
Habitudes et préférences: Style épuré et professionnel, orienté corporate

Profil 2:
Nom complet: Marie Diarrassouba
Age: 18
Activité: Étudiant en design graphique
Description: Artiste digital cherchant à développer son portfolio et ses compétences.
Habitudes et préférences: Fan de typographie moderne, privilégie les projets de branding

Profil 3:
Nom complet: Clarisse Dembélé
Age: 30
Activité: Artiste digital
Description: Designer ambitieux aimant transformer des idées en visuels impactants.
Habitudes et préférences: Créations colorées inspirées de la culture ivoirienne
</CIBLE>

<OBJECTIF>
Le but est de présenter notre nouveau projet Baobart. une plateforme collaborative pour créateurs africain qui permet de publier ces œuvre (celle trouver sur internet avec les droits), de vendre ces créations, de poster ces services et bien plus encore, nous sommes à la recherche de nos premier utilisateur et nous souhaitons lancer une campagne de cold message pour les insister à s'inscrire et commencer à publier 
</OBJECTIF>

<CANAL>
Email / WhatsApp / lien direct site web 
</CANAL>

<TONALITÉ_SOUHAITÉE>
en fonction de la situation
</TONALITÉ_SOUHAITÉE>

Génère une réponse complète pour le Profil 1, Profil 2, et Profil 3 !
`;

async function runTest() {
    try {
        console.log("Testing with Gemini API Key...");
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: targetInput,
            config: {
                systemInstruction: systemInstruction
            }
        });
        console.log("============= AI RESPONSE =============");
        console.log(response.text);
        console.log("=======================================");
    } catch (error) {
        console.error("Test failed:", error);
    }
}

runTest();
