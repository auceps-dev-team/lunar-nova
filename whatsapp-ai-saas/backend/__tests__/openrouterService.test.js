// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Neutralise l'accès DB (binding natif sqlite3 absent sous Vitest) et le
// setTimeout(syncOpenRouterModels) déclenché au chargement du module.
vi.mock('../db.js', () => ({
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    getAgent: vi.fn(async () => null),
    initDB: vi.fn(async () => {}),
    ensureReady: vi.fn(async () => {}),
    logCopilotInteraction: vi.fn(async () => {}),
    pool: {}
}));

import * as openrouter from '../openrouterService.js';

// fetch est utilisé directement par generateProposals (et par le timer de sync).
const mockFetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
        choices: [{ message: { content: '{"proposed_replies": ["Bonjour", "Salut"]}' } }]
    })
}));

beforeAll(() => { vi.stubGlobal('fetch', mockFetch); });
afterAll(() => { vi.unstubAllGlobals(); });

describe('openrouterService.generateProposals', () => {
    it('appelle OpenRouter avec la clé et le modèle par défaut, et parse proposed_replies', async () => {
        const res = await openrouter.generateProposals(
            { contactName: 'Jean', messages: [{ time: '10:00', sender: 'Jean', text: 'Bonjour' }] },
            null,
            'sk-test'
        );

        expect(res.proposed_replies).toEqual(['Bonjour', 'Salut']);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        const [url, opts] = mockFetch.mock.calls[0];
        expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
        expect(opts.method).toBe('POST');
        expect(opts.headers.Authorization).toBe('Bearer sk-test');
        expect(opts.headers['HTTP-Referer']).toBe('http://localhost:3000');
        expect(opts.headers['X-Title']).toBe('WaCopilote');

        const body = JSON.parse(opts.body);
        expect(body.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('respecte un modèle overridé via modelParam', async () => {
        mockFetch.mockClear();
        await openrouter.generateProposals(
            { contactName: 'A', messages: [{ time: '1', sender: 'A', text: 'b' }] },
            'openai/gpt-4o',
            'sk-test'
        );
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.model).toBe('openai/gpt-4o');
    });

    it('renvoie une erreur si la clé API est absente', async () => {
        const res = await openrouter.generateProposals(
            { contactName: 'X', messages: [{ time: '1', sender: 'a', text: 'b' }] },
            null,
            ''
        );
        expect(res.proposed_replies[0]).toMatch(/API key not configured/);
    });

    it('renvoie un tableau vide si aucun message', async () => {
        const res = await openrouter.generateProposals(
            { contactName: 'X', messages: [] },
            null,
            'sk'
        );
        expect(res.proposed_replies).toEqual([]);
    });

    it('tolère une réponse JSON mal formée (fallback)', async () => {
        mockFetch.mockImplementationOnce(async () => ({
            ok: true,
            json: async () => ({ choices: [{ message: { content: 'pas du json' } }] })
        }));
        const res = await openrouter.generateProposals(
            { contactName: 'X', messages: [{ time: '1', sender: 'a', text: 'b' }] },
            null,
            'sk'
        );
        expect(res.proposed_replies[0]).toMatch(/parsing JSON/i);
    });
});
