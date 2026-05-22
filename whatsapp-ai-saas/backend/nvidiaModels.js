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
        id: 'nvidia/ising-calibration-1-35b-a3b',
        name: 'NVIDIA Ising Calibration 35B',
        type: 'text',
        dbKey: 'nvidia_key_ising',
        envKey: 'NVIDIA_KEY_ISING',
        thinking: true,
    },
    {
        id: 'qwen/qwen3.5-397b-a17b',
        name: 'Qwen 3.5 397B',
        type: 'text',
        dbKey: 'nvidia_key_qwen',
        envKey: 'NVIDIA_KEY_QWEN',
        thinking: true,
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
    {
        id: 'nvidia/nemotron-nano-12b-v2-vl',
        name: 'Nemotron Nano 12B Vision',
        type: 'vision',
        dbKey: 'nvidia_key_nemotron_v2',
        envKey: 'NVIDIA_KEY_NEMOTRON_V2',
        thinking: false,
    },
    {
        id: 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
        name: 'Llama 3.1 Nemotron Vision 8B',
        type: 'vision',
        dbKey: 'nvidia_key_nemotron_vl',
        envKey: 'NVIDIA_KEY_NEMOTRON_VL',
        thinking: false,
    },
    {
        id: 'nim/meta/llama-3.2-11b-vision-instruct',
        name: 'Llama 3.2 11B Vision (Together AI)',
        type: 'vision',
        provider: 'together',
        dbKey: 'together_api_key',
        envKey: 'TOGETHER_API_KEY',
        thinking: false,
    },

    // ─── Modèles Image-Génération ─────────────────────────────────────
    // qwen/qwen-image est déployé via Together AI (partenaire NVIDIA Build)
    // Endpoint : https://api.together.xyz/v1/images/generations
    // Clé      : Together AI key (together_api_key en DB / TOGETHER_API_KEY en .env)
    {
        id: 'qwen/qwen-image',
        name: 'Qwen Image (Together AI)',
        type: 'image-generate',     // text→image
        provider: 'together',        // indique le routage Together AI
        dbKey: 'together_api_key',   // clé primaire : Together AI
        legacyDbKey: 'nvidia_key_qwen_image',  // fallback : ancienne clé NVIDIA
        envKey: 'TOGETHER_API_KEY',  // .env fallback
        legacyEnvKey: 'NVIDIA_KEY_QWEN_IMAGE',
        thinking: false,
    },
    {
        id: 'qwen/qwen-image-edit',
        name: 'Qwen Image Edit',
        type: 'image-edit',
        dbKey: 'nvidia_key_qwen_edit',
        envKey: 'NVIDIA_KEY_QWEN_EDIT',
        thinking: false,
    },
    {
        id: 'stabilityai/stable-diffusion-3-medium',
        name: 'Stable Diffusion 3 Medium (Together AI)',
        type: 'image-generate',
        provider: 'together',
        dbKey: 'together_api_key',
        envKey: 'TOGETHER_API_KEY',
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
    // Use getModelDef which handles aliases and dot/underscore variants
    const modelDef = getModelDef(modelId);

    // Niveau 1 : clé spécifique au modèle, configurée par l'utilisateur
    if (modelDef?.dbKey) {
        const userKey = await getSetting(modelDef.dbKey, '');
        if (userKey) return userKey;
    }
    if (modelDef?.legacyDbKey) {
        const legacyKey = await getSetting(modelDef.legacyDbKey, '');
        if (legacyKey) return legacyKey;
    }

    // Niveau 2 : clé globale openai_api_key de l'utilisateur
    const globalKey = await getSetting('openai_api_key', '');
    if (globalKey) return globalKey;

    // Niveau 3 : clé système dans .env (fallback silencieux)
    if (modelDef?.envKey && process.env[modelDef.envKey]) {
        return process.env[modelDef.envKey];
    }
    if (modelDef?.legacyEnvKey && process.env[modelDef.legacyEnvKey]) {
        return process.env[modelDef.legacyEnvKey];
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
    if (!modelId) return null;
    // Exact match
    let found = MODELS.find(m => m.id === modelId);
    if (found) return found;
    // Aliases
    found = MODELS.find(m => Array.isArray(m.aliases) && m.aliases.includes(modelId));
    if (found) return found;
    // Try underscore/dot variants
    const dotToUnderscore = modelId.replace(/\./g, '_');
    const underscoreToDot = modelId.replace(/_/g, '.');
    found = MODELS.find(m => m.id === dotToUnderscore || m.id === underscoreToDot);
    if (found) return found;
    // Check aliases with replacements too
    found = MODELS.find(m => Array.isArray(m.aliases) && (m.aliases.includes(dotToUnderscore) || m.aliases.includes(underscoreToDot)));
    return found || null;
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
