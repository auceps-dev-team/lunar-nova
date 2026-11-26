/**
 * File d'attente des notes vocales à transcrire.
 *
 * POURQUOI UNE FILE — mesuré le 20 septembre 2026, faster-whisper `small` en
 * int8 sur le poste de développement : ~27 s de calcul pour 10 s d'audio
 * (2,7 à 2,8 × le temps réel, deux essais), plus ~6 s de chargement du modèle.
 * Transcrire dans le flux de l'observateur bloquerait la détection de toutes
 * les autres commandes pendant ce temps. Les vocaux sont donc transcrits à part,
 * un à la fois (le calcul est lié au processeur : en paralléliser plusieurs ne
 * ferait que les ralentir tous), puis réinjectés dans le pipeline de détection
 * comme n'importe quel message.
 *
 * DEUX TEMPS, VOLONTAIREMENT SÉPARÉS
 *   1. extraction — immédiate, à la réception. Elle dépend du DOM : la ligne du
 *      vocal doit être affichée. Si on l'attendait derrière une transcription de
 *      30 s, l'utilisateur aurait le temps de changer de conversation et le
 *      vocal ne serait plus à l'écran.
 *   2. transcription — en file. Elle ne dépend plus que des octets, déjà en main.
 *
 * DÉSACTIVÉE PAR DÉFAUT — chaque vocal coûte ~30 s de processeur (moteur local)
 * ou des jetons (moteur distant). Aucune de ces deux dépenses ne se déclenche
 * sans que l'utilisateur l'ait choisie (réglage `voice_notes_transcription`).
 *
 * ÉCHECS NOMMÉS — un vocal qu'on n'a pas su lire est journalisé avec sa cause,
 * jamais converti en message vide. « Rien entendu » (`empty`) et « échec »
 * sont deux issues distinctes, comptées séparément.
 *
 * Injection de dépendances plutôt que `require` : sous Vitest, un module requis
 * par ce fichier n'est pas la même instance que celui importé par le test, et
 * `vi.mock` ne l'intercepte pas (mesuré le 19 septembre 2026). Passer les
 * dépendances en paramètre est ce qui rend cette file réellement testable.
 */

const { redactMessage, redactContact } = require('../logRedact');

const RAISONS = {
    DESACTIVE: 'transcription des vocaux désactivée',
    DEJA_TRAITE: 'vocal déjà pris en charge',
    FILE_PLEINE: 'file de transcription pleine',
    EXTRACTION_ECHOUEE: 'extraction de l’audio impossible',
    SANS_IDENTIFIANT: 'vocal sans identifiant de message'
};

/**
 * @param {object} deps
 * @param {(job: object) => Promise<{audio: Buffer, mimeType: string, bytes?: number, durationSec?: number|null}>} deps.extract
 * @param {(args: {audio: Buffer, mimeType: string}) => Promise<{text: string, empty: boolean, engine?: string}>} deps.transcribe
 * @param {(job: object, result: object) => Promise<void>|void} deps.onTranscribed
 * @param {() => Promise<boolean>|boolean} deps.isEnabled
 * @param {number} [deps.maxPending=20]  au-delà, les nouveaux vocaux sont refusés (et journalisés)
 * @param {number} [deps.memory=500]     nombre d'identifiants retenus pour la déduplication
 * @param {(msg: string) => void} [deps.log]
 */
