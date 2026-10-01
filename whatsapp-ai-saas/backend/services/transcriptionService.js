/**
 * Transcription audio — notes vocales WhatsApp.
 *
 * L'observateur de commandes (`orderListener.processMessage`) prend du texte.
 * Un vocal n'en a pas : ce service fabrique ce texte, puis le message reprend
 * exactement le même chemin que s'il avait été tapé. Aucune branche parallèle
 * dans le pipeline de détection.
 *
 * MOTEUR ENFICHABLE — le choix « API distante ou modèle local » (arbitrage A2)
 * n'est pas figé ici. Chaque moteur s'enregistre dans ENGINES et se choisit par
 * le réglage `transcription_engine`. Ajouter un moteur local plus tard consiste
 * à écrire une fonction et à l'enregistrer, pas à retoucher les appelants.
 *
 * CONFIDENTIALITÉ — une transcription est du contenu de message au même titre
 * que du texte tapé. Tout ce que ce service journalise passe par `redactMessage`,
 * sans exception. C'est la fuite corrigée en v1.40.2 : on ne la rouvre pas par
 * une porte dérobée.
 */

const db = require('../db');
const geminiService = require('../geminiService');
const { redactMessage } = require('../logRedact');

/** Au-delà, on refuse plutôt que d'envoyer un fichier hors de proportion. */
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

/** Conteneurs que WhatsApp Web produit pour les notes vocales. */
const SUPPORTED_MIME_PREFIXES = ['audio/'];

/**
 * Moteurs disponibles. La signature est la même pour tous :
 *   (audio: Buffer, mimeType: string, options) => { text, language, model }
 * et un échec **lève** — il ne renvoie jamais une transcription vide, qui se
 * confondrait avec un vocal sans parole.
 */
const ENGINES = {
    gemini: (audio, mimeType, options) =>
        geminiService.transcribeAudio(audio, mimeType, options),
    'whisper-local': (audio, mimeType, options) =>
        transcribeWithLocalWhisper(audio, options)
};

/**
 * Moteur local : faster-whisper, lancé comme sous-processus Python.
 *
 * Aucun appel réseau, aucune clé d'API, aucun coût par message — l'audio ne
 * quitte pas la machine. En contrepartie c'est plus lent qu'une API, et il
 * faut `pip install faster-whisper` sur l'interpréteur visé.
 *
 * INTERPRÉTEUR — `python` (résolu par le PATH), ou la variable d'environnement
 * WACOPILOTE_WHISPER_PYTHON posée au lancement pour pointer un environnement
 * virtuel. Jamais un réglage en base : les réglages s'écrivent par l'API, et
 * laisser l'API désigner un exécutable violerait l'invariant posé dans
 * externalAgentRunner (« jamais le chemin brut saisi »). Une variable
 * d'environnement, elle, est fixée par qui lance l'application.
 *
 * MODÈLE — réglage `transcription_whisper_model`, restreint à une liste
 * fermée : faster-whisper accepte aussi un chemin ou un dépôt Hugging Face, ce
 * qu'un réglage écrit par l'API ne doit pas pouvoir désigner.
 *
 * Mesuré le 20/09/2026 sur ce poste, même vocal de 10 s, modèles en cache :
 *   tiny  16 à 45 s (instable, et transcription fautive : « 10 micro »)
 *   base  29 à 35 s (ouverture de phrase déformée)
 *   small 27 à 28 s (2,7 × temps réel, transcription correcte)
 * `small` est donc à la fois le plus juste et le plus rapide : défaut retenu.
 */
const WHISPER_MODELS = new Set(['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3']);

/**
 * En build packagé, backend/ vit dans app.asar — une archive que seul le Node
 * d'Electron sait lire. Python, lui, n'y voit qu'un fichier opaque et ne
 * trouverait pas le script. electron-builder désarchive donc backend/scripts
 * (`asarUnpack` dans package.json) vers app.asar.unpacked, et on y redirige le
 * chemin. Sans effet en développement, où aucun segment app.asar n'apparaît.
 */
function toUnpackedPath(p) {
    return String(p).replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
}

async function transcribeWithLocalWhisper(audio, options = {}) {
    const { spawn } = require('child_process');
    const path = require('path');

    const python = process.env.WACOPILOTE_WHISPER_PYTHON || 'python';
    const requested = options.model || await readSetting('transcription_whisper_model', '') || 'small';
    if (!WHISPER_MODELS.has(requested)) {
        throw new Error(
            `Modèle Whisper « ${requested} » non pris en charge. Disponibles : ${[...WHISPER_MODELS].join(', ')}.`
        );
    }
    const model = requested;

    const script = toUnpackedPath(path.join(__dirname, '..', 'scripts', 'whisperTranscribe.py'));

    return new Promise((resolve, reject) => {
        const child = spawn(python, [script], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                WHISPER_MODEL: model,
                WHISPER_LANGUAGE: options.languageHint && /^[a-z]{2}$/i.test(options.languageHint)
                    ? options.languageHint.toLowerCase()
                    : 'auto'
            }
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => { stdout += d; });
        child.stderr.on('data', (d) => { stderr += d; });

        child.on('error', (err) => {
            reject(new Error(
                `Interpréteur Python « ${python} » introuvable ou non exécutable : ${err.message}`
            ));
        });

        child.on('close', (code) => {
            let parsed = null;
            try { parsed = JSON.parse(stdout.trim()); } catch { /* sortie non JSON */ }

            if (code !== 0 || !parsed || parsed.error) {
                // La dernière ligne de stderr porte souvent la cause réelle —
                // même raison que la remontée stderr du canal CLI (C1, v1.48.2).
                const detail = parsed?.error
                    || stderr.trim().split('\n').slice(-1)[0]
                    || `code de sortie ${code}`;
                return reject(new Error(`Transcription locale échouée : ${detail}`));
            }

            resolve({
                text: parsed.text,
                language: parsed.language || null,
                model: `whisper:${parsed.model}`
            });
        });

        child.stdin.on('error', () => { /* le processus a déjà fermé son entrée */ });
        child.stdin.end(Buffer.isBuffer(audio) ? audio.toString('base64') : String(audio));
    });
}

