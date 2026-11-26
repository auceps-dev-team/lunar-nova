// @vitest-environment node
//
// Contrat HTTP de l'adaptateur Ollama. Relevé le 26/11/2026 : des quatre
// fournisseurs, c'était le seul sans aucun test (Gemini, OpenAI/NVIDIA et
// OpenRouter en avaient). Aucun réseau : le `fetch` global est substitué.
//
// Convention du projet : require, jamais import (cf. agentFallbackStrategies).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { chatWithAgent, listModels, classifyOrderIntent } = require('../ollamaService');

let fetchMock;
const jsonResponse = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const lastRequest = () => {
    const [url, init] = fetchMock.mock.calls.at(-1);
    return { url: String(url), body: init && init.body ? JSON.parse(init.body) : null, headers: new Headers(init && init.headers) };
};
const reponseChat = (content) => ({ model: 'm', message: { role: 'assistant', content }, done: true });

beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('ollamaService.chatWithAgent', () => {
    it('ne fait rien d\'un message vide', async () => {
        const r = await chatWithAgent('copywriter', '', null, 'text');
        expect(r.response).toMatch(/didn't catch that/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('interroge l\'instance locale avec la consigne du persona, sans clé', async () => {
        fetchMock.mockResolvedValue(jsonResponse(reponseChat('Voici une accroche.')));
        const orchestrator = require('../agents/orchestrator');

        const r = await chatWithAgent('copywriter', 'Écris une accroche', null, 'text');

        const { url, body, headers } = lastRequest();
        expect(url).toBe('http://127.0.0.1:11434/api/chat');
        expect(headers.get('authorization')).toBeNull();
        expect(body.messages[0]).toEqual({ role: 'system', content: orchestrator.getPersona('copywriter').systemInstruction });
        expect(body.messages[1]).toEqual({ role: 'user', content: 'Écris une accroche' });
        expect(body.stream).toBe(false);
        expect(r.response).toBe('Voici une accroche.');
    });

    it('honore le modèle transmis par le routeur (model_override)', async () => {
        fetchMock.mockResolvedValue(jsonResponse(reponseChat('ok')));
        await chatWithAgent('copywriter', 'Salut', null, 'text', { system_instruction: 'Consigne.', response_format: 'text', model_override: 'mistral:7b' });
        expect(lastRequest().body.model).toBe('mistral:7b');
    });

    it('passe par Ollama Cloud avec la clé quand elle existe', async () => {
        fetchMock.mockResolvedValue(jsonResponse(reponseChat('ok')));
        await chatWithAgent('copywriter', 'Salut', null, 'text', null, 'cle-ollama');
        const { url, headers } = lastRequest();
        // Le SDK écrit le port explicitement (« https://ollama.com:443/api/chat ») :
        // même adresse, comparée par origine et chemin.
        expect(new URL(url).origin).toBe('https://ollama.com');
        expect(new URL(url).pathname).toBe('/api/chat');
        expect(headers.get('authorization')).toBe('Bearer cle-ollama');
    });

    it('demande du JSON et retire les clôtures markdown en mode json', async () => {
        fetchMock.mockResolvedValue(jsonResponse(reponseChat('```json\n{"ok": true}\n```')));
        const r = await chatWithAgent('copywriter', 'Donne du JSON', null, 'json');
        expect(lastRequest().body.format).toBe('json');
        expect(r.response).toBe('{"ok": true}');
    });

    it('rend un message d\'indisponibilité au lieu de lever quand l\'instance est éteinte', async () => {
        fetchMock.mockRejectedValue(new TypeError('fetch failed'));
        const r = await chatWithAgent('copywriter', 'Bonjour', null, 'text');
        expect(r.response).toMatch(/offline|connection error/);
    });
});

describe('ollamaService.listModels', () => {
    it('rend les modèles installés, sans aucune liste d\'image', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ models: [{ name: 'llama3:8b' }, { name: 'mistral:7b' }] }));
        const r = await listModels();
        expect(r).toEqual({ chat: [{ id: 'llama3:8b', name: 'llama3:8b' }, { id: 'mistral:7b', name: 'mistral:7b' }] });
        expect(lastRequest().url).toBe('http://127.0.0.1:11434/api/tags');
    });

    it('instance injoignable : repli lisible, toujours sans liste d\'image', async () => {
        fetchMock.mockRejectedValue(new TypeError('fetch failed'));
        expect(await listModels()).toEqual({ chat: [{ id: 'llama3', name: 'Llama 3 (Indisponible)' }] });
    });
});

describe('ollamaService.classifyOrderIntent', () => {
    it('fusionne la classification avec le repli neutre', async () => {
        fetchMock.mockResolvedValue(jsonResponse(reponseChat('{"is_order": true, "confidence": 0.8}')));
        expect(await classifyOrderIntent('je veux 2 pagnes', 'Awa')).toEqual({
            is_order: true, confidence: 0.8, order_type: 'not_an_order', summary: ''
        });
    });

    it('rend le repli neutre en cas d\'erreur', async () => {
        fetchMock.mockRejectedValue(new TypeError('fetch failed'));
        expect(await classifyOrderIntent('je veux', 'Awa')).toEqual({ is_order: false, confidence: 0, order_type: 'not_an_order', summary: '' });
    });
});
