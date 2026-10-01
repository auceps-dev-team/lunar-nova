/**
 * CLI WaCopilote — Instances WhatsApp déjà connectées.
 *
 * Extrait de bin/wacopilote.cjs (constat R10 de l’audit du 29/09/2026), à
 * l’identique : seuls les chemins require ont gagné un niveau.
 */

const db = require('../../backend/db');
const { parseNamedArgs, printJsonOrError } = require('../lib/helpers.cjs');

/**
 * Commande `instances` : lister/piloter les instances WhatsApp déjà connectées.
 * Créer une toute nouvelle instance nécessite un scan QR humain dans l'app
 * Electron — hors périmètre d'un CLI headless, non disponible ici.
 */
async function handleInstances(args) {
    const subCommand = args[0];
    const opts = parseNamedArgs(args.slice(1));
    const isJson = opts.json === true;

    await db.initDB();
    const waInstancesService = require('../../backend/services/waInstancesService');

    try {
        switch (subCommand) {
            case 'list': {
                const instances = await waInstancesService.listInstances();
                printJsonOrError(isJson, { instances });
                return;
            }
            case 'open-chat': {
                if (!opts.instance || !opts.phone) {
                    console.error(`\x1b[31mUsage : instances open-chat --instance <id> --phone <numéro> [--message <texte>]\x1b[0m`);
                    process.exit(1);
                }
                const result = await waInstancesService.openChat({
                    instanceId: opts.instance,
                    phone: opts.phone,
                    text: opts.message || ''
                });
                printJsonOrError(isJson, result);
                return;
            }
            default:
                console.error(`\x1b[31mSous-commande 'instances' inconnue : '${subCommand}'. Utilisez list, open-chat.\x1b[0m`);
                process.exit(1);
        }
    } catch (err) {
        if (isJson) {
            console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
        } else {
            console.error(`\x1b[31mErreur instances : ${err.message}\x1b[0m`);
        }
        process.exit(1);
    }
}

module.exports = { handleInstances };
