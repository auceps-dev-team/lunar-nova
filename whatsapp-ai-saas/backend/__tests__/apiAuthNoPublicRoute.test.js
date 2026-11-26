// @vitest-environment node
//
// Retrait de la connexion Google (26/11/2026). Son callback OAuth était la
// seule route accessible sans jeton (PUBLIC_PATHS dans apiAuth.js). Ce fichier
// prouve qu'il n'y a plus d'exception : sans jeton, toute route, l'ancien
// callback compris, reçoit 401 ; avec le jeton, la requête passe.
//
// Convention du projet : require, jamais import (cf. agentFallbackStrategies).
import { describe, it, expect, vi } from 'vitest';

const { requireApiToken, API_TOKEN } = require('../apiAuth');

const requete = (path, authorization = '') => ({ path, query: {}, get: (h) => (h.toLowerCase() === 'authorization' ? authorization : '') });
const reponse = () => {
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; return res; };
    return res;
};

describe('apiAuth — aucune route publique', () => {
    it.each([
        '/api/auth/google/callback',
        '/api/auth/google/status',
        '/api/config'
    ])('%s sans jeton : 401, la requête ne passe pas', (path) => {
        const res = reponse();
        const next = vi.fn();
        requireApiToken(requete(path), res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    it('avec le jeton, la requête passe', () => {
        const res = reponse();
        const next = vi.fn();
        requireApiToken(requete('/api/config', `Bearer ${API_TOKEN}`), res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.statusCode).toBeNull();
    });
});
