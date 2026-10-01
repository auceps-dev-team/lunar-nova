import { describe, it, expect, vi } from 'vitest';
import { createVoiceNoteQueue } from '../services/voiceNoteQueue';

// Toutes les dépendances sont injectées : aucun navigateur, aucun moteur de
// transcription, aucune base. Ces tests portent sur ce que la file garantit —
// ordre, unicité, bornes, et surtout qu'un vocal ne disparaît jamais sans
// laisser de trace.

const AUDIO = Buffer.from('OggS-pseudo-audio');

function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

function makeQueue(overrides = {}) {
    const logs = [];
    const deps = {
        isEnabled: vi.fn(async () => true),
        extract: vi.fn(async () => ({ audio: AUDIO, mimeType: 'audio/ogg; codecs=opus', durationSec: 10 })),
        transcribe: vi.fn(async () => ({ text: 'je veux deux pagnes', empty: false, engine: 'essai' })),
        onTranscribed: vi.fn(async () => {}),
        log: (m) => logs.push(m),
        ...overrides
    };
    return { queue: createVoiceNoteQueue(deps), deps, logs };
}

const job = (messageId, extra = {}) => ({ instanceId: 'wa-1', contact: 'Aminata Koné', messageId, ...extra });

describe('voiceNoteQueue — construction', () => {
    it('refuse une dépendance manquante', () => {
        expect(() => createVoiceNoteQueue({})).toThrow(/doit être une fonction/);
        expect(() => createVoiceNoteQueue({
            extract: () => {}, transcribe: () => {}, isEnabled: () => true
        })).toThrow(/onTranscribed/);
    });
});

describe('voiceNoteQueue — désactivée par défaut', () => {
    it('refuse tout vocal quand le réglage est éteint, sans extraire ni transcrire', async () => {
        const { queue, deps } = makeQueue({ isEnabled: vi.fn(async () => false) });

        const res = await queue.submit(job('A'));

        expect(res).toMatchObject({ accepted: false, reason: 'DESACTIVE' });
        expect(deps.extract).not.toHaveBeenCalled();
        expect(deps.transcribe).not.toHaveBeenCalled();
    });

    it('ne signale la désactivation qu\'une fois, pas à chaque vocal', async () => {
        const { queue, logs } = makeQueue({ isEnabled: vi.fn(async () => false) });

        await queue.submit(job('A'));
        await queue.submit(job('B'));
        await queue.submit(job('C'));

        expect(logs.filter((l) => /désactivée/.test(l))).toHaveLength(1);
    });

    it('traite une erreur du réglage comme « désactivé », sans lever', async () => {
        const { queue } = makeQueue({ isEnabled: vi.fn(async () => { throw new Error('base fermée'); }) });
        await expect(queue.submit(job('A'))).resolves.toMatchObject({ reason: 'DESACTIVE' });
    });
});

describe('voiceNoteQueue — prise en charge', () => {
    it('extrait, transcrit, puis réinjecte le texte avec son contexte', async () => {
        const { queue, deps } = makeQueue();

        const res = await queue.submit(job('A'));
        await queue.idle();

        expect(res).toEqual({ accepted: true });
        expect(deps.extract).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'A', instanceId: 'wa-1' }));
        expect(deps.transcribe).toHaveBeenCalledWith({ audio: AUDIO, mimeType: 'audio/ogg; codecs=opus' });
        expect(deps.onTranscribed).toHaveBeenCalledWith(
            expect.objectContaining({ instanceId: 'wa-1', contact: 'Aminata Koné', messageId: 'A' }),
            expect.objectContaining({ text: 'je veux deux pagnes' })
        );
        expect(queue.stats()).toMatchObject({ extraits: 1, transcrits: 1, vides: 0 });
    });

    it('refuse un vocal sans identifiant de message', async () => {
        const { queue, deps } = makeQueue();
        await expect(queue.submit({ instanceId: 'wa-1', contact: 'X' }))
            .resolves.toMatchObject({ accepted: false, reason: 'SANS_IDENTIFIANT' });
        expect(deps.extract).not.toHaveBeenCalled();
    });

    it('ne prend en charge qu\'une fois un vocal signalé plusieurs fois', async () => {
        // L'observateur peut voir la même ligne plusieurs fois pendant qu'elle
        // se rend : une seule transcription doit en résulter.
        const { queue, deps } = makeQueue();

        const [a, b] = await Promise.all([queue.submit(job('A')), queue.submit(job('A'))]);
        await queue.idle();

        expect([a.accepted, b.accepted].sort()).toEqual([false, true]);
        expect(deps.transcribe).toHaveBeenCalledOnce();
    });

    it('distingue le même identifiant sur deux instances différentes', async () => {
        const { queue, deps } = makeQueue();
        await queue.submit(job('A', { instanceId: 'wa-1' }));
        await queue.submit(job('A', { instanceId: 'wa-2' }));
        await queue.idle();
        expect(deps.transcribe).toHaveBeenCalledTimes(2);
    });
});

