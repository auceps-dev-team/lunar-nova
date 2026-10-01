/**
 * Outils MCP — Génération photo (persona + image).
 *
 * Extrait de wacopiloteMcpServer.js (constat R9 de l’audit du 29/09/2026),
 * à l’identique : définitions et corps des handlers sont ceux de l’ancien
 * `switch`, seuls les chemins require ont gagné un niveau.
 */

const db = require('../../db');

const definitions = [
        {
            name: 'generate_photo',
            description: 'Générer une photo (produit ou mannequin) : enchaîne la persona photoshoot/creative (prompt structuré) puis la génération d\'image, et retourne les bytes base64 du résultat.',
            inputSchema: {
                type: 'object',
                properties: {
                    agent: { type: 'string', description: "Persona à utiliser : 'photoshoot' (défaut, mode) ou 'creative' (produit)" },
                    prompt: { type: 'string', description: 'Description de la photo souhaitée' },
                    aspectRatio: { type: 'string', description: "Ratio (ex: '1:1', '4:5', '16:9')" },
                    provider: { type: 'string', description: 'Fournisseur optionnel (gemini, openai/nvidia)' },
                    model: { type: 'string', description: 'Modèle image optionnel spécifique' }
                },
                required: ['prompt']
            }
        }
];

const handlers = {
    generate_photo: async (args) => {
        const { agent, prompt, aspectRatio, provider, model } = args || {};
        if (!prompt) throw new Error("L'argument 'prompt' est obligatoire.");
        await db.initDB();
        const aiController = require('../../aiController');
        const agentId = agent || 'photoshoot';
        const agentResult = await aiController.chatWithAgent(agentId, prompt, null, null, 'json');
        const structuredPrompt = (agentResult && agentResult.response) || prompt;
        const generationResponse = await aiController.generateImage(
            structuredPrompt, aspectRatio || null, null, null, null, provider || null, model || null
        );
        if (generationResponse.error) {
            throw new Error(generationResponse.error);
        }
        return { agent: agentId, structuredPrompt, imageBytes: generationResponse.imageBytes };
    }
};

module.exports = { definitions, handlers };
