/**
 * CLI WaCopilote — Recherche de leads ad-hoc.
 *
 * Extrait de bin/wacopilote.cjs (constat R10 de l’audit du 29/09/2026), à
 * l’identique : seuls les chemins require ont gagné un niveau.
 */

const { parseNamedArgs, printJsonOrError } = require('../lib/helpers.cjs');

/**
 * Commande `prospect search` : recherche de leads ad-hoc (hors wizard pipeline).
 */
async function handleProspect(args) {
    const subCommand = args[0];
    if (subCommand !== 'search') {
        console.error(`\x1b[31mSous-commande 'prospect' inconnue : '${subCommand}'. Utilisez 'prospect search'.\x1b[0m`);
        process.exit(1);
    }
    const opts = parseNamedArgs(args.slice(1));
    const isJson = opts.json === true;
    try {
        const prospectionService = require('../../backend/services/prospectionService');
        const { count, leads } = await prospectionService.search({
            query: opts.query,
            source: opts.source || 'google',
            zone: opts.zone || '',
            quantity: opts.quantity ? Number(opts.quantity) : 20,
            pages: opts.pages ? Number(opts.pages) : 1,
            ignoreLandlines: opts['ignore-landlines'] !== 'false',
            country: opts.country,
            subcategorySlug: opts['subcategory-slug']
        });
        printJsonOrError(isJson, { count, leads });
    } catch (err) {
        console.error(`\x1b[31mErreur de prospection : ${err.message}\x1b[0m`);
        process.exit(1);
    }
}

module.exports = { handleProspect };
