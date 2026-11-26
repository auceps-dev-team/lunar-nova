/**
 * CLI WaCopilote — Devis et export PDF.
 *
 * Extrait de bin/wacopilote.cjs (constat R10 de l’audit du 29/09/2026), à
 * l’identique : seuls les chemins require ont gagné un niveau.
 */

const path = require('path');
const db = require('../../backend/db');
const { readStdin, parseNamedArgs, printJsonOrError } = require('../lib/helpers.cjs');

/**
 * Commande `quotes` : CRUD sur les devis + export PDF (Chromium headless
 * autonome, voir invoiceService.renderPdf).
 */
async function handleQuotes(args) {
    const subCommand = args[0];
    const opts = parseNamedArgs(args.slice(1));
    const isJson = opts.json === true;

    await db.initDB();
    const invoiceService = require('../../backend/services/invoiceService');

    try {
        switch (subCommand) {
            case 'list': {
                const quotes = await invoiceService.listInvoices();
                printJsonOrError(isJson, { quotes });
                return;
            }
            case 'get': {
                const quote = await invoiceService.getInvoice(args[1]);
                printJsonOrError(isJson, { quote });
                return;
            }
            case 'create': {
                const raw = opts.data || (await readStdin());
                let draft = {};
                try { draft = raw ? JSON.parse(raw) : {}; } catch {
                    console.error(`\x1b[31mErreur : --data doit être un JSON valide (ou via stdin).\x1b[0m`);
                    process.exit(1);
                }
                if (opts['client-name']) draft.clientName = opts['client-name'];
                const quote = await invoiceService.createInvoice(draft);
                printJsonOrError(isJson, { quote });
                return;
            }
            case 'update': {
                const existing = await invoiceService.getInvoice(args[1]);
                const raw = opts.data || (await readStdin());
                let patch = {};
                try { patch = raw ? JSON.parse(raw) : {}; } catch {
                    console.error(`\x1b[31mErreur : --data doit être un JSON valide (ou via stdin).\x1b[0m`);
                    process.exit(1);
                }
                const quote = await invoiceService.updateInvoice(args[1], { ...existing, ...patch });
                printJsonOrError(isJson, { quote });
                return;
            }
            case 'delete': {
                await invoiceService.deleteInvoice(args[1]);
                printJsonOrError(isJson, { deleted: true });
                return;
            }
            case 'export-pdf': {
                if (!opts.out) {
                    console.error(`\x1b[31mErreur : --out <chemin.pdf> est obligatoire.\x1b[0m`);
                    process.exit(1);
                }
                const outPath = path.resolve(opts.out);
                await invoiceService.renderPdf(args[1], outPath);
                printJsonOrError(isJson, { outPath });
                return;
            }
            default:
                console.error(`\x1b[31mSous-commande 'quotes' inconnue : '${subCommand}'. Utilisez list, get, create, update, delete, export-pdf.\x1b[0m`);
                process.exit(1);
        }
    } catch (err) {
        if (isJson) {
            console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
        } else {
            console.error(`\x1b[31mErreur devis : ${err.message}\x1b[0m`);
        }
        process.exit(1);
    }
}

module.exports = { handleQuotes };
