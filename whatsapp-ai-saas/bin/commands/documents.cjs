/**
 * CLI WaCopilote — Documents texte générés par l’IA.
 *
 * Extrait de bin/wacopilote.cjs (constat R10 de l’audit du 29/09/2026), à
 * l’identique : seuls les chemins require ont gagné un niveau.
 */

const db = require('../../backend/db');
const { readStdin, parseNamedArgs, printJsonOrError } = require('../lib/helpers.cjs');

/**
 * Commande `documents` : CRUD sur les documents texte générés par l'IA.
 */
async function handleDocuments(args) {
    const subCommand = args[0];
    const opts = parseNamedArgs(args.slice(1));
    const isJson = opts.json === true;

    await db.initDB();
    const documentsService = require('../../backend/services/documentsService');

    try {
        switch (subCommand) {
            case 'list': {
                const documents = await documentsService.listDocuments();
                printJsonOrError(isJson, { documents });
                return;
            }
            case 'get': {
                const document = await documentsService.getDocument(args[1]);
                printJsonOrError(isJson, { document });
                return;
            }
            case 'create': {
                const content = opts.content || (await readStdin());
                const document = await documentsService.createDocument({ title: opts.title, content });
                printJsonOrError(isJson, { document });
                return;
            }
            case 'update': {
                const content = opts.content !== undefined ? opts.content : (await readStdin());
                const document = await documentsService.updateDocument(args[1], { title: opts.title, content: content || undefined });
                printJsonOrError(isJson, { document });
                return;
            }
            case 'delete': {
                await documentsService.deleteDocument(args[1]);
                printJsonOrError(isJson, { deleted: true });
                return;
            }
            default:
                console.error(`\x1b[31mSous-commande 'documents' inconnue : '${subCommand}'. Utilisez list, get, create, update, delete.\x1b[0m`);
                process.exit(1);
        }
    } catch (err) {
        if (isJson) {
            console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
        } else {
            console.error(`\x1b[31mErreur documents : ${err.message}\x1b[0m`);
        }
        process.exit(1);
    }
}

module.exports = { handleDocuments };
