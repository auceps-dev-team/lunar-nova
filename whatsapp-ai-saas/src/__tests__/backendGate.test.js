// Attente du backend au démarrage (src/services/apiAuth.js).
//
// Mesuré le 26/11/2026 sur la v1.49.0 installée : la fenêtre se charge avant
// que le backend n'écoute, les premières requêtes échouaient en
// ERR_CONNECTION_REFUSED, et la clé de la carte de prospection — demandée une
// seule fois — restait vide pour la session. Ce fichier prouve que les
// requêtes sont retenues jusqu'à la première réponse du backend, puis partent
// avec le jeton, et qu'on ne reste jamais bloqué au-delà du délai.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createBackendGate, initApiAuth } from '../services/apiAuth';

const sansAttente = () => Promise.resolve();
const refus = () => Promise.reject(new TypeError('Failed to fetch'));

describe('createBackendGate', () => {
    it('s\'ouvre à la première réponse, après des connexions refusées', async () => {
        const fetchImpl = vi.fn()
            .mockImplementationOnce(refus)
            .mockImplementationOnce(refus)
            .mockResolvedValue(new Response('{}', { status: 200 }));

        await expect(createBackendGate(fetchImpl, { url: 'http://127.0.0.1:3000/api/health', wait: sansAttente })).resolves.toBe(true);
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('n\'importe quel statut HTTP prouve que le serveur écoute', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
        await expect(createBackendGate(fetchImpl, { url: 'x', wait: sansAttente })).resolves.toBe(true);
    });

    it('renonce au bout du délai au lieu de bloquer indéfiniment', async () => {
        const fetchImpl = vi.fn().mockImplementation(refus);
        await expect(createBackendGate(fetchImpl, { url: 'x', timeoutMs: 0, wait: sansAttente })).resolves.toBe(false);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
});

describe('fetch instrumenté — requête retenue pendant le démarrage', () => {
    afterEach(() => { delete window.electronAPI; });

    it('n\'envoie /api/config qu\'une fois le backend joignable, avec le jeton', async () => {
        let backendPret = false;
        const appels = [];
        window.fetch = vi.fn(async (input, init) => {
            const url = typeof input === 'string' ? input : input.url;
            appels.push({ url, pret: backendPret, auth: new Headers(init?.headers).get('Authorization') });
            if (!backendPret) throw new TypeError('Failed to fetch');
            return new Response('{"googleMapsApiKey":"abc"}', { status: 200 });
        });
        window.electronAPI = { getApiToken: async () => 'jeton-test' };

        await initApiAuth();
        const reponse = window.fetch('http://127.0.0.1:3000/api/config');

        // Le backend « démarre » un peu plus tard.
        await new Promise((r) => setTimeout(r, 250));
        backendPret = true;

        const corps = await (await reponse).json();
        expect(corps.googleMapsApiKey).toBe('abc');

        const config = appels.filter((a) => a.url.endsWith('/api/config'));
        expect(config).toHaveLength(1);
        expect(config[0].pret).toBe(true);
        expect(config[0].auth).toBe('Bearer jeton-test');
        expect(appels.some((a) => a.url.endsWith('/api/health') && !a.pret)).toBe(true);
    });
});
