const db = require('../db');
const nvidiaModels = require('../nvidiaModels');

/**
 * Identifiants et point d'accès d'un fournisseur de texte.
 *
 * Constat R6 de l'audit du 29/09/2026, précisé à la vérification : cette
 * résolution était recopiée à trois endroits — aiController.generateProposals,
 * aiController.classifyOrderIntent et le routeur agentique. Changer l'URL de
 * Together ou l'ordre de résolution des clés demandait trois modifications
 * identiques ; en oublier une faisait diverger le chat de la détection de
 * commandes sans qu'aucune erreur ne le signale.
 *
 * Lève une erreur explicite quand la clé obligatoire manque : les appelants
 * s'en servent pour basculer sur Gemini.
 */

const TOGETHER_BASE_URL = 'https://api.together.xyz/v1';

/**
 * @param {string} provider  'openrouter' | 'ollama' | 'openai' | autre
 * @param {string|null} modelId  modèle visé (sert à la clé NVIDIA et au routage Together)
 * @returns {Promise<{apiKey?: string, baseURL?: string}>} objet vide pour Gemini
 *          et tout fournisseur inconnu (Gemini résout sa clé lui-même)
 */
async function resolveProviderCredentials(provider, modelId) {
    if (provider === 'openrouter') {
        const apiKey = await db.getSetting('openrouter_api_key', '');
        // Sans clé utilisateur, une clé système suffit : le service la lit
        // lui-même dans l'environnement, on lui transmet donc une clé vide.
        if (!apiKey && !process.env.OPENROUTER_API_KEY) {
            throw new Error('OpenRouter API key not configured in settings.');
        }
        return { apiKey };
    }

    if (provider === 'ollama') {
        // Ollama local fonctionne sans clé ; elle ne sert qu'à Ollama Cloud.
        return { apiKey: await db.getSetting('ollama_api_key', '') };
    }

    if (provider === 'openai') {
        const apiKey = await nvidiaModels.resolveKey(modelId, db.getSetting.bind(db));
        if (!apiKey) {
            throw new Error('OpenAI/NVIDIA API key not configured in settings.');
        }
        let baseURL = await db.getSetting('openai_base_url', nvidiaModels.NVIDIA_BASE_URL);
        const def = nvidiaModels.getModelDef(modelId);
        if (def && def.provider === 'together') {
            baseURL = TOGETHER_BASE_URL;
        }
        return { apiKey, baseURL };
    }

    return {};
}

module.exports = { resolveProviderCredentials, TOGETHER_BASE_URL };
