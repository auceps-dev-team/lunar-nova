// @vitest-environment node
//
// Contrat de l'adaptateur Gemini — constat R1 de l'audit du 29/09/2026 :
// geminiService (≈ 620 lignes) n'avait aucun test.
//
// Aucun réseau. Le SDK @google/genai appelle le `fetch` global au moment de la
// requête (vérifié le 1er octobre 2026), qu'on remplace par des réponses
// construites. La clé vient de `db.getSetting`, substitué par espace de noms
// selon la convention du projet (require, jamais import : cf.
// agentFallbackStrategies.test.js).
//
// Les assertions sur le corps de requête vérifient ce qui doit y FIGURER, pas
// sa forme exacte : le SDK réorganise librement la configuration, et un test
// qui en épouserait la structure casserait à chaque mise à jour sans rien dire
// du comportement de WaCopilote.
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';

const db = require('../db');
const { classifyOrderIntent, transcribeAudio } = require('../geminiService');

const KEY = 'AIza-test-cle-utilisateur';

const settings = new Map();
const realGetSetting = db.getSetting;
db.getSetting = async (key, def = null) => (settings.has(key) ? settings.get(key) : def);
afterAll(() => { db.getSetting = realGetSetting; });

const geminiResponse = (text) => new Response(JSON.stringify({
    candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }]
}), { status: 200, headers: { 'content-type': 'application/json' } });

const geminiError = (status, message) => new Response(JSON.stringify({
    error: { code: status, message, status: 'INVALID_ARGUMENT' }
}), { status, headers: { 'content-type': 'application/json' } });

let fetchMock;
const lastRequest = () => {
    const [url, init] = fetchMock.mock.calls.at(-1);
    return { url: String(url), headers: new Headers(init.headers), raw: String(init.body) };
};

