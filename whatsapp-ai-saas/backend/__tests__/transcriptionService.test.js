import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
    transcribe,
    registerEngine,
    listEngines,
    __setSettingReaderForTests,
    toUnpackedPath,
    MAX_AUDIO_BYTES
} from '../services/transcriptionService';

// Les réglages sont servis par une table locale plutôt que par la base.
//
// Mesuré le 19 septembre 2026 : sous Vitest, un test qui fait
// `import db from '../db'` et un service qui fait `require('../db')` ne
// partagent pas la même instance — un réglage écrit par le test est invisible
// au service (relevé : « sonde » côté test, « (ABSENT) » côté service), et
// `vi.mock('../db')` n'intercepte pas ce require non plus. La couture
// `__setSettingReaderForTests` contourne le problème et rend ces tests
// indépendants de toute base : aucun fichier touché, aucun ordre imposé.
const settings = new Map();

__setSettingReaderForTests(async (key, def = null) =>
    (settings.has(key) ? settings.get(key) : def));

afterAll(() => { __setSettingReaderForTests(null); });

const OGG = Buffer.from('OggS\u0000\u0002pseudo-audio pour les tests');

function fakeEngine(reply) {
    return vi.fn(async () => (typeof reply === 'function' ? reply() : reply));
}

describe('transcriptionService — notes vocales', () => {
    beforeEach(() => {
        settings.clear();
    });

    describe('validation de l\'entrée', () => {
        it('refuse un audio vide', async () => {
            await expect(transcribe({ audio: Buffer.alloc(0), mimeType: 'audio/ogg' }))
                .rejects.toThrow(/audio vide/i);
        });

        it('refuse un type MIME non audio', async () => {
            await expect(transcribe({ audio: OGG, mimeType: 'image/png' }))
                .rejects.toThrow(/non audio/i);
        });

        it('refuse un type MIME absent', async () => {
            await expect(transcribe({ audio: OGG }))
                .rejects.toThrow(/non audio/i);
        });

        it('refuse un audio au-delà de la limite', async () => {
            const trop = Buffer.alloc(MAX_AUDIO_BYTES + 1, 1);
            await expect(transcribe({ audio: trop, mimeType: 'audio/ogg' }))
                .rejects.toThrow(/au-delà de la limite/i);
        });

        it('refuse un type d\'entrée inattendu', async () => {
            await expect(transcribe({ audio: 42, mimeType: 'audio/ogg' }))
                .rejects.toThrow(/Buffer.*Uint8Array.*base64/i);
        });

        it('accepte du base64, avec ou sans préfixe data:', async () => {
            registerEngine('essai-b64', fakeEngine({ text: 'bonjour', language: 'fr' }));

            const brut = await transcribe({
                audio: OGG.toString('base64'), mimeType: 'audio/ogg', engine: 'essai-b64'
            });
            const prefixe = await transcribe({
                audio: `data:audio/ogg;base64,${OGG.toString('base64')}`,
                mimeType: 'audio/ogg', engine: 'essai-b64'
            });

            expect(brut.bytes).toBe(OGG.length);
            expect(prefixe.bytes).toBe(OGG.length);
        });

        it('accepte un Uint8Array', async () => {
            registerEngine('essai-u8', fakeEngine({ text: 'ok', language: 'fr' }));
            const res = await transcribe({
                audio: new Uint8Array(OGG), mimeType: 'audio/ogg', engine: 'essai-u8'
            });
            expect(res.bytes).toBe(OGG.length);
        });
    });

    describe('choix du moteur', () => {
        it('lève un message qui nomme les moteurs disponibles quand le moteur est inconnu', async () => {
            await expect(transcribe({ audio: OGG, mimeType: 'audio/ogg', engine: 'inexistant' }))
                .rejects.toThrow(/moteur « inexistant » inconnu.*Disponibles/is);
        });

        it('retombe sur gemini quand aucun moteur n\'est configuré', async () => {
            // Aucun réglage, aucune clé d'API : l'échec vient de getGeminiClient,
            // ce qui prouve que c'est bien le moteur gemini qui a été choisi.
            await expect(transcribe({ audio: OGG, mimeType: 'audio/ogg' }))
                .rejects.toThrow(/API key/i);
        });

        it('honore le réglage transcription_engine', async () => {
            const moteur = fakeEngine({ text: 'depuis le réglage', language: 'fr' });
            registerEngine('essai-reglage', moteur);
            settings.set('transcription_engine', 'essai-reglage');

            const res = await transcribe({ audio: OGG, mimeType: 'audio/ogg' });

            expect(moteur).toHaveBeenCalledOnce();
            expect(res.engine).toBe('essai-reglage');
            expect(res.text).toBe('depuis le réglage');
        });

        it('le paramètre engine prime sur le réglage', async () => {
            registerEngine('essai-regle', fakeEngine({ text: 'réglage' }));
            registerEngine('essai-force', fakeEngine({ text: 'forcé' }));
            settings.set('transcription_engine', 'essai-regle');

            const res = await transcribe({ audio: OGG, mimeType: 'audio/ogg', engine: 'essai-force' });

            expect(res.engine).toBe('essai-force');
            expect(res.text).toBe('forcé');
        });

        it('listEngines expose gemini', () => {
            expect(listEngines()).toContain('gemini');
        });

        it('registerEngine refuse un nom ou une fonction invalides', () => {
            expect(() => registerEngine('', () => {})).toThrow(/nom invalide/i);
            expect(() => registerEngine('x', 'pas une fonction')).toThrow(/fonction attendue/i);
        });
    });

    describe('« rien entendu » n\'est pas « échec »', () => {
        it('un vocal sans parole renvoie empty:true, sans lever', async () => {
            registerEngine('essai-muet', fakeEngine({ text: '', language: null }));

            const res = await transcribe({ audio: OGG, mimeType: 'audio/ogg', engine: 'essai-muet' });

            expect(res.empty).toBe(true);
            expect(res.text).toBe('');
            expect(res.language).toBeNull();
        });

        it('une transcription blanche compte comme vide', async () => {
            registerEngine('essai-blanc', fakeEngine({ text: '   \n  ', language: 'fr' }));
            const res = await transcribe({ audio: OGG, mimeType: 'audio/ogg', engine: 'essai-blanc' });
            expect(res.empty).toBe(true);
            expect(res.text).toBe('');
        });

        it('un échec du moteur se propage — il ne devient pas une transcription vide', async () => {
            registerEngine('essai-casse', () => { throw new Error('quota dépassé'); });

            await expect(transcribe({ audio: OGG, mimeType: 'audio/ogg', engine: 'essai-casse' }))
                .rejects.toThrow(/quota dépassé/);
        });
    });

    describe('forme du résultat', () => {
        it('renvoie texte, langue, moteur, modèle, taille et durée', async () => {
            registerEngine('essai-complet', fakeEngine({
                text: 'deux pagnes wax taille M', language: 'fr', model: 'modele-test'
            }));

            const res = await transcribe({
                audio: OGG, mimeType: 'audio/ogg; codecs=opus',
                engine: 'essai-complet', languageHint: 'fr'
            });

            expect(res).toMatchObject({
                text: 'deux pagnes wax taille M',
                language: 'fr',
                engine: 'essai-complet',
                model: 'modele-test',
                empty: false,
                bytes: OGG.length
            });
            expect(res.durationMs).toBeGreaterThanOrEqual(0);
        });

        it('transmet languageHint et model au moteur', async () => {
            const moteur = fakeEngine({ text: 'ok' });
            registerEngine('essai-args', moteur);

            await transcribe({
                audio: OGG, mimeType: 'audio/ogg',
                engine: 'essai-args', languageHint: 'fr', model: 'gemini-2.5-flash'
            });

            expect(moteur).toHaveBeenCalledWith(
                expect.any(Buffer),
                'audio/ogg',
                expect.objectContaining({ languageHint: 'fr', model: 'gemini-2.5-flash' })
            );
        });
    });

    describe('moteur local whisper-local', () => {
        it('est enregistré', () => {
            expect(listEngines()).toContain('whisper-local');
        });

        it('redirige le script hors de app.asar en build packagé — Python ne lit pas dans l\'archive', () => {
            expect(toUnpackedPath('C:\\Program Files\\WaCopilote\\resources\\app.asar\\backend\\scripts\\whisperTranscribe.py'))
                .toBe('C:\\Program Files\\WaCopilote\\resources\\app.asar.unpacked\\backend\\scripts\\whisperTranscribe.py');
            expect(toUnpackedPath('/opt/WaCopilote/resources/app.asar/backend/scripts/whisperTranscribe.py'))
                .toBe('/opt/WaCopilote/resources/app.asar.unpacked/backend/scripts/whisperTranscribe.py');
        });

        it('laisse intact un chemin de développement', () => {
            const dev = 'C:\\projets\\whatsapp-ai-saas\\backend\\scripts\\whisperTranscribe.py';
            expect(toUnpackedPath(dev)).toBe(dev);
        });

        it('ne double pas le suffixe sur un chemin déjà désarchivé', () => {
            const deja = 'C:\\WaCopilote\\resources\\app.asar.unpacked\\backend\\scripts\\x.py';
            expect(toUnpackedPath(deja)).toBe(deja);
        });

        it('refuse un modèle hors de la liste fermée — un réglage ne désigne ni chemin ni dépôt', async () => {
            settings.set('transcription_whisper_model', 'C:\\\\outils\\\\modele-piege');
            await expect(transcribe({ audio: OGG, mimeType: 'audio/ogg', engine: 'whisper-local' }))
                .rejects.toThrow(/non pris en charge.*Disponibles/s);
        });

        it('nomme l\'interpréteur quand il est introuvable, au lieu d\'échouer en silence', async () => {
            vi.stubEnv('WACOPILOTE_WHISPER_PYTHON', 'python-inexistant-wacopilote-test');
            try {
                await expect(transcribe({ audio: OGG, mimeType: 'audio/ogg', engine: 'whisper-local' }))
                    .rejects.toThrow(/python-inexistant-wacopilote-test.*introuvable/);
            } finally {
                vi.unstubAllEnvs();
            }
        });

        it('ne lit pas l\'interpréteur depuis les réglages', async () => {
            // Les réglages s'écrivent par l'API : ils ne doivent jamais pouvoir
            // désigner un exécutable. Seule la variable d'environnement compte.
            settings.set('transcription_python', 'python-inexistant-depuis-reglage');
            vi.stubEnv('WACOPILOTE_WHISPER_PYTHON', 'python-inexistant-depuis-env');
            try {
                await expect(transcribe({ audio: OGG, mimeType: 'audio/ogg', engine: 'whisper-local' }))
                    .rejects.toThrow(/python-inexistant-depuis-env/);
            } finally {
                vi.unstubAllEnvs();
            }
        });
    });

    describe('confidentialité des journaux', () => {
        it('ne journalise jamais le texte transcrit en clair', async () => {
            const secret = 'commande de trois pagnes pour Aminata au 0707070707';
            registerEngine('essai-journal', fakeEngine({ text: secret, language: 'fr' }));

            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            await transcribe({ audio: OGG, mimeType: 'audio/ogg', engine: 'essai-journal' });
            const journal = spy.mock.calls.flat().join(' ');
            spy.mockRestore();

            expect(journal).not.toContain(secret);
            expect(journal).not.toContain('Aminata');
            expect(journal).not.toContain('0707070707');
            // La trace reste utile : moteur, taille, durée.
            expect(journal).toMatch(/Transcription/);
            expect(journal).toMatch(/essai-journal/);
        });
    });
});
