// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// nvidiaModels requiert dotenv et lit process.env au chargement : sans risque.
import {
    NVIDIA_BASE_URL,
    getModelDef,
    getModelsByType,
    buildGenerationParams,
    resolveKey,
} from '../nvidiaModels.js';

describe('getModelDef', () => {
    it('retrouve un modèle par ID exact', () => {
        const def = getModelDef('meta/llama-4-maverick-17b-128e-instruct');
        expect(def).not.toBeNull();
        expect(def.name).toBe('Llama 4 Maverick 17B');
    });

    it('retrouve un modèle par variante point/underscore', () => {
        expect(getModelDef('meta/llama-4-maverick-17b-128e-instruct')).not.toBeNull();
    });

    it('renvoie null pour un ID inconnu', () => {
        expect(getModelDef('inconnu/modele')).toBeNull();
        expect(getModelDef(null)).toBeNull();
        expect(getModelDef('')).toBeNull();
    });
});

describe('getModelsByType', () => {
    it('filtre par type', () => {
        const vision = getModelsByType('vision');
        expect(vision.length).toBeGreaterThan(0);
        expect(vision.every(m => m.type === 'vision')).toBe(true);
    });

    it('renvoie tout le catalogue sans filtre', () => {
        expect(getModelsByType().length).toBe(getModelsByType(null).length);
    });
});

describe('buildGenerationParams', () => {
    it('traduit la config du modèle en paramètres OpenAI-compatibles', () => {
        const def = {
            maxTokens: 2048,
            temperature: 0.6,
            topP: 0.95,
            reasoningEffort: 'high',
        };
        expect(buildGenerationParams(def)).toEqual({
            max_tokens: 2048,
            temperature: 0.6,
            top_p: 0.95,
            reasoning_effort: 'high',
        });
    });

    it('embarque chatTemplateKwargs dans extra_body', () => {
        const def = { chatTemplateKwargs: { enable_thinking: true } };
        expect(buildGenerationParams(def)).toEqual({
            extra_body: { chat_template_kwargs: { enable_thinking: true } },
        });
    });

    it('renvoie un objet vide sans définition', () => {
        expect(buildGenerationParams(null)).toEqual({});
        expect(buildGenerationParams(undefined)).toEqual({});
    });
});

describe('resolveKey', () => {
    const getSetting = vi.fn(async () => '');

    beforeEach(() => {
        getSetting.mockReset();
        getSetting.mockResolvedValue('');
    });

    it('priorise la clé spécifique au modèle en base', async () => {
        getSetting.mockImplementation(async (key) => key === 'nvidia_key_llama' ? 'CLE_MODELE' : '');
        const key = await resolveKey('meta/llama-4-maverick-17b-128e-instruct', getSetting);
        expect(key).toBe('CLE_MODELE');
    });

    it('retombe sur la clé globale openai_api_key', async () => {
        getSetting.mockImplementation(async (key) => key === 'openai_api_key' ? 'CLE_GLOBALE' : '');
        const key = await resolveKey('qwen/qwen3.5-397b-a17b', getSetting);
        expect(key).toBe('CLE_GLOBALE');
    });

    it('retombe sur la clé système NVIDIA_DEFAULT_API_KEY', async () => {
        const before = process.env.NVIDIA_DEFAULT_API_KEY;
        process.env.NVIDIA_DEFAULT_API_KEY = 'CLE_SYSTEME';
        try {
            const key = await resolveKey('qwen/qwen3.5-397b-a17b', getSetting);
            expect(key).toBe('CLE_SYSTEME');
        } finally {
            if (before === undefined) delete process.env.NVIDIA_DEFAULT_API_KEY;
            else process.env.NVIDIA_DEFAULT_API_KEY = before;
        }
    });

    it('renvoie une chaîne vide sans aucune clé', async () => {
        delete process.env.NVIDIA_DEFAULT_API_KEY;
        const key = await resolveKey('qwen/qwen3.5-397b-a17b', getSetting);
        expect(key).toBe('');
    });

    it('expose une base URL NVIDIA', () => {
        expect(NVIDIA_BASE_URL).toContain('api.nvidia.com');
    });
});
