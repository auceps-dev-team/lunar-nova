/**
 * nvidiaModels.js — Catalogue centralisé des modèles NVIDIA NIM
 *
 * Chaque modèle définit :
 *  - id          : identifiant de l'API (model string ou UUID)
 *  - name        : nom affiché dans l'UI
 *  - type        : 'text' | 'vision' | 'image-edit' | 'image-generate' | 'moderation'
 *  - badge       : emoji UI affiché dans les sélecteurs
 *  - dbKey       : clé en base de données (configurée par l'utilisateur dans Settings)
 *  - envKey      : variable d'environnement (clé système — fallback)
 *  - thinking    : true → le modèle expose un mode raisonnement (affichage "*Thinking:*")
 *
 * Paramètres de génération optionnels (lus par buildGenerationParams, voir plus bas) :
 *  - maxTokens          : override de max_tokens
 *  - temperature, topP, topK : overrides de sampling
 *  - presencePenalty, frequencyPenalty, repetitionPenalty : overrides de pénalité
 *  - reasoningEffort    : envoyé tel quel comme `reasoning_effort` (ex: mistral, "high")
 *  - reasoningBudget    : envoyé tel quel comme `reasoning_budget` (ex: nemotron reasoning)
 *  - chatTemplateKwargs : objet fusionné dans `extra_body.chat_template_kwargs`
 *  - extraBody          : objet fusionné directement dans `extra_body` (échappatoire libre,
 *                         ex: `thinking_budget`, `min_thinking_tokens` selon le modèle)
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
        maxTokens: 32768,
        temperature: 0.2,
        topP: 1,
    },
    {
        id: 'qwen/qwen3.5-397b-a17b',
        name: 'Qwen 3.5 397B',
        type: 'text',
        dbKey: 'nvidia_key_qwen',
        envKey: 'NVIDIA_KEY_QWEN',
        thinking: true,
        maxTokens: 16384,
        temperature: 0.6,
        topP: 0.95,
        topK: 20,
        presencePenalty: 0,
        repetitionPenalty: 1,
    },
    {
        id: 'google/gemma-3n-e2b-it',
        name: 'Gemma 3N E2B IT',
        type: 'text',
        dbKey: 'nvidia_key_gemma',
        envKey: 'NVIDIA_KEY_GEMMA',
        thinking: false,
        maxTokens: 512,
        temperature: 0.2,
        topP: 0.7,
        frequencyPenalty: 0,
        presencePenalty: 0,
    },
    {
        id: 'z-ai/glm-4.7',
        name: 'GLM 4.7 (Thinking)',
        type: 'text',
        dbKey: 'nvidia_key_glm',
        envKey: 'NVIDIA_KEY_GLM',
        thinking: true,
        maxTokens: 16384,
        chatTemplateKwargs: { enable_thinking: true, clear_thinking: false },
    },
    {
        id: 'moonshotai/kimi-k2-instruct',
        name: 'Kimi K2 Instruct',
        type: 'text',
        dbKey: null,         // pas de clé système dédiée — couvert par NVIDIA_DEFAULT_API_KEY
        envKey: null,
        thinking: false,
    },

    // ─── Nouveaux modèles (batch 1/N — 77 annoncés) ─────────────────────
    {
        id: 'z-ai/glm-5.2',
        name: 'GLM 5.2 (Thinking)',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 16384,
        temperature: 1,
        topP: 1,
        chatTemplateKwargs: { enable_thinking: true, clear_thinking: false },
    },
    {
        id: 'google/diffusiongemma-26b-a4b-it',
        name: 'DiffusionGemma 26B IT (Thinking)',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 4096,
        temperature: 1,
        topP: 0.95,
        chatTemplateKwargs: { enable_thinking: true },
    },
    {
        id: 'nvidia/nemotron-3-ultra-550b-a55b',
        name: 'Nemotron 3 Ultra 550B (Reasoning)',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 16384,
        temperature: 1,
        topP: 0.95,
        reasoningBudget: 16384,
        chatTemplateKwargs: { enable_thinking: true },
    },
    {
        id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
        name: 'Nemotron 3 Nano Omni 30B (Reasoning)',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 65536,
        temperature: 0.6,
        topP: 0.95,
        reasoningBudget: 16384,
        chatTemplateKwargs: { enable_thinking: true },
    },
    {
        id: 'stepfun-ai/step-3.7-flash',
        name: 'Step 3.7 Flash',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 16384,
        temperature: 1,
        topP: 0.95,
    },
    {
        id: 'mistralai/mistral-medium-3.5-128b',
        name: 'Mistral Medium 3.5 128B',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 16384,
        temperature: 0.7,
        topP: 1,
        reasoningEffort: 'high',
    },
    {
        id: 'mistralai/mistral-small-4-119b-2603',
        name: 'Mistral Small 4 119B',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 16384,
        temperature: 0.1,
        topP: 1,
        reasoningEffort: 'high',
    },
    {
        id: 'deepseek-ai/deepseek-v4-flash',
        name: 'DeepSeek V4 Flash (Thinking)',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 16384,
        temperature: 1,
        topP: 0.95,
        chatTemplateKwargs: { thinking: true, reasoning_effort: 'high' },
    },
    {
        id: 'deepseek-ai/deepseek-v4-pro',
        name: 'DeepSeek V4 Pro',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 16384,
        temperature: 1,
        topP: 0.95,
        chatTemplateKwargs: { thinking: false },
    },
    {
        id: 'minimaxai/minimax-m2.7',
        name: 'MiniMax M2.7',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 8192,
        temperature: 1,
        topP: 0.95,
    },
    {
        id: 'google/gemma-4-31b-it',
        name: 'Gemma 4 31B IT (Thinking)',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 16384,
        temperature: 1,
        topP: 0.95,
        chatTemplateKwargs: { enable_thinking: true },
    },

    // ─── Nouveaux modèles (batch 2/N — 77 annoncés) ─────────────────────
    {
        id: 'stepfun-ai/step-3.5-flash',
        name: 'Step 3.5 Flash (Thinking)',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 16384,
        temperature: 1,
        topP: 0.9,
    },
    {
        id: 'nvidia/nemotron-3-nano-30b-a3b',
        name: 'Nemotron 3 Nano 30B (Reasoning)',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 16384,
        temperature: 1,
        topP: 1,
        reasoningBudget: 16384,
    },
    {
        id: 'mistralai/mistral-large-3-675b-instruct-2512',
        name: 'Mistral Large 3 675B Instruct',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 2048,
        temperature: 0.15,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
    },
    {
        id: 'mistralai/ministral-14b-instruct-2512',
        name: 'Ministral 14B Instruct',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 2048,
        temperature: 0.15,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
    },
    {
        id: 'stockmark/stockmark-2-100b-instruct',
        name: 'Stockmark 2 100B Instruct',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 1024,
        temperature: 0.7,
        topP: 0.95,
    },
    {
        id: 'qwen/qwen3-next-80b-a3b-instruct',
        name: 'Qwen3 Next 80B Instruct',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 4096,
        temperature: 0.6,
        topP: 0.7,
    },
    {
        id: 'bytedance/seed-oss-36b-instruct',
        name: 'Seed OSS 36B Instruct (Thinking)',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 4096,
        temperature: 1.1,
        topP: 0.95,
        frequencyPenalty: 0,
        presencePenalty: 0,
        extraBody: { thinking_budget: -1 },
    },
    {
        id: 'nvidia/nvidia-nemotron-nano-9b-v2',
        name: 'Nemotron Nano 9B v2 (Thinking)',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 2048,
        temperature: 0.6,
        topP: 0.95,
        frequencyPenalty: 0,
        presencePenalty: 0,
        extraBody: { min_thinking_tokens: 1024, max_thinking_tokens: 2048 },
    },
    {
        id: 'openai/gpt-oss-20b',
        name: 'GPT-OSS 20B (Thinking)',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 4096,
        temperature: 1,
        topP: 1,
    },
    {
        id: 'openai/gpt-oss-120b',
        name: 'GPT-OSS 120B (Thinking)',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 4096,
        temperature: 1,
        topP: 1,
    },
    {
        id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
        name: 'Llama 3.3 Nemotron Super 49B v1.5',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 65536,
        temperature: 0.6,
        topP: 0.95,
        frequencyPenalty: 0,
        presencePenalty: 0,
    },
    {
        id: 'sarvamai/sarvam-m',
        name: 'Sarvam-M',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 16384,
        temperature: 0.5,
        topP: 1,
    },
    {
        id: 'google/gemma-3n-e4b-it',
        name: 'Gemma 3N E4B IT',
        type: 'text',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 512,
        temperature: 0.2,
        topP: 0.7,
        frequencyPenalty: 0,
        presencePenalty: 0,
    },

    // ─── Modèles Moderation / Content Safety (exclus des sélecteurs de chat) ──
    {
        id: 'nvidia/nemotron-3-content-safety',
        name: 'Nemotron 3 Content Safety',
        type: 'moderation',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 512,
        temperature: 0.2,
        topP: 0.7,
        chatTemplateKwargs: { request_categories: '/categories' },
    },
    {
        id: 'nvidia/nemotron-3.5-content-safety',
        name: 'Nemotron 3.5 Content Safety',
        type: 'moderation',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 512,
        temperature: 0.2,
        topP: 0.7,
        chatTemplateKwargs: { request_categories: '/categories', enable_thinking: true },
    },
    {
        id: 'nvidia/nemotron-content-safety-reasoning-4b',
        name: 'Nemotron Content Safety Reasoning 4B',
        type: 'moderation',
        dbKey: null,
        envKey: null,
        thinking: true,
        maxTokens: 16384,
        temperature: 1,
        topP: 1,
    },
    {
        id: 'nvidia/llama-3.1-nemotron-safety-guard-8b-v3',
        name: 'Llama 3.1 Nemotron Safety Guard 8B v3',
        type: 'moderation',
        dbKey: null,
        envKey: null,
        thinking: false,
    },
    {
        id: 'meta/llama-guard-4-12b',
        name: 'Llama Guard 4 12B',
        type: 'moderation',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 5,
        temperature: 0.2,
        topP: 0.7,
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
        maxTokens: 4096,
        temperature: 1,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
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
    {
        id: 'minimaxai/minimax-m3',
        name: 'MiniMax M3 (Vision)',
        type: 'vision',
        dbKey: null,
        envKey: null,
        thinking: false,
        maxTokens: 8192,
        temperature: 1,
        topP: 0.95,
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
 * Résolution de clé API avec logique à 4 niveaux :
 *   1. Clé utilisateur en base de données   (priorité maximale — spécifique au modèle)
 *   2. Clé globale openai_api_key en base    (clé maître configurée par l'utilisateur)
 *   3. Clé système spécifique au modèle      (process.env, rarement utilisée)
 *   4. Clé NVIDIA par défaut (NVIDIA_DEFAULT_API_KEY) — fallback final, couvre TOUS
 *      les modèles NVIDIA (y compris ceux sans dbKey/envKey dédié)
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

    // Niveau 3 : clé système spécifique au modèle dans .env
    if (modelDef?.envKey && process.env[modelDef.envKey]) {
        return process.env[modelDef.envKey];
    }
    if (modelDef?.legacyEnvKey && process.env[modelDef.legacyEnvKey]) {
        return process.env[modelDef.legacyEnvKey];
    }

    // Niveau 4 : clé NVIDIA par défaut — fallback système final pour tous les modèles NVIDIA
    if (process.env.NVIDIA_DEFAULT_API_KEY) {
        return process.env.NVIDIA_DEFAULT_API_KEY;
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
 * @param {'text'|'vision'|'image-edit'|'moderation'|null} type  null = tous
 */
