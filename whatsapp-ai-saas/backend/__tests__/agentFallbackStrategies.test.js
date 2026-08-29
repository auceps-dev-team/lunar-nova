// Tests comportementaux des STRATÉGIES du routeur agentique (plan v1.47, T2-T5).
//
// Distincte de agentFallback.test.js : celle-ci valide la cascade en conditions
// réelles (gated sur clé Gemini) ; celle-ci valide la MÉCANIQUE de sélection —
// stratégie CLI, repli binaire inexistant, respect de la stratégie imposée et
// canal MCP — avec des substitutions déterministes (aucune clé, aucun réseau).
//
// Convention du projet (cf. contactAgent.test.js, nvidiaModels.test.js) :
// PAS de vi.mock — les modules CommonJS du backend, inlinés par Vite, ne
// coopèrent pas avec le mock statique de Vitest. On substitue donc les
// fonctions par namespace à chaud (le routeur y accède via
// `externalAgentRunner.executeExternalCli` / `geminiService.chatWithAgent`,
// jamais déstructuré) et on restaure après chaque test.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
// IMPORTANT : ne PAS importer db via `import` ESM — le backend CommonJS
// inliné par Vite et l'import ESM du test donneraient DEUX instances du
// module (constaté : la stratégie écrite n'était pas vue par le routeur).
// Tout passe par require(), comme le font les modules testés.
const db = require('../db');

const externalAgentRunner = require('../services/externalAgentRunner');
const geminiService = require('../geminiService');
const { executeAgentWithFallback } = require('../services/agentFallbackRouter');

describe('agentFallbackRouter — stratégies d\'exécution (T2-T5, substitutions)', () => {
    // Exécuteur CLI : espion par défaut (les tests qui déclenchent le CLI
    // le remplacent par leur propre réponse).
    const defaultCliExecutor = vi.fn(async () => ({
        success: false, exitCode: null, stdout: '', stderr: '', executionTimeMs: 1,
        error: 'executeExternalCli non substitué pour ce test'
    }));

    beforeAll(async () => {
        // Base en mémoire : aucun réglage de test ne fuit dans la base du projet.
        db.__setDbFileForTests(':memory:');
        await db.initDB();
        await db.setSetting('default_ai_provider', 'gemini');
        // CLIs « installés » de façon déterministe (détection système substituée).
        externalAgentRunner.detectInstalledClis = vi.fn(async () => [
            { command: 'gemini', installed: true, version: '0.57.0-mock' },
            { command: 'claude', installed: true, version: '2.1.250-mock' }
        ]);
        // API Gemini : réponse déterministe, aucun appel réseau.
        geminiService.chatWithAgent = vi.fn(async () => ({ response: 'Réponse API Gemini (mock)' }));
        externalAgentRunner.executeExternalCli = defaultCliExecutor;
    });

    afterEach(() => {
        // Repose l'espion par défaut (les substitutions par test sont
        // ponctuelles ; detectInstalledClis et chatWithAgent restent actives
        // pour tout le fichier : déterministes).
        externalAgentRunner.executeExternalCli = defaultCliExecutor;
        defaultCliExecutor.mockClear();
        geminiService.chatWithAgent.mockClear();
    });

    it('T2 — stratégie « cli » + gemini exécute via le binaire local', async () => {
        externalAgentRunner.executeExternalCli = vi.fn(async () => ({
            success: true, exitCode: 0,
            stdout: 'Réponse CLI Gemini (mock)', stderr: '', executionTimeMs: 5
        }));
        await db.setSetting('ai_execution_strategy', 'cli');
        await db.setSetting('default_cli_agent', 'gemini');
        await db.setSetting('auto_fallback_enabled', 'false');

        const result = await executeAgentWithFallback({ personaId: 'copywriter', message: 'Bonjour' });

        expect(result.response).toBe('Réponse CLI Gemini (mock)');
        expect(externalAgentRunner.executeExternalCli).toHaveBeenCalledTimes(1);
        expect(externalAgentRunner.executeExternalCli.mock.calls[0][0].command).toBe('gemini');
        expect(geminiService.chatWithAgent).not.toHaveBeenCalled();
    });

    it('T3 — CLI inexistant bascule automatiquement sur l\'API Gemini', async () => {
        externalAgentRunner.executeExternalCli = vi.fn(async () => ({
            success: false, exitCode: null,
            stdout: '', stderr: '', executionTimeMs: 5,
            error: 'La commande CLI \'binaire-inexistant\' n\'est pas autorisée par la politique de sécurité WaCopilote.'
        }));
        await db.setSetting('ai_execution_strategy', 'cli');
        await db.setSetting('default_cli_agent', 'binaire-inexistant');
        await db.setSetting('auto_fallback_enabled', 'true');
        // Clé factice : active le canal geminiApi pour le repli (pas d'appel
        // réseau réel — chatWithAgent est substitué).
        await db.setSetting('gemini_api_key', 'AIzaMockKey1234567890');

        const result = await executeAgentWithFallback({ personaId: 'copilot', message: 'Bonjour' });

        expect(result.response).toBe('Réponse API Gemini (mock)');
        expect(externalAgentRunner.executeExternalCli).toHaveBeenCalled();
        expect(geminiService.chatWithAgent).toHaveBeenCalledTimes(1);
    });

    it('T4 — la stratégie « api » imposée ne délègue jamais au CLI disponible', async () => {
        externalAgentRunner.executeExternalCli = vi.fn(async () => ({
            success: true, exitCode: 0, stdout: 'NE DOIT PAS ÊTRE APPELÉ', stderr: '', executionTimeMs: 1
        }));
        await db.setSetting('ai_execution_strategy', 'api');
        await db.setSetting('auto_fallback_enabled', 'false');

        // gemini-cli et claude-cli sont « installés » (détection substituée) :
        // la stratégie api ne doit pas les solliciter.
        const result = await executeAgentWithFallback({ personaId: 'copywriter', message: 'Bonjour' });

        expect(result.response).toBe('Réponse API Gemini (mock)');
        expect(externalAgentRunner.executeExternalCli).not.toHaveBeenCalled();
    });

    it('T5 — la stratégie « mcp » passe par le tool call_agent du serveur MCP', async () => {
        await db.setSetting('ai_execution_strategy', 'mcp');
        await db.setSetting('auto_fallback_enabled', 'false');

        // call_agent rappelle chatWithAgent → routeur : la garde de réentrance
        // doit exécuter directement le fournisseur par défaut (gemini,
        // substitué) au lieu de reboucler sur le canal MCP.
        const result = await executeAgentWithFallback({ personaId: 'copywriter', message: 'Bonjour' });

        expect(result.response).toBe('Réponse API Gemini (mock)');
        expect(geminiService.chatWithAgent).toHaveBeenCalledTimes(1);
        expect(externalAgentRunner.executeExternalCli).not.toHaveBeenCalled();
    });
});