function createVoiceNoteQueue({
    extract,
    transcribe,
    onTranscribed,
    isEnabled,
    maxPending = 20,
    memory = 500,
    log = (msg) => console.error(msg)
} = {}) {
    for (const [nom, fn] of Object.entries({ extract, transcribe, onTranscribed, isEnabled })) {
        if (typeof fn !== 'function') throw new Error(`createVoiceNoteQueue : « ${nom} » doit être une fonction.`);
    }

    const pending = [];
    const seenOrder = [];
    const seen = new Set();
    let running = false;
    let drainWaiters = [];
    let desactivationSignalee = false;

    const stats = {
        recus: 0,
        refuses: 0,
        extraits: 0,
        transcrits: 0,
        vides: 0,
        echecsExtraction: 0,
        echecsTranscription: 0,
        echecsReinjection: 0
    };

    const remember = (key) => {
        if (seen.has(key)) return;
        seen.add(key);
        seenOrder.push(key);
        if (seenOrder.length > memory) seen.delete(seenOrder.shift());
    };

    const refuse = (reason, extra = '') => {
        stats.refuses++;
        return { accepted: false, reason, message: RAISONS[reason] + extra };
    };

    function notifyIdle() {
        if (running || pending.length) return;
        const waiters = drainWaiters;
        drainWaiters = [];
        waiters.forEach((resolve) => resolve());
    }

    async function worker() {
        if (running) return;
        running = true;
        try {
            while (pending.length) {
                const job = pending.shift();
                let result;
                try {
                    result = await transcribe({ audio: job.audio, mimeType: job.mimeType });
                } catch (err) {
                    stats.echecsTranscription++;
                    // Le message d'erreur d'un moteur ne contient pas l'audio ni
                    // la transcription : on peut le journaliser tel quel.
                    log(`[VoiceQueue] Échec de transcription du vocal de [${redactContact(job.contact)}] : ${err.message}`);
                    continue;
                }

                if (!result || result.empty || !result.text) {
                    stats.vides++;
                    log(`[VoiceQueue] Vocal de [${redactContact(job.contact)}] : aucune parole détectée.`);
                    continue;
                }

                stats.transcrits++;
                log(`[VoiceQueue] Vocal de [${redactContact(job.contact)}] transcrit `
                    + `(${result.engine || 'moteur ?'}) : ${redactMessage(result.text)}`);

                // La transcription a réussi : si la suite échoue, ce n'est pas
                // un échec de transcription, et le journal ne doit pas le dire.
                try {
                    await onTranscribed(job, result);
                } catch (err) {
                    stats.echecsReinjection++;
                    log(`[VoiceQueue] Vocal de [${redactContact(job.contact)}] transcrit mais non traité `
                        + `par le pipeline de détection : ${err.message}`);
                }
            }
        } finally {
            running = false;
            notifyIdle();
        }
    }

    /**
     * Prend en charge un vocal. Ne lève jamais : l'appelant est un rappel
     * déclenché depuis la page WhatsApp, qui n'a rien à faire d'une exception.
     *
     * @param {{instanceId: string, contact: string, messageId: string}} job
     * @returns {Promise<{accepted: boolean, reason?: string, message?: string}>}
     */
    async function submit(job = {}) {
        stats.recus++;

        if (!job.messageId) return refuse('SANS_IDENTIFIANT');

        let enabled = false;
        try { enabled = await isEnabled(); } catch { enabled = false; }
        if (!enabled) {
            if (!desactivationSignalee) {
                desactivationSignalee = true;
                log('[VoiceQueue] Vocal reçu mais transcription désactivée (réglage voice_notes_transcription). '
                    + 'Ce message n\'apparaîtra qu\'une fois.');
            }
            return refuse('DESACTIVE');
        }

        const key = `${job.instanceId || ''}|${job.messageId}`;
        if (seen.has(key)) return refuse('DEJA_TRAITE');

        if (pending.length >= maxPending) {
            log(`[VoiceQueue] File pleine (${pending.length}/${maxPending}) : vocal de [${redactContact(job.contact)}] non transcrit.`);
            return refuse('FILE_PLEINE', ` (${maxPending} en attente)`);
        }

        // Marqué avant l'extraction : l'observateur peut signaler la même ligne
        // plusieurs fois pendant qu'elle se rend, et une seule prise en charge
        // suffit.
        remember(key);

        let extracted;
        try {
            extracted = await extract(job);
        } catch (err) {
            stats.echecsExtraction++;
            log(`[VoiceQueue] Extraction impossible du vocal de [${redactContact(job.contact)}] : ${err.message}`);
            return refuse('EXTRACTION_ECHOUEE', ` : ${err.message}`);
        }
        stats.extraits++;

        pending.push({ ...job, audio: extracted.audio, mimeType: extracted.mimeType, durationSec: extracted.durationSec ?? null });
        worker();
        return { accepted: true };
    }

    /** Résout quand la file est vide et qu'aucune transcription ne tourne. */
    function idle() {
        if (!running && !pending.length) return Promise.resolve();
        return new Promise((resolve) => drainWaiters.push(resolve));
    }

    return {
        submit,
        idle,
        pendingCount: () => pending.length,
        isRunning: () => running,
        stats: () => ({ ...stats, enAttente: pending.length })
    };
}

module.exports = { createVoiceNoteQueue, RAISONS };
