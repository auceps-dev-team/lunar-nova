// @vitest-environment node
//
// Routage par fournisseur d'aiController.generateProposals et
// classifyOrderIntent — tests de caractérisation écrits AVANT le refactor R6
// (audit du 29/09/2026), pour que le comportement soit prouvé identique après.
//
// Convention du projet : require (jamais import) et substitution par espace de
// noms — cf. agentFallbackStrategies.test.js. Aucun réseau : chaque adaptateur
// est remplacé par un espion.
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';

const db = require('../db');
const aiController = require('../aiController');
const geminiService = require('../geminiService');
const openrouterService = require('../openrouterService');
const ollamaService = require('../ollamaService');
const openaiService = require('../openaiService');
const nvidiaModels = require('../nvidiaModels');

const TOGETHER = 'https://api.together.xyz/v1';
const TOGETHER_MODEL = 'nim/meta/llama-3.2-11b-vision-instruct';

const settings = new Map();
const realGetSetting = db.getSetting;
db.getSetting = async (key, def = null) => (settings.has(key) ? settings.get(key) : def);

const SERVICES = { gemini: geminiService, openrouter: openrouterService, ollama: ollamaService, openai: openaiService };
const originals = {};
for (const [name, svc] of Object.entries(SERVICES)) {
    originals[name] = { generateProposals: svc.generateProposals, classifyOrderIntent: svc.classifyOrderIntent };
}

afterAll(() => {
    db.getSetting = realGetSetting;
    for (const [name, svc] of Object.entries(SERVICES)) Object.assign(svc, originals[name]);
});

beforeEach(() => {
    settings.clear();
    for (const [name, svc] of Object.entries(SERVICES)) {
        svc.generateProposals = vi.fn(async () => ({ proposed_replies: [`via ${name}`] }));
        svc.classifyOrderIntent = vi.fn(async () => ({ is_order: true, via: name }));
    }
    // Aucune clé système ne doit masquer l'absence de clé utilisateur.
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('NVIDIA_DEFAULT_API_KEY', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

const CTX = { contactName: 'Awa', messages: [{ time: '10:00', sender: 'Awa', text: 'dispo ?' }] };

// Les deux tâches partagent le même routage : chaque cas est éprouvé sur les deux.
const TASKS = [
    {
        name: 'generateProposals',
        call: (model, provider) => aiController.generateProposals(CTX, model, provider),
        // Arguments attendus côté adaptateur, selon le fournisseur.
        expectArgs: {
            gemini: (model) => [CTX, model],
            openrouter: (model, c) => [CTX, model, c.apiKey],
            ollama: (model, c) => [CTX, model, c.apiKey],
            openai: (model, c) => [CTX, model, c.apiKey, c.baseURL]
        }
    },
    {
        name: 'classifyOrderIntent',
        call: (model, provider) => aiController.classifyOrderIntent('je veux', 'Awa', model, provider),
        expectArgs: {
            gemini: (model) => ['je veux', 'Awa', model],
            openrouter: (model, c) => ['je veux', 'Awa', c.apiKey, model],
            ollama: (model, c) => ['je veux', 'Awa', c.apiKey, model],
            openai: (model, c) => ['je veux', 'Awa', c.apiKey, c.baseURL, model]
        }
    }
];

describe.each(TASKS)('aiController.$name — routage par fournisseur', ({ name, call, expectArgs }) => {
    const spy = (provider) => SERVICES[provider][name];

    it('sans réglage, passe par Gemini', async () => {
        await call('m1', null);
        expect(spy('gemini')).toHaveBeenCalledWith(...expectArgs.gemini('m1'));
    });

    it('suit le fournisseur par défaut des réglages', async () => {
        settings.set('default_ai_provider', 'ollama');
        settings.set('ollama_api_key', 'oll-1');
        await call('llama3', null);
        expect(spy('ollama')).toHaveBeenCalledWith(...expectArgs.ollama('llama3', { apiKey: 'oll-1' }));
        expect(spy('gemini')).not.toHaveBeenCalled();
    });

    it('le fournisseur imposé prime sur le réglage', async () => {
        settings.set('default_ai_provider', 'ollama');
        settings.set('openrouter_api_key', 'sk-or-1');
        await call('m', 'openrouter');
        expect(spy('openrouter')).toHaveBeenCalledWith(...expectArgs.openrouter('m', { apiKey: 'sk-or-1' }));
    });

    it('OpenRouter sans clé retombe sur Gemini', async () => {
        await call('m', 'openrouter');
        expect(spy('openrouter')).not.toHaveBeenCalled();
        expect(spy('gemini')).toHaveBeenCalledWith(...expectArgs.gemini('m'));
    });

    it('OpenRouter sans clé utilisateur mais avec clé système passe quand même (clé vide transmise)', async () => {
        vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-systeme');
        await call('m', 'openrouter');
        expect(spy('openrouter')).toHaveBeenCalledWith(...expectArgs.openrouter('m', { apiKey: '' }));
    });

    it('NVIDIA : clé globale et URL NVIDIA par défaut', async () => {
        settings.set('openai_api_key', 'nvapi-1');
        await call(null, 'openai');
        expect(spy('openai')).toHaveBeenCalledWith(
            ...expectArgs.openai(null, { apiKey: 'nvapi-1', baseURL: nvidiaModels.NVIDIA_BASE_URL })
        );
    });

    it('NVIDIA : URL de base personnalisée', async () => {
        settings.set('openai_api_key', 'nvapi-1');
        settings.set('openai_base_url', 'https://mon-proxy.example/v1');
        await call(null, 'openai');
        expect(spy('openai')).toHaveBeenCalledWith(
            ...expectArgs.openai(null, { apiKey: 'nvapi-1', baseURL: 'https://mon-proxy.example/v1' })
        );
    });

    it('NVIDIA : un modèle Together part vers Together, quelle que soit l\'URL réglée', async () => {
        settings.set('openai_api_key', 'nvapi-1');
        settings.set('openai_base_url', 'https://mon-proxy.example/v1');
        await call(TOGETHER_MODEL, 'openai');
        expect(spy('openai')).toHaveBeenCalledWith(
            ...expectArgs.openai(TOGETHER_MODEL, { apiKey: 'nvapi-1', baseURL: TOGETHER })
        );
    });

    it('NVIDIA sans aucune clé retombe sur Gemini', async () => {
        await call(null, 'openai');
        expect(spy('openai')).not.toHaveBeenCalled();
        expect(spy('gemini')).toHaveBeenCalled();
    });

    it('un fournisseur inconnu passe par Gemini', async () => {
        await call('m', 'fournisseur-inexistant');
        expect(spy('gemini')).toHaveBeenCalledWith(...expectArgs.gemini('m'));
    });

    it('un échec de l\'adaptateur retombe sur Gemini, et le dit', async () => {
        settings.set('ollama_api_key', 'oll-1');
        SERVICES.ollama[name] = vi.fn(async () => { throw new Error('ollama injoignable'); });

        const r = await call('llama3', 'ollama');

        expect(spy('gemini')).toHaveBeenCalledWith(...expectArgs.gemini('llama3'));
        expect(JSON.stringify(r)).toContain('gemini');
        const logs = console.error.mock.calls.flat().join(' ');
        expect(logs).toMatch(/Fallback sur Gemini/);
        expect(logs).toContain('ollama injoignable');
    });
});
