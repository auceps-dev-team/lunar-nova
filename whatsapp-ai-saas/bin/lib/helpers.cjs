/**
 * CLI WaCopilote — utilitaires partagés par les commandes.
 *
 * Extrait de bin/wacopilote.cjs (constat R10 de l’audit du 29/09/2026), à
 * l’identique : seuls les chemins require ont gagné un niveau.
 */

const fs = require('fs');

/**
 * Lit l'intégralité du flux d'entrée standard (stdin) de manière asynchrone.
 * Permet le chaînage Unix : `cat prompt.txt | wacopilote run --agent copywriter`
 *
 * @returns {Promise<string>}
 */
async function readStdin() {
    if (process.stdin.isTTY) {
        return '';
    }
    return new Promise((resolve) => {
        let data = '';
        let resolved = false;

        const finish = () => {
            if (!resolved) {
                resolved = true;
                resolve(data.trim());
            }
        };

        // Timeout de sécurité si le descripteur stdin reste ouvert sans émettre d'octets
        const timer = setTimeout(finish, 250);

        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => {
            clearTimeout(timer);
            finish();
        });
        process.stdin.on('error', () => {
            clearTimeout(timer);
            finish();
        });
    });
}

/**
 * Parseur d'arguments basique pour options nommées (--key value ou --flag).
 */
function parseNamedArgs(argsList) {
    const parsed = {};
    for (let i = 0; i < argsList.length; i++) {
        const arg = argsList[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            if (i + 1 < argsList.length && !argsList[i + 1].startsWith('--')) {
                parsed[key] = argsList[i + 1];
                i++;
            } else {
                parsed[key] = true;
            }
        }
    }
    return parsed;
}

/**
 * Lit un JSON (tableau de leads ou de cartes) depuis --xxx-file <chemin> ou stdin.
 */
async function readJsonArrayInput(opts, fileKey) {
    let raw = '';
    if (opts[fileKey]) {
        if (!fs.existsSync(opts[fileKey])) {
            console.error(`\x1b[31mErreur : Le fichier '${opts[fileKey]}' n'existe pas.\x1b[0m`);
            process.exit(1);
        }
        raw = fs.readFileSync(opts[fileKey], 'utf-8');
    } else {
        raw = await readStdin();
    }
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        console.error(`\x1b[31mErreur : entrée JSON invalide (attendu un tableau).\x1b[0m`);
        process.exit(1);
    }
}

function printJsonOrError(isJson, payload) {
    if (isJson) {
        console.log(JSON.stringify({ success: true, ...payload }, null, 2));
    } else {
        console.log(JSON.stringify(payload, null, 2));
    }
}

const DELAI_SORTIE_FORCEE_MS = 2000;

/**
 * Fin d'une commande (hors 'mcp', serveur stdio persistant) : sortie
 * NATURELLE, process.exit() seulement en dernier recours.
 *
 * Un process.exit() immédiat après un fetch faisait planter le CLI sous
 * Windows : « Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file
 * src\win\async.c, line 94 », code 3221226505. Mesuré le 27/11/2026 (Node
 * 24.16.0), fetch vers le backend lancé seul puis sortie : 8 plantages sur 8
 * avec process.exit, 8 sorties propres sur 8 en sortie naturelle. Cause
 * probable, non démontrée : une tâche de V8 en arrière-plan achevée pendant la
 * destruction de l'environnement — la sortie naturelle attend ces tâches,
 * process.exit() non. Les commandes d'IA passent par fetch (SDK compris).
 *
 * Le drain de stdout reste garanti : une sortie naturelle attend la fin des
 * écritures, et la sortie forcée n'est armée qu'après le drain (écrire une
 * chaîne vide ordonne le vidage de tous les écrits précédents). Sans ce drain,
 * `list-agents --json` (≈ 158 Ko) arrivait tronqué chez les consommateurs
 * programmatiques. La sortie forcée ne sert que si un module garde la boucle
 * d'événements ouverte ; elle reste différée pour laisser finir ces tâches.
 */
function terminerCommande(code) {
    process.exitCode = code;
    process.stdout.once('error', () => process.exit(code)); // EPIPE : lecteur parti, quitter sans trace
    process.stdout.write('', () => {
        setTimeout(() => process.exit(code), DELAI_SORTIE_FORCEE_MS).unref();
    });
}

module.exports = { readStdin, parseNamedArgs, readJsonArrayInput, printJsonOrError, terminerCommande, DELAI_SORTIE_FORCEE_MS };
