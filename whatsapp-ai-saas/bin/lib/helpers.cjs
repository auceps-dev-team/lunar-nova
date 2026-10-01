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

module.exports = { readStdin, parseNamedArgs, readJsonArrayInput, printJsonOrError };
