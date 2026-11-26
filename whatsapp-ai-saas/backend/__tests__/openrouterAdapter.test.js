// P2-3 (b) : tests de l'adaptateur OpenRouter avec fetch mocké — aucun réseau.
// On vérifie le contrat HTTP exigé par le fournisseur (Bearer, HTTP-Referer
// d'attribution, X-Title), le modèle par défaut centralisé, et le traitement
// des réponses (JSON tolérant aux clôtures markdown, erreurs API, replis).
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { generateProposals, chatWithAgent, classifyOrderIntent, chatModelsFromCatalog } = require('../openrouterService');

// Tri du catalogue. Formes relevées sur le catalogue public le 26/11/2026 :
// 477 modèles, 335 « contenant image », 13 seulement générant des images —
// l'ancien tri excluait 322 modèles de vision de la liste de conversation.
describe('chatModelsFromCatalog', () => {
    const catalogue = [
        { id: 'meta/llama-3.3-70b', name: 'Llama', architecture: { modality: 'text->text', output_modalities: ['text'] } },
        { id: 'mistralai/pixtral-large-2502', name: 'Pixtral', architecture: { modality: 'text+image->text', output_modalities: ['text'] } },
        { id: 'google/gemini-4-neon', name: 'Gemini', architecture: { modality: 'text+image+file+audio+video->text', output_modalities: ['text'] } },
        { id: 'generateur/image', name: 'Image', architecture: { modality: 'text->image', output_modalities: ['image'] } },
        { id: 'ancien/format', name: 'Ancien', architecture: { modality: 'text+image->text' } },
        { id: 'ancien/image', name: 'Ancien image', architecture: { modality: 'text->image' } },
        { id: 'sans/architecture', name: 'Nu' }
    ];
    const ids = chatModelsFromCatalog(catalogue).map((m) => m.id);

    it('garde les modèles de vision, qui lisent une image et répondent en texte', () => {
        expect(ids).toEqual(expect.arrayContaining(['mistralai/pixtral-large-2502', 'google/gemini-4-neon', 'ancien/format']));
    });

    it('écarte les générateurs d\'image, par output_modalities ou par modality', () => {
        expect(ids).not.toContain('generateur/image');
        expect(ids).not.toContain('ancien/image');
    });

    it('garde un modèle texte, même sans description d\'architecture', () => {
        expect(ids).toEqual(expect.arrayContaining(['meta/llama-3.3-70b', 'sans/architecture']));
        expect(ids).toHaveLength(5);
    });
});

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Réponse JSON typique d'une API compatible OpenAI/OpenRouter.
const completion = (content) => ({
    choices: [{ message: { content } }]
});

let fetchMock;

beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('openrouterService.chatWithAgent — contrat HTTP', () => {
    it('envoie Bearer, HTTP-Referer et X-Title sur l\'URL de chat, avec le modèle par défaut', async () => {
        fetchMock.mockResolvedValue({ json: async () => completion('Bonjour !') });

        const result = await chatWithAgent('copywriter', 'Bonjour', null, 'text', 'sk-or-v1-test');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(OPENROUTER_URL);
        expect(init.method).toBe('POST');
        expect(init.headers['Authorization']).toBe('Bearer sk-or-v1-test');
        // Exigé par la politique d'attribution OpenRouter — ne doit pas disparaître.
        expect(init.headers['HTTP-Referer']).toBe('http://localhost:3000');
        expect(init.headers['X-Title']).toBe('WaCopilote');

        const body = JSON.parse(init.body);
        expect(body.model).toBe('anthropic/claude-3.5-sonnet');
        expect(result.response).toBe('Bonjour !');
    });

    it('respecte model_override de l\'agent en base', async () => {
        fetchMock.mockResolvedValue({ json: async () => completion('ok') });
        await chatWithAgent('copywriter', 'salut', null, 'text', 'k', {
            system_instruction: 'Tu es un test.',
            response_format: 'text',
            model_override: 'meta-llama/llama-3.1-8b-instruct'
        });
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.model).toBe('meta-llama/llama-3.1-8b-instruct');
        expect(body.messages[0].content).toBe('Tu es un test.');
    });

    it('retire les clôtures markdown quand le format demandé est JSON', async () => {
        fetchMock.mockResolvedValue({ json: async () => completion('```json\n{"a":1}\n```') });
        const result = await chatWithAgent('order_radar', 'msg', null, 'json', 'k');
        expect(JSON.parse(result.response)).toEqual({ a: 1 });
    });

    it("renvoie le message hors-ligne en cas d'erreur renvoyée par l'API", async () => {
        fetchMock.mockResolvedValue({ json: async () => ({ error: { message: 'Insufficient credits' } }) });
        const result = await chatWithAgent('copywriter', 'Bonjour', null, 'text', 'k');
        expect(result.response).toMatch(/offline|connection error/i);
    });

    it('refuse de travailler sans clé API', async () => {
        const result = await chatWithAgent('copywriter', 'Bonjour', null, 'text', '');
        expect(result.response).toMatch(/API key not configured/);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('openrouterService.generateProposals — parsing tolérant', () => {
    const ctx = { contactName: 'Awa', messages: [{ time: '10:00', sender: 'Awa', text: 'Bonjour, c\'est dispo ?' }] };

    it('parse un JSON proposé dans une clôture markdown', async () => {
        fetchMock.mockResolvedValue({
            json: async () => completion('```json\n{"proposed_replies":["Oui !","Dispo demain"]}\n```')
        });
        const r = await generateProposals(ctx, null, 'sk-or-v1-test');
        expect(r.proposed_replies).toEqual(['Oui !', 'Dispo demain']);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.response_format).toEqual({ type: 'json_object' });
        expect(body.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('signale un JSON illisible plutôt que de crasher', async () => {
        fetchMock.mockResolvedValue({ json: async () => completion('aucun json ici') });
        const r = await generateProposals(ctx, null, 'sk-or-v1-test');
        expect(r.proposed_replies[0]).toMatch(/Erreur de parsing/);
    });

    it('rend une liste vide sans contexte de message', async () => {
        const r = await generateProposals({ contactName: 'X', messages: [] }, null, 'sk-or-v1-test');
        expect(r.proposed_replies).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('openrouterService.classifyOrderIntent — repli défensif', () => {
    it('fusionne la classification JSON sur les valeurs par défaut', async () => {
        fetchMock.mockResolvedValue({
            json: async () => completion('{"is_order": true, "confidence": 0.9, "order_type": "product_inquiry", "summary": "Demande de prix"}')
        });
        const r = await classifyOrderIntent('Combien le sac ?', 'Awa', 'k');
        expect(r).toEqual({ is_order: true, confidence: 0.9, order_type: 'product_inquiry', summary: 'Demande de prix' });
    });

    it('rend le repli neutre sans clé ou en cas d\'échec réseau', async () => {
        const fallback = { is_order: false, confidence: 0, order_type: 'not_an_order', summary: '' };
        expect(await classifyOrderIntent('msg', 'Awa', '')).toEqual(fallback);

        fetchMock.mockRejectedValue(new Error('network down'));
        expect(await classifyOrderIntent('msg', 'Awa', 'k')).toEqual(fallback);
    });
});