describe('voiceNoteQueue — « rien entendu » et « échec » sont deux issues distinctes', () => {
    it('un vocal sans parole n\'est pas réinjecté comme message vide', async () => {
        const { queue, deps } = makeQueue({
            transcribe: vi.fn(async () => ({ text: '', empty: true, engine: 'essai' }))
        });

        await queue.submit(job('A'));
        await queue.idle();

        expect(deps.onTranscribed).not.toHaveBeenCalled();
        expect(queue.stats()).toMatchObject({ vides: 1, transcrits: 0, echecsTranscription: 0 });
    });

    it('un échec d\'extraction est refusé avec sa cause, et compté', async () => {
        const { queue, deps, logs } = makeQueue({
            extract: vi.fn(async () => { throw new Error('Le média n\'a pas été déchiffré dans le délai imparti.'); })
        });

        const res = await queue.submit(job('A'));

        expect(res).toMatchObject({ accepted: false, reason: 'EXTRACTION_ECHOUEE' });
        expect(res.message).toMatch(/délai imparti/);
        expect(deps.transcribe).not.toHaveBeenCalled();
        expect(queue.stats().echecsExtraction).toBe(1);
        expect(logs.some((l) => /Extraction impossible/.test(l))).toBe(true);
    });

    it('un échec de transcription est journalisé, et n\'arrête pas la file', async () => {
        let appel = 0;
        const { queue, deps, logs } = makeQueue({
            transcribe: vi.fn(async () => {
                appel++;
                if (appel === 1) throw new Error('quota dépassé');
                return { text: 'combien le pagne', empty: false, engine: 'essai' };
            })
        });

        await queue.submit(job('A'));
        await queue.submit(job('B'));
        await queue.idle();

        expect(deps.transcribe).toHaveBeenCalledTimes(2);
        expect(deps.onTranscribed).toHaveBeenCalledOnce();
        expect(queue.stats()).toMatchObject({ echecsTranscription: 1, transcrits: 1 });
        expect(logs.some((l) => /Échec de transcription.*quota dépassé/.test(l))).toBe(true);
    });

    it('un échec après la transcription n\'est pas déclaré « échec de transcription »', async () => {
        // La transcription a réussi ; c'est la réinjection qui casse. Le
        // confondre enverrait chercher le défaut dans le mauvais module.
        const { queue, logs } = makeQueue({ onTranscribed: vi.fn(async () => { throw new Error('pipeline indisponible'); }) });
        await queue.submit(job('A'));
        await queue.idle();

        expect(queue.stats()).toMatchObject({ transcrits: 1, echecsTranscription: 0, echecsReinjection: 1 });
        expect(logs.some((l) => /transcrit mais non traité.*pipeline indisponible/.test(l))).toBe(true);
        expect(logs.some((l) => /Échec de transcription/.test(l))).toBe(false);
    });
});

describe('voiceNoteQueue — ordre et charge', () => {
    it('transcrit un vocal à la fois, dans l\'ordre d\'arrivée', async () => {
        // Le calcul est lié au processeur : deux transcriptions simultanées
        // ne vont pas plus vite, elles se ralentissent mutuellement.
        let enCours = 0;
        let pic = 0;
        const ordre = [];
        const { queue } = makeQueue({
            transcribe: vi.fn(async ({ audio }) => {
                enCours++;
                pic = Math.max(pic, enCours);
                await new Promise((r) => setTimeout(r, 5));
                enCours--;
                return { text: `texte ${audio.toString()}`, empty: false };
            }),
            extract: vi.fn(async (j) => ({ audio: Buffer.from(j.messageId), mimeType: 'audio/ogg' })),
            onTranscribed: vi.fn(async (j) => { ordre.push(j.messageId); })
        });

        for (const id of ['A', 'B', 'C', 'D']) await queue.submit(job(id));
        await queue.idle();

        expect(pic).toBe(1);
        expect(ordre).toEqual(['A', 'B', 'C', 'D']);
    });

    it('refuse les nouveaux vocaux quand la file est pleine, en le disant', async () => {
        const bloque = deferred();
        const { queue, logs } = makeQueue({
            maxPending: 2,
            transcribe: vi.fn(() => bloque.promise.then(() => ({ text: 'ok', empty: false })))
        });

        await queue.submit(job('A'));   // pris par le worker, en cours de transcription
        await queue.submit(job('B'));   // en attente (1/2)
        await queue.submit(job('C'));   // en attente (2/2)
        const refuse = await queue.submit(job('D'));

        expect(refuse).toMatchObject({ accepted: false, reason: 'FILE_PLEINE' });
        expect(queue.pendingCount()).toBe(2);
        expect(logs.some((l) => /File pleine/.test(l))).toBe(true);

        bloque.resolve();
        await queue.idle();
        expect(queue.stats().transcrits).toBe(3);
    });

    it('oublie les plus anciens identifiants au-delà de sa mémoire', async () => {
        const { queue, deps } = makeQueue({ memory: 2 });
        await queue.submit(job('A'));
        await queue.submit(job('B'));
        await queue.submit(job('C'));   // A sort de la fenêtre
        await queue.idle();

        await queue.submit(job('A'));   // donc A est repris
        await queue.idle();

        expect(deps.transcribe).toHaveBeenCalledTimes(4);
    });

    it('idle() résout immédiatement quand rien ne tourne', async () => {
        const { queue } = makeQueue();
        await expect(queue.idle()).resolves.toBeUndefined();
    });
});

describe('voiceNoteQueue — confidentialité des journaux', () => {
    it('ne journalise jamais la transcription ni le nom du contact en clair', async () => {
        const secret = 'trois pagnes wax pour Aminata livraison Cocody 0707070707';
        const { queue, logs } = makeQueue({
            transcribe: vi.fn(async () => ({ text: secret, empty: false, engine: 'essai' }))
        });

        await queue.submit(job('A'));
        await queue.idle();

        const journal = logs.join('\n');
        expect(journal).not.toContain(secret);
        expect(journal).not.toContain('0707070707');
        expect(journal).not.toContain('Aminata Koné');
        expect(journal).toMatch(/transcrit/);
    });
});
