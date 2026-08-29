import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import db from '../db';

const {
    getExecutionChannelsStatus,
    executeAgentWithFallback,
    isKeyConfigurationError
} = require('../services/agentFallbackRouter');

describe('agentFallbackRouter — Routage Agentique & Auto-Fallback Résilient', { timeout: 45000 }, () => {
    let server;
    let baseUrl;

    // Les deux tests de cascade ci-dessous appellent les VRAIES API (aucun
    // mock) : leur finalité est de valider le repli en conditions réelles.
    // Ils ne peuvent donc tourner que si une clé Gemini exploitable existe
    // (base locale ou environnement). Sans clé — CI, poste vierge — ils sont
    // ignorés explicitement (même patron que dbMigrations.test.js pour le
    // binding sqlite3) au lieu d'enregistrer un échec fallacieux.
    let geminiApiUsable = false;

    beforeAll(async () => {
        const app = express();
        app.use(express.json());
        const settingsRoutes = require('../routes/settings_and_agents');
        app.use('/api', settingsRoutes);

        await new Promise((resolve) => {
            server = http.createServer(app);
            server.listen(0, '127.0.0.1', () => {
                const port = server.address().port;
                baseUrl = `http://127.0.0.1:${port}`;
                resolve();
            });
        });

        const dbKey = await db.getSetting('gemini_api_key', '');
        geminiApiUsable = Boolean(((dbKey || process.env.GEMINI_API_KEY || '') + '').trim().length > 10);
    });

    afterAll(async () => {
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
    });

    describe('isKeyConfigurationError', () => {
        it('détecte les erreurs de clé manquante ou non configurée', () => {
            expect(isKeyConfigurationError('OpenAI/NVIDIA API key not configured in settings.')).toBe(true);
            expect(isKeyConfigurationError('API key not valid')).toBe(true);
            expect(isKeyConfigurationError('Clé API non configurée.')).toBe(true);
            expect(isKeyConfigurationError('Insufficient credits')).toBe(true);
            expect(isKeyConfigurationError('Unsupported state or unable to authenticate data')).toBe(true);
        });

        it('ne marque pas comme erreur de clé les messages textuels normaux', () => {
            expect(isKeyConfigurationError('Bonjour ! Je suis Jarvis, comment puis-je vous aider ?')).toBe(false);
            expect(isKeyConfigurationError('Voici le devis demandé.')).toBe(false);
            expect(isKeyConfigurationError(null)).toBe(false);
            expect(isKeyConfigurationError('')).toBe(false);
        });
    });

    describe('getExecutionChannelsStatus', () => {
        it('retourne la stratégie, les drapeaux de canaux et la liste des CLI installés', async () => {
            const status = await getExecutionChannelsStatus();
            expect(status).toBeDefined();
            expect(status).toHaveProperty('strategy');
            expect(status).toHaveProperty('autoFallback');
            expect(status).toHaveProperty('channels');
            expect(status.channels).toHaveProperty('geminiApi');
            expect(status.channels).toHaveProperty('geminiCli');
            expect(status.channels).toHaveProperty('claudeCli');
            expect(Array.isArray(status.installedClis)).toBe(true);
        }, 45000);
    });

    describe('executeAgentWithFallback — Cascade de résilience', () => {
        it.runIf(geminiApiUsable)('secourt automatiquement un appel OpenAI/NVIDIA sans clé via Gemini', async () => {
            const result = await executeAgentWithFallback({
                personaId: 'copywriter',
                message: 'Test message fallback',
                providerOverride: 'openai',
                modelOverride: 'meta/llama-4-maverick-17b-instruct'
            });

            expect(result).toBeDefined();
            expect(typeof result.response).toBe('string');
            expect(result.response.length).toBeGreaterThan(0);
            // La réponse ne doit PAS être le message d'erreur bloquant
            expect(result.response).not.toContain('OpenAI/NVIDIA API key not configured in settings.');
        }, 45000);

        it.runIf(geminiApiUsable)('fonctionne pour un appel direct standard Gemini', async () => {
            const result = await executeAgentWithFallback({
                personaId: 'copilot',
                message: 'Hello Copilot',
                providerOverride: 'gemini'
            });

            expect(result).toBeDefined();
            expect(typeof result.response).toBe('string');
            expect(result.response.length).toBeGreaterThan(0);
        }, 45000);
    });

    describe('GET /api/settings/channels-status (Route REST)', () => {
        it('renvoie le statut 200 et les détails des canaux', async () => {
            const res = await fetch(`${baseUrl}/api/settings/channels-status`);
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.status).toBe('success');
            expect(body.data).toHaveProperty('strategy');
            expect(body.data).toHaveProperty('channels');
        }, 45000);
    });
});
