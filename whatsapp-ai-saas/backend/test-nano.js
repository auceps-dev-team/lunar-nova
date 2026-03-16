require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

// Initialisation avec la clé de ton fichier .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function verifyModelsAccess() {
    console.log("======================================================");
    console.log("🔍 Scanner de Modèles Gemini (Vérification des accès)");
    console.log("======================================================\n");

    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ ERREUR : Aucune clé API trouvée. Vérifie ton fichier .env !");
        return;
    }

    // Liste des modèles expérimentaux et de production à tester
    const modelsToTest = [
        'gemini-3-pro-image-preview',
        'gemini-3.1-flash-image-preview', // L'ancien modèle que tu utilisais
        'gemini-2.5-flash', // Le modèle Nano Banana spécifique
    ];

    console.log("⏳ Test des connexions en cours...\n");

    for (const modelName of modelsToTest) {
        try {
            // Affichage sur la même ligne pour faire un bel effet de chargement
            process.stdout.write(`- Test du modèle '${modelName}'... `);

            // On envoie un simple texte pour tester l'accès basique au endpoint
            await ai.models.generateContent({
                model: modelName,
                contents: "Test",
            });

            console.log("✅ SUCCÈS (Autorisé)");
        } catch (error) {
            // Traitement spécifique de l'erreur 404
            if (error.status === 404 || (error.message && error.message.includes('not found'))) {
                console.log("❌ ÉCHEC (Non autorisé ou introuvable)");
            } else {
                console.log(`❌ ÉCHEC (Erreur technique: ${error.message})`);
            }
        }
    }

    console.log("\n======================================================");
    console.log("💡 Conclusion :");
    console.log("Utilise l'un des modèles marqués d'un ✅ dans ton fichier 'geminiService.js'.");
    console.log("Si tous les modèles expérimentaux (-exp ou -preview) échouent, ton compte");
    console.log("nécessite probablement d'activer la facturation (billing) sur Google Cloud.");
    console.log("======================================================\n");
}

verifyModelsAccess();