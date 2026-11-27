// @vitest-environment node
//
// @google/genai 3 (27/11/2026) appelle par défaut l'API `v1` ; la 1.x appelait
// `v1beta`, d'où vient aussi la liste de modèles proposée à l'utilisateur.
// creerClientGemini fixe `v1beta`. Aucun appel réseau : fetch est intercepté
// et l'adresse demandée par le SDK est relevée.
import { describe, it, expect, afterEach } from 'vitest';

const { GoogleGenAI } = require('@google/genai');
const { creerClientGemini } = require('../geminiService');

const fetchAvant = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchAvant; });

async function adresseAppelee(client) {
    let url = null;
    globalThis.fetch = async (cible) => {
        url = String(cible instanceof Request ? cible.url : cible);
        return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] } }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    const r = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: 'bonjour' });
    return { url, texte: r.text };
}

describe('client Gemini — version d\'API', () => {
    it('creerClientGemini appelle v1beta, comme la liste de modèles', async () => {
        const { url, texte } = await adresseAppelee(creerClientGemini('cle-de-test-0123456789'));
        expect(url).toMatch(/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent/);
        expect(texte).toBe('ok');
    });

    it('témoin : sans réglage, le SDK installé appelle v1 (la raison de ce réglage)', async () => {
        const { url } = await adresseAppelee(new GoogleGenAI({ apiKey: 'cle-de-test-0123456789' }));
        expect(url).toMatch(/googleapis\.com\/v1\/models\//);
    });
});
