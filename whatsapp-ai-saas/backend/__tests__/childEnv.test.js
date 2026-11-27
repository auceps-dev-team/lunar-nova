// S4 (docs/audit.md) : un binaire lancé par le backend ne reçoit que les
// variables d'une liste fermée, plus celles que l'appelant passe
// explicitement — jamais tout process.env, qui contient en production la clé
// maître des secrets.
import { describe, it, expect, afterEach } from 'vitest';
import { buildChildEnv, pickProcessEnv, executeExternalCli } from '../services/externalAgentRunner';
import { buildWhisperEnv } from '../services/transcriptionService';

const FAKE_MASTER_KEY = 'a'.repeat(64);
const touched = new Map();

function setEnv(key, value) {
    if (!touched.has(key)) touched.set(key, process.env[key]);
    process.env[key] = value;
}

afterEach(() => {
    for (const [key, previous] of touched) {
        if (previous === undefined) delete process.env[key];
        else process.env[key] = previous;
    }
    touched.clear();
});

const hasKey = (env, name) => Object.keys(env).some((k) => k.toUpperCase() === name);

describe('buildChildEnv — environnement des processus lancés', () => {
    it('garde les variables système et retire la clé maître et NODE_OPTIONS', () => {
        setEnv('WACOPILOTE_MASTER_KEY', FAKE_MASTER_KEY);
        setEnv('NODE_OPTIONS', '--require ./piège.js');
        setEnv('OPENROUTER_API_KEY', 'sk-or-secret');

        const env = buildChildEnv('claude');

        expect(hasKey(env, 'PATH')).toBe(true);
        expect(env.WACOPILOTE_MASTER_KEY).toBeUndefined();
        expect(env.NODE_OPTIONS).toBeUndefined();
        expect(env.OPENROUTER_API_KEY).toBeUndefined();
    });

    it('ne transmet les identifiants d\'un fournisseur qu\'à son propre CLI', () => {
        setEnv('ANTHROPIC_API_KEY', 'sk-ant-secret');
        setEnv('GEMINI_API_KEY', 'AIza-secret');

        const claudeEnv = buildChildEnv('claude');
        expect(claudeEnv.ANTHROPIC_API_KEY).toBe('sk-ant-secret');
        expect(claudeEnv.GEMINI_API_KEY).toBeUndefined();

        const geminiEnv = buildChildEnv('gemini');
        expect(geminiEnv.GEMINI_API_KEY).toBe('AIza-secret');
        expect(geminiEnv.ANTHROPIC_API_KEY).toBeUndefined();
    });

    it('ajoute les variables passées explicitement par l\'appelant', () => {
        const env = buildChildEnv('gemini', { GEMINI_CLI_TRUST_WORKSPACE: 'true' });
        expect(env.GEMINI_CLI_TRUST_WORKSPACE).toBe('true');
    });

    it('pickProcessEnv n\'extrait que les variables nommées et présentes', () => {
        setEnv('USER_DATA_PATH', '/tmp/wacopilote-test');
        setEnv('WACOPILOTE_MASTER_KEY', FAKE_MASTER_KEY);

        expect(pickProcessEnv(['USER_DATA_PATH', 'VARIABLE_ABSENTE_XYZ'])).toEqual({
            USER_DATA_PATH: '/tmp/wacopilote-test'
        });
    });
});

describe('buildWhisperEnv — environnement de la transcription locale (Python)', () => {
    it('transmet les variables Python et Whisper, jamais la clé maître ni les clés d\'API', () => {
        setEnv('WACOPILOTE_MASTER_KEY', FAKE_MASTER_KEY);
        setEnv('GEMINI_API_KEY', 'AIza-secret');
        setEnv('VIRTUAL_ENV', '/opt/whisper-venv');
        setEnv('HF_HOME', '/opt/hf-cache');
        setEnv('WHISPER_DEVICE', 'cpu');

        const env = buildWhisperEnv('small', 'FR');

        expect(env.WHISPER_MODEL).toBe('small');
        expect(env.WHISPER_LANGUAGE).toBe('fr');
        expect(env.VIRTUAL_ENV).toBe('/opt/whisper-venv');
        expect(env.HF_HOME).toBe('/opt/hf-cache');
        expect(env.WHISPER_DEVICE).toBe('cpu');
        expect(hasKey(env, 'PATH')).toBe(true);
        expect(env.WACOPILOTE_MASTER_KEY).toBeUndefined();
        expect(env.GEMINI_API_KEY).toBeUndefined();
    });

    it('retombe sur la détection automatique pour une langue mal formée', () => {
        expect(buildWhisperEnv('small', 'français').WHISPER_LANGUAGE).toBe('auto');
        expect(buildWhisperEnv('small', undefined).WHISPER_LANGUAGE).toBe('auto');
    });
});

describe('executeExternalCli — environnement réellement reçu par le processus', { timeout: 15000 }, () => {
    it('le processus lancé ne voit pas la clé maître mais voit les variables explicites', async () => {
        setEnv('WACOPILOTE_MASTER_KEY', FAKE_MASTER_KEY);

        const result = await executeExternalCli({
            command: 'node',
            args: ['-e', 'console.log(JSON.stringify(Object.keys(process.env)))'],
            env: { WACOPILOTE_TEST_EXTRA: '1' },
            timeout: 5000,
            skipAllowanceCheck: true
        });

        expect(result.success).toBe(true);
        const keys = JSON.parse(result.stdout.trim()).map((k) => k.toUpperCase());
        expect(keys).not.toContain('WACOPILOTE_MASTER_KEY');
        expect(keys).toContain('WACOPILOTE_TEST_EXTRA');
        expect(keys).toContain('PATH');
    });
});