beforeEach(() => {
    settings.clear();
    settings.set('gemini_api_key', KEY);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('geminiService — résolution de la clé', () => {
    it('refuse de travailler sans aucune clé, avant tout appel réseau', async () => {
        settings.delete('gemini_api_key');
        await expect(transcribeAudio(Buffer.from('OggS'), 'audio/ogg')).rejects.toThrow(/API key not valid/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejette une clé de remplissage laissée dans un .env d\'exemple', async () => {
        settings.delete('gemini_api_key');
        vi.stubEnv('GEMINI_API_KEY', 'your-gemini-api-key-here');
        await expect(transcribeAudio(Buffer.from('OggS'), 'audio/ogg')).rejects.toThrow(/API key not valid/);
    });

    it('avec la clé système par défaut, n\'autorise que les modèles de la liste', async () => {
        settings.delete('gemini_api_key');
        vi.stubEnv('GEMINI_API_KEY', 'AIza-cle-systeme-de-test');
        await expect(transcribeAudio(Buffer.from('OggS'), 'audio/ogg', { model: 'gemini-ultra-hors-liste' }))
            .rejects.toThrow(/MODEL_RESTRICTED/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('envoie la clé de l\'utilisateur dans l\'en-tête, jamais dans l\'URL', async () => {
        fetchMock.mockResolvedValue(geminiResponse('{"is_order": false}'));
        await classifyOrderIntent('bonjour', 'Awa');

        const { url, headers } = lastRequest();
        expect(headers.get('x-goog-api-key')).toBe(KEY);
        expect(url).not.toContain(KEY);
    });
});

describe('geminiService.classifyOrderIntent', () => {
    const FALLBACK = { is_order: false, confidence: 0, order_type: 'not_an_order', summary: '' };

    it('interroge gemini-2.5-flash par défaut, en JSON, avec le message et le contact', async () => {
        fetchMock.mockResolvedValue(geminiResponse('{"is_order": true, "confidence": 0.88, "order_type": "purchase", "summary": "pagnes"}'));

        const r = await classifyOrderIntent('je veux deux pagnes', 'Awa');

        const { url, raw } = lastRequest();
        expect(url).toContain('/models/gemini-2.5-flash:generateContent');
        expect(raw).toContain('application/json');
        expect(raw).toContain('je veux deux pagnes');
        expect(raw).toContain('Awa');
        expect(r).toEqual({ is_order: true, confidence: 0.88, order_type: 'purchase', summary: 'pagnes' });
    });

    it('honore le modèle demandé', async () => {
        fetchMock.mockResolvedValue(geminiResponse('{"is_order": false}'));
        await classifyOrderIntent('bonjour', 'Awa', 'gemini-2.5-pro');
        expect(lastRequest().url).toContain('/models/gemini-2.5-pro:generateContent');
    });

    it('complète une classification partielle avec les valeurs par défaut', async () => {
        fetchMock.mockResolvedValue(geminiResponse('{"is_order": true}'));
        await expect(classifyOrderIntent('combien', 'Awa'))
            .resolves.toEqual({ ...FALLBACK, is_order: true });
    });

    it('retombe sur le repli quand l\'API refuse, sans lever', async () => {
        fetchMock.mockResolvedValue(geminiError(400, 'API key not valid. Please pass a valid API key.'));
        await expect(classifyOrderIntent('je veux', 'Awa')).resolves.toEqual(FALLBACK);
    });

    it('retombe sur le repli sans clé', async () => {
        settings.delete('gemini_api_key');
        await expect(classifyOrderIntent('je veux', 'Awa')).resolves.toEqual(FALLBACK);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('geminiService.transcribeAudio', () => {
    const OGG = Buffer.from('OggS-pseudo-audio');

    it('envoie l\'audio en base64 avec son type MIME, et lit la transcription', async () => {
        fetchMock.mockResolvedValue(geminiResponse('{"text": "je veux deux pagnes", "language": "fr"}'));

        const r = await transcribeAudio(OGG, 'audio/ogg; codecs=opus', { languageHint: 'français' });

        const { raw } = lastRequest();
        expect(raw).toContain(OGG.toString('base64'));
        expect(raw).toContain('audio/ogg; codecs=opus');
        expect(raw).toContain('français');
        expect(r).toEqual({ text: 'je veux deux pagnes', language: 'fr', model: 'gemini-2.5-flash' });
    });

    it('accepte du base64 avec préfixe data:', async () => {
        fetchMock.mockResolvedValue(geminiResponse('{"text": "ok", "language": "fr"}'));
        await transcribeAudio(`data:audio/ogg;base64,${OGG.toString('base64')}`, 'audio/ogg');
        expect(lastRequest().raw).toContain(OGG.toString('base64'));
    });

    it('rend un texte vide quand l\'audio ne contient pas de parole — ce n\'est pas une erreur', async () => {
        fetchMock.mockResolvedValue(geminiResponse('{"text": "", "language": null}'));
        await expect(transcribeAudio(OGG, 'audio/ogg')).resolves.toMatchObject({ text: '', language: null });
    });

    it('LÈVE sur une réponse inexploitable, au lieu de rendre une transcription vide', async () => {
        // Une transcription vide se confondrait avec un vocal sans parole : le
        // vocal disparaîtrait du flux sans que personne ne le sache.
        fetchMock.mockResolvedValue(geminiResponse('Je ne peux pas transcrire cet audio.'));
        await expect(transcribeAudio(OGG, 'audio/ogg')).rejects.toThrow(/inexploitable/);
    });

    it('LÈVE quand l\'API refuse', async () => {
        fetchMock.mockResolvedValue(geminiError(400, 'Unsupported MIME type'));
        await expect(transcribeAudio(OGG, 'audio/ogg')).rejects.toThrow();
    });

    it('refuse un appel sans audio ou sans type MIME, sans appeler le réseau', async () => {
        await expect(transcribeAudio(null, 'audio/ogg')).rejects.toThrow(/aucun audio/);
        await expect(transcribeAudio(OGG, '')).rejects.toThrow(/mimeType obligatoire/);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
