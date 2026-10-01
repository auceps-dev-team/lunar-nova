// @vitest-environment node
//
// Contrat HTTP de l'adaptateur OpenAI-compatible (NVIDIA NIM, Together…) —
// constat R1 de l'audit du 29/09/2026 : openaiService n'était couvert que pour
// un utilitaire de nettoyage de prompt.
//
// Aucun réseau. Le SDK `openai` v6 appelle le `fetch` global au moment de la
// requête (vérifié le 1er octobre 2026 : substitué APRÈS l'import, il est bien
// utilisé) ; on le remplace par des réponses construites. Les erreurs sont
// simulées en 400/401 : le SDK relance automatiquement les 5xx et les erreurs
// de connexion, ce qui rendrait ces tests lents sans rien prouver de plus.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { classifyOrderIntent, chatWithAgent, generateProposals } = require('../openaiService');

const BASE = 'https://integrate.api.nvidia.com/v1';
const KEY = 'nvapi-test';

const jsonResponse = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const completion = (content, extra = {}) => ({
    id: 'chatcmpl-test',
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content, ...extra }, finish_reason: 'stop' }]
});

let fetchMock;
const lastRequest = () => {
    const [url, init] = fetchMock.mock.calls.at(-1);
    return { url: String(url), init, body: JSON.parse(init.body), headers: new Headers(init.headers) };
};

beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('openaiService.classifyOrderIntent', () => {
    const FALLBACK = { is_order: false, confidence: 0, order_type: 'not_an_order', summary: '' };

    it('rend le repli neutre sans clé, sans appeler le réseau', async () => {
        await expect(classifyOrderIntent('je veux 2 pagnes', 'Awa', '', BASE)).resolves.toEqual(FALLBACK);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('interroge /chat/completions avec la clé, le modèle par défaut et une sortie JSON', async () => {
        fetchMock.mockResolvedValue(jsonResponse(completion(
            '{"is_order": true, "confidence": 0.92, "order_type": "purchase", "summary": "2 pagnes"}'
        )));

        const r = await classifyOrderIntent('je veux 2 pagnes', 'Awa', KEY, BASE);

        const { url, headers, body } = lastRequest();
        expect(url).toBe(`${BASE}/chat/completions`);
        expect(headers.get('authorization')).toBe(`Bearer ${KEY}`);
        expect(body.model).toBe('meta/llama-3.1-8b-instruct');
        expect(body.response_format).toEqual({ type: 'json_object' });
        expect(body.messages[1].content).toContain('je veux 2 pagnes');
        expect(r).toEqual({ is_order: true, confidence: 0.92, order_type: 'purchase', summary: '2 pagnes' });
    });

    it('honore le modèle demandé', async () => {
        fetchMock.mockResolvedValue(jsonResponse(completion('{"is_order": false}')));
        await classifyOrderIntent('bonjour', 'Awa', KEY, BASE, 'qwen/qwen3-coder');
        expect(lastRequest().body.model).toBe('qwen/qwen3-coder');
    });

    it('lit un JSON entouré de clôtures markdown', async () => {
        fetchMock.mockResolvedValue(jsonResponse(completion('```json\n{"is_order": true, "confidence": 0.7}\n```')));
        const r = await classifyOrderIntent('combien ?', 'Awa', KEY, BASE);
        expect(r).toMatchObject({ is_order: true, confidence: 0.7, order_type: 'not_an_order' });
    });

    it('retombe sur le repli quand l\'API refuse, sans lever', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'Incorrect API key', type: 'invalid_request_error' } }, 401));
        await expect(classifyOrderIntent('je veux', 'Awa', KEY, BASE)).resolves.toEqual(FALLBACK);
    });

    it('retombe sur le repli quand la réponse n\'est pas du JSON', async () => {
        fetchMock.mockResolvedValue(jsonResponse(completion('Désolé, je ne peux pas répondre.')));
        await expect(classifyOrderIntent('je veux', 'Awa', KEY, BASE)).resolves.toEqual(FALLBACK);
    });
});