function listEngines() {
    return Object.keys(ENGINES);
}

/**
 * Enregistre un moteur supplémentaire (whisper.cpp local, onnxruntime…).
 * Exposé pour que l'ajout d'un moteur ne demande pas de modifier ce fichier.
 */
function registerEngine(name, fn) {
    if (typeof name !== 'string' || !name) throw new Error('registerEngine : nom invalide.');
    if (typeof fn !== 'function') throw new Error('registerEngine : fonction attendue.');
    ENGINES[name] = fn;
}

/**
 * `db.getSetting` est appelé par espace de noms, au moment de l'appel — jamais
 * déstructuré au chargement — pour que les tests puissent le substituer.
 *
 * C'est la convention du projet (cf. agentFallbackStrategies.test.js) : sous
 * Vitest, un `import` ESM dans le test et le `require` de ce module donnent deux
 * instances de `../db` — constaté une première fois sur le routeur agentique, et
 * de nouveau le 19 septembre 2026 ici (un réglage écrit par le test restait
 * invisible au service). Le test passe donc par `require('../db')` et substitue
 * `getSetting` ; `vi.mock` n'intercepte pas ces modules CommonJS inlinés.
 */
const readSetting = (key, defaultValue) => db.getSetting(key, defaultValue);

async function resolveEngineName(requested) {
    if (requested) return requested;
    const configured = await readSetting('transcription_engine', '');
    return configured || 'gemini';
}

function normalizeAudio(audio) {
    if (Buffer.isBuffer(audio)) return audio;
    if (audio instanceof Uint8Array) return Buffer.from(audio);
    if (typeof audio === 'string') {
        const payload = audio.includes(',') ? audio.split(',')[1] : audio;
        return Buffer.from(payload, 'base64');
    }
    throw new Error('transcribe : audio doit être un Buffer, un Uint8Array ou du base64.');
}

/**
 * Transcrit une note vocale.
 *
 * @param {object} params
 * @param {Buffer|Uint8Array|string} params.audio  octets ou base64
 * @param {string} params.mimeType                 ex. 'audio/ogg; codecs=opus'
 * @param {string} [params.languageHint]           langue attendue
 * @param {string} [params.engine]                 force un moteur
 * @param {string} [params.model]                  force un modèle
 * @returns {Promise<{ text, language, engine, model, empty, bytes, durationMs }>}
 *          `empty` vaut true quand le moteur a bien répondu mais n'a entendu
 *          aucune parole — ce n'est pas une erreur, et c'est distinct d'un échec.
 * @throws  si l'audio est invalide, le moteur inconnu, ou la transcription échoue.
 */
async function transcribe({ audio, mimeType, languageHint, engine, model } = {}) {
    const started = Date.now();

    const buffer = normalizeAudio(audio);
    if (buffer.length === 0) throw new Error('transcribe : audio vide.');
    if (buffer.length > MAX_AUDIO_BYTES) {
        throw new Error(
            `transcribe : audio de ${buffer.length} octets, au-delà de la limite de ${MAX_AUDIO_BYTES}.`
        );
    }

    if (!mimeType || !SUPPORTED_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
        throw new Error(`transcribe : type MIME non audio « ${mimeType || '(absent)'} ».`);
    }

    const engineName = await resolveEngineName(engine);
    const run = ENGINES[engineName];
    if (!run) {
        throw new Error(
            `transcribe : moteur « ${engineName} » inconnu. Disponibles : ${listEngines().join(', ')}.`
        );
    }

    const result = await run(buffer, mimeType, { languageHint, model });
    const text = typeof result?.text === 'string' ? result.text.trim() : '';
    const durationMs = Date.now() - started;

    console.error(
        `[Transcription] ${engineName} · ${buffer.length} o · ${durationMs} ms · `
        + `${text ? redactMessage(text) : '(aucune parole détectée)'}`
    );

    return {
        text,
        language: result?.language || null,
        engine: engineName,
        model: result?.model || model || null,
        empty: text.length === 0,
        bytes: buffer.length,
        durationMs
    };
}

module.exports = {
    transcribe,
    toUnpackedPath,
    registerEngine,
    listEngines,
    MAX_AUDIO_BYTES
};