function getModelsByType(type = null) {
    if (!type) return MODELS;
    return MODELS.filter(m => m.type === type);
}

/**
 * Construit les paramètres de génération additionnels (max_tokens, temperature,
 * top_p, reasoning_effort, reasoning_budget, extra_body) à partir de la config
 * du modèle. Chaque modèle du catalogue déclare ses propres défauts — les
 * services d'appel (openaiService.js) n'ont donc pas besoin d'un cas spécial
 * par modèle (ex: l'ancien `if (targetModel === 'z-ai/glm-4.7')`).
 *
 * @param {object|null} modelDef - Définition retournée par getModelDef()
 * @returns {object} Paramètres à fusionner dans le payload de complétion
 */
function buildGenerationParams(modelDef) {
    if (!modelDef) return {};
    const params = {};
    if (modelDef.maxTokens) params.max_tokens = modelDef.maxTokens;
    if (modelDef.temperature !== undefined) params.temperature = modelDef.temperature;
    if (modelDef.topP !== undefined) params.top_p = modelDef.topP;
    if (modelDef.topK !== undefined) params.top_k = modelDef.topK;
    if (modelDef.presencePenalty !== undefined) params.presence_penalty = modelDef.presencePenalty;
    if (modelDef.frequencyPenalty !== undefined) params.frequency_penalty = modelDef.frequencyPenalty;
    if (modelDef.repetitionPenalty !== undefined) params.repetition_penalty = modelDef.repetitionPenalty;
    if (modelDef.reasoningEffort) params.reasoning_effort = modelDef.reasoningEffort;
    if (modelDef.reasoningBudget) params.reasoning_budget = modelDef.reasoningBudget;
    if (modelDef.chatTemplateKwargs || modelDef.extraBody) {
        params.extra_body = {
            ...(modelDef.extraBody || {}),
            ...(modelDef.chatTemplateKwargs ? { chat_template_kwargs: modelDef.chatTemplateKwargs } : {}),
        };
    }
    return params;
}

module.exports = {
    NVIDIA_BASE_URL,
    MODELS,
    resolveKey,
    getDefaultVisionModel,
    getModelDef,
    getModelsByType,
    buildGenerationParams,
};