describe('openaiService.chatWithAgent', () => {
    it('signale l\'absence de clé sans appeler le réseau', async () => {
        const r = await chatWithAgent('creative', 'Bonjour', null, 'text', '', BASE);
        expect(r.response).toMatch(/API key not configured/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('ne fait rien d\'un message vide sans image', async () => {
        const r = await chatWithAgent('creative', '', null, 'text', KEY, BASE);
        expect(r.response).toMatch(/didn't catch that/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('envoie la consigne du persona puis le message, et rend le contenu', async () => {
        fetchMock.mockResolvedValue(jsonResponse(completion('Voici une accroche.')));

        const r = await chatWithAgent('copywriter', 'Écris une accroche', null, 'text', KEY, BASE);

        const { body } = lastRequest();
        expect(body.messages[0].role).toBe('system');
        expect(body.messages[0].content.length).toBeGreaterThan(20);
        expect(body.messages[1]).toEqual({ role: 'user', content: 'Écris une accroche' });
        expect(body.response_format).toBeUndefined();
        expect(r.response).toBe('Voici une accroche.');
    });

    it('privilégie la consigne et le modèle de l\'agent en base', async () => {
        fetchMock.mockResolvedValue(jsonResponse(completion('ok')));
        const dbAgent = { system_instruction: 'Tu es un agent maison.', response_format: 'text', model_override: 'mistralai/mistral-large' };

        await chatWithAgent('creative', 'Salut', null, 'text', KEY, BASE, dbAgent);

        const { body } = lastRequest();
        expect(body.model).toBe('mistralai/mistral-large');
        expect(body.messages[0].content).toBe('Tu es un agent maison.');
    });

    it('joint l\'image en data URL pour les modèles de vision', async () => {
        fetchMock.mockResolvedValue(jsonResponse(completion('Une robe rouge.')));

        await chatWithAgent('creative', 'Décris', { data: 'QUJD', mimeType: 'image/png' }, 'text', KEY, BASE);

        const content = lastRequest().body.messages[1].content;
        expect(content[0]).toEqual({ type: 'text', text: 'Décris' });
        expect(content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } });
    });

    it('exige du JSON et retire les clôtures quand le format est JSON', async () => {
        fetchMock.mockResolvedValue(jsonResponse(completion('```json\n{"a": 1}\n```')));

        const r = await chatWithAgent('creative', 'Donne du JSON', null, 'json', KEY, BASE);

        const { body } = lastRequest();
        expect(body.response_format).toEqual({ type: 'json_object' });
        expect(body.messages[0].content).toMatch(/Return ONLY a valid JSON/);
        expect(r.response).toBe('{"a": 1}');
    });

    it('préfixe le raisonnement des modèles « thinking »', async () => {
        fetchMock.mockResolvedValue(jsonResponse(completion('Réponse finale', { reasoning_content: 'Je réfléchis.' })));
        const r = await chatWithAgent('creative', 'Question', null, 'text', KEY, BASE);
        expect(r.response).toBe('*Thinking:* Je réfléchis.\n\nRéponse finale');
    });

    it('rend la raison donnée par le fournisseur quand la clé est refusée', async () => {
        // La branche d'erreur lit aussi `error.response.data`, une forme propre à
        // axios que le SDK openai v6 ne produit pas : c'est `error.message` qui
        // porte le motif. Ce test fixe ce que l'utilisateur lit réellement.
        fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'Incorrect API key provided', type: 'invalid_request_error' } }, 401));

        const r = await chatWithAgent('creative', 'Bonjour', null, 'text', KEY, BASE);

        expect(r.response).toMatch(/^API Error: /);
        expect(r.response).toContain('401');
        expect(r.response).toContain('Incorrect API key provided');
    });
});

describe('openaiService.generateProposals', () => {
    const context = { contactName: 'Awa', messages: [{ time: '10:02', sender: 'Awa', text: 'Le pagne est dispo ?' }] };

    it('signale l\'absence de clé', async () => {
        const r = await generateProposals(context, null, '', BASE);
        expect(r.proposed_replies[0]).toMatch(/API key not configured/);
    });

    it('rend une liste vide sans message', async () => {
        await expect(generateProposals({ contactName: 'Awa', messages: [] }, null, KEY, BASE))
            .resolves.toEqual({ proposed_replies: [] });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('met en forme la conversation et lit un objet proposed_replies', async () => {
        fetchMock.mockResolvedValue(jsonResponse(completion('{"proposed_replies": ["Oui, il est dispo.", "Quelle taille ?"]}')));

        const r = await generateProposals(context, null, KEY, BASE);

        expect(lastRequest().body.messages[1].content).toContain('[10:02] Awa: Le pagne est dispo ?');
        expect(r.proposed_replies).toEqual(['Oui, il est dispo.', 'Quelle taille ?']);
    });

    it('accepte un tableau nu', async () => {
        fetchMock.mockResolvedValue(jsonResponse(completion('["Oui", "Non"]')));
        await expect(generateProposals(context, null, KEY, BASE)).resolves.toEqual({ proposed_replies: ['Oui', 'Non'] });
    });

    it('signale un format inattendu plutôt que de le rendre tel quel', async () => {
        fetchMock.mockResolvedValue(jsonResponse(completion('{"reponses": ["Oui"]}')));
        const r = await generateProposals(context, null, KEY, BASE);
        expect(r.proposed_replies[0]).toMatch(/Format inattendu/);
    });

    it('signale un JSON illisible', async () => {
        fetchMock.mockResolvedValue(jsonResponse(completion('pas du json')));
        const r = await generateProposals(context, null, KEY, BASE);
        expect(r.proposed_replies[0]).toMatch(/parsing JSON/);
    });
});
