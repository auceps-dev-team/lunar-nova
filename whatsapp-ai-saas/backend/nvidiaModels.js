/**
 * nvidiaModels.js — Catalogue centralisé des modèles NVIDIA NIM
 *
 * Chaque modèle définit :
 *  - id          : identifiant de l'API (model string ou UUID)
 *  - name        : nom affiché dans l'UI
 *  - type        : 'text' | 'vision' | 'image-edit'
 *  - badge       : emoji UI affiché dans les sélecteurs
 *  - dbKey       : clé en base de données (configurée par l'utilisateur dans Settings)
 *  - envKey      : variable d'environnement (clé système — fallback)
 *  - thinking    : true → active extra_body pour le mode raisonnement (GLM-4.7)
 */

require('dotenv').config();

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

const MODELS = [
    // ─── Modèles Text-only ─────────────────────────────────────────────
    {
        id: 'meta/llama-4-maverick-17b-128e-instruct',
        name: 'Llama 4 Maverick 17B',
        type: 'text',
        dbKey: 'nvidia_key_llama',
        envKey: 'NVIDIA_KEY_LLAMA',
        thinking: false,
    },
    {
        id: 'google/gemma-3n-e2b-it',
        name: 'Gemma 3N E2B IT',
        type: 'text',
        dbKey: 'nvidia_key_gemma',
        envKey: 'NVIDIA_KEY_GEMMA',
        thinking: false,
    },
    {
        id: 'z-ai/glm-4.7',
        name: 'GLM 4.7 (Thinking)',
        type: 'text',
        dbKey: 'nvidia_key_glm',
        envKey: 'NVIDIA_KEY_GLM',
        thinking: true,
    },
    {
        id: 'moonshotai/kimi-k2-instruct',
        name: 'Kimi K2 Instruct',
        type: 'text',
        dbKey: null,         // pas de clé système, l'utilisateur doit fournir la sienne
        envKey: null,
        thinking: false,
    },

    // ─── Modèles Vision (image input → text output) ────────────────────
    {
        id: 'meta/llama-3.2-90b-vision-instruct',
        name: 'Llama 3.2 90B Vision',
        type: 'vision',
        dbKey: 'nvidia_key_llama_vision',
        envKey: 'NVIDIA_KEY_LLAMA_VISION',
        thinking: false,
    },

    // ─── Modèles Image-Edit (image input → image output / description) ─
    {
        id: 'stabilityai/stable-diffusion-3-medium',
        name: 'Stable Diffusion 3 Medium',
        type: 'image-edit',
        dbKey: 'nvidia_key_sd3',
        envKey: 'NVIDIA_KEY_SD3',
        thinking: false,
    },
];

/**
 * Résolution de clé API avec logique à 3 niveaux :
 *   1. Clé utilisateur en base de données  (priorité maximale)
 *   2. Clé globale openai_api_key en base   (clé maître configurée par l'utilisateur)
 *   3. Clé système dans process.env         (fallback silencieux — toujours disponible)
 *
 * @param {string} modelId  - Identifiant du modèle
 * @param {Function} getSetting - Fonction asynchrone db.getSetting(key, defaultVal)
 * @returns {Promise<string>} La clé API résolue
 */
async function resolveKey(modelId, getSetting) {
    const modelDef = MODELS.find(m => m.id === modelId);

    // Niveau 1 : clé spécifique au modèle, configurée par l'utilisateur
    if (modelDef?.dbKey) {
        const userKey = await getSetting(modelDef.dbKey, '');
        if (userKey) return userKey;
    }

    // Niveau 2 : clé globale openai_api_key de l'utilisateur
    const globalKey = await getSetting('openai_api_key', '');
    if (globalKey) return globalKey;

    // Niveau 3 : clé système dans .env (fallback silencieux)
    if (modelDef?.envKey && process.env[modelDef.envKey]) {
        return process.env[modelDef.envKey];
    }

    return '';
}

/**
 * Retourne le premier modèle de type 'vision' disponible dans le catalogue.
 * Utilisé pour le basculement automatique lors d'une requête avec image.
 */
function getDefaultVisionModel() {
    return MODELS.find(m => m.type === 'vision') || null;
}

/**
 * Retourne la définition complète d'un modèle par son ID.
 */
function getModelDef(modelId) {
    return MODELS.find(m => m.id === modelId) || null;
}

/**
 * Retourne les modèles filtrés par type pour alimenter les sélecteurs UI.
 * @param {'text'|'vision'|'image-edit'|null} type  null = tous
 */
function getModelsByType(type = null) {
    if (!type) return MODELS;
    return MODELS.filter(m => m.type === type);
}

module.exports = {
    NVIDIA_BASE_URL,
    MODELS,
    resolveKey,
    getDefaultVisionModel,
    getModelDef,
    getModelsByType,
};
