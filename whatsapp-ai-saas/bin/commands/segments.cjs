/**
 * CLI WaCopilote — Segments CRM.
 *
 * Extrait de bin/wacopilote.cjs (constat R10 de l’audit du 29/09/2026), à
 * l’identique : seuls les chemins require ont gagné un niveau.
 */

const db = require('../../backend/db');
const { parseNamedArgs, printJsonOrError } = require('../lib/helpers.cjs');

/**
 * Commande `segments` : Gestion des segments CRM.
 */
async function handleSegments(args) {
    const subCommand = args[0] || 'list';
    const isJson = args.includes('--json');
    const opts = parseNamedArgs(args.slice(1));
    const crmService = require('../../backend/services/crmService');
    await db.initDB();

    if (subCommand === 'list') {
        const segments = await crmService.listSegments();
        printJsonOrError(isJson, { segments, count: segments.length });
        return;
    }

    if (subCommand === 'create') {
        const name = opts.name || args[1];
        if (!name) {
            console.error('\x1b[31mErreur : Nom de segment requis (--name <nom>).\x1b[0m');
            process.exit(1);
        }
        const segment = await crmService.createSegment({ name });
        printJsonOrError(isJson, { success: true, segment });
        return;
    }

    if (subCommand === 'delete') {
        const id = args[1];
        if (!id) {
            console.error('\x1b[31mErreur : Identifiant de segment requis.\x1b[0m');
            process.exit(1);
        }
        await crmService.deleteSegment(id);
        printJsonOrError(isJson, { success: true, id });
        return;
    }

    console.error(`\x1b[31mSous-commande segments inconnue : '${subCommand}'.\x1b[0m`);
    process.exit(1);
}

module.exports = { handleSegments };
