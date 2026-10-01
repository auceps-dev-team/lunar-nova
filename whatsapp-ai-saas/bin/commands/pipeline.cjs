/**
 * CLI WaCopilote — Wizard de prospection → liste → messages → planning.
 *
 * Extrait de bin/wacopilote.cjs (constat R10 de l’audit du 29/09/2026), à
 * l’identique : seuls les chemins require ont gagné un niveau.
 */

const db = require('../../backend/db');
const { readStdin, parseNamedArgs, readJsonArrayInput, printJsonOrError } = require('../lib/helpers.cjs');

/**
 * Commande `pipeline` : wizard de prospection -> liste -> messages -> planning.
 */
async function handlePipeline(args) {
    const subCommand = args[0];
    const opts = parseNamedArgs(args.slice(1));
    const isJson = opts.json === true;

    await db.initDB();
    const pipelineService = require('../../backend/services/pipelineService');

    try {
        switch (subCommand) {
            case 'create': {
                const brief = opts.brief || (await readStdin());
                if (!brief) {
                    console.error(`\x1b[31mErreur : --brief <texte> est obligatoire.\x1b[0m`);
                    process.exit(1);
                }
                const run = await pipelineService.createRun({ brief, name: opts.name });
                printJsonOrError(isJson, { run });
                return;
            }
            case 'prospect': {
                const runId = args[1];
                const brief = opts.brief || (await readStdin());
                if (!runId || !brief) {
                    console.error(`\x1b[31mUsage : pipeline prospect <runId> --brief "..."\x1b[0m`);
                    process.exit(1);
                }
                const result = await pipelineService.prospectStage(runId, { brief });
                printJsonOrError(isJson, result);
                return;
            }
            case 'save-contacts': {
                const runId = args[1];
                if (!runId) {
                    console.error(`\x1b[31mUsage : pipeline save-contacts <runId> [--list-id <id>] [--list-name <nom>] [--segment-id <id>] [--segment-name <nom>] [--leads-file <path>]\x1b[0m`);
                    process.exit(1);
                }
                const leads = await readJsonArrayInput(opts, 'leads-file');
                let listId = opts['list-id'] ? Number(opts['list-id']) : null;
                const listName = opts['list-name'] || opts.list || null;
                if (!listId && listName) {
                    const list = await pipelineService.createContactList(listName);
                    if (list) listId = list.id;
                }

                let segmentId = opts['segment-id'] ? Number(opts['segment-id']) : null;
                const segmentName = opts['segment-name'] || opts.segment || null;
                if (!segmentId && segmentName) {
                    const seg = await pipelineService.createSegment(segmentName);
                    if (seg) segmentId = seg.id;
                }

                const result = await pipelineService.saveContactsStage(runId, {
                    leads,
                    list_id: listId,
                    segment_id: segmentId
                });
                printJsonOrError(isJson, result);
                return;
            }
            case 'generate-messages': {
                const contactIds = (opts['contact-ids'] || '').split(',').map(s => Number(s.trim())).filter(Boolean);
                if (contactIds.length === 0) {
                    console.error(`\x1b[31mUsage : pipeline generate-messages --contact-ids 1,2,3\x1b[0m`);
                    process.exit(1);
                }
                const result = await pipelineService.generateMessagesStage({ contactIds });
                printJsonOrError(isJson, result);
                return;
            }
            case 'organize': {
                const runId = args[1];
                if (!runId) {
                    console.error(`\x1b[31mUsage : pipeline organize <runId> [--cards-file <path>]\x1b[0m`);
                    process.exit(1);
                }
                const cards = await readJsonArrayInput(opts, 'cards-file');
                const result = await pipelineService.organizeStage(runId, { cards });
                printJsonOrError(isJson, result);
                return;
            }
            case 'cards': {
                const cards = await pipelineService.listCards({ run_id: opts['run-id'] });
                printJsonOrError(isJson, { cards });
                return;
            }
            case 'run': {
                const brief = opts.brief || (await readStdin());
                if (!brief) {
                    console.error(`\x1b[31mErreur : --brief <texte> est obligatoire.\x1b[0m`);
                    process.exit(1);
                }
                if (!opts.auto) {
                    console.error(`\x1b[31mErreur : 'pipeline run' nécessite --auto (pipeline complet : prospection -> liste -> messages -> planning). Pour un contrôle étape par étape, utilisez 'pipeline create/prospect/save-contacts/generate-messages/organize'.\x1b[0m`);
                    process.exit(1);
                }
                console.log(`\x1b[36m[Pipeline CLI] Lancement du pipeline autonome avec le brief :\x1b[0m ${brief}`);
                const result = await pipelineService.runAuto({
                    brief,
                    name: opts.name,
                    listId: opts['list-id'] ? Number(opts['list-id']) : null,
                    listName: opts['list-name'] || opts.list || null,
                    segmentId: opts['segment-id'] ? Number(opts['segment-id']) : null,
                    segmentName: opts['segment-name'] || opts.segment || null
                });
                printJsonOrError(isJson, result);
                return;
            }
            default:
                console.error(`\x1b[31mSous-commande 'pipeline' inconnue : '${subCommand}'.\x1b[0m`);
                console.error(`Sous-commandes disponibles : create, prospect, save-contacts, generate-messages, organize, cards, run --auto`);
                process.exit(1);
        }
    } catch (err) {
        if (isJson) {
            console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
        } else {
            console.error(`\x1b[31mErreur pipeline : ${err.message}\x1b[0m`);
        }
        process.exit(1);
    }
}

module.exports = { handlePipeline };
