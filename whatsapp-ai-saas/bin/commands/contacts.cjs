/**
 * CLI WaCopilote — Contacts CRM.
 *
 * Extrait de bin/wacopilote.cjs (constat R10 de l’audit du 29/09/2026), à
 * l’identique : seuls les chemins require ont gagné un niveau.
 */

const db = require('../../backend/db');
const { parseNamedArgs, printJsonOrError } = require('../lib/helpers.cjs');

/**
 * Commande `contacts` : Gestion des contacts CRM.
 */
async function handleContacts(args) {
    const subCommand = args[0] || 'list';
    const isJson = args.includes('--json');
    const opts = parseNamedArgs(args.slice(1));
    const crmService = require('../../backend/services/crmService');
    await db.initDB();

    if (subCommand === 'list') {
        const contacts = await crmService.listContacts({
            segmentId: opts['segment-id'] || opts['segment'],
            listId: opts['list-id'] || opts['list'],
            status: opts['status'],
            search: opts['search'] || opts['query'],
            limit: opts['limit'],
            offset: opts['offset']
        });
        printJsonOrError(isJson, { contacts, count: contacts.length });
        return;
    }

    if (subCommand === 'get') {
        const id = args[1];
        if (!id) {
            console.error('\x1b[31mErreur : Identifiant de contact requis.\x1b[0m');
            process.exit(1);
        }
        const contact = await crmService.getContact(id);
        printJsonOrError(isJson, { contact });
        return;
    }

    if (subCommand === 'create') {
        const phone = opts.phone || args[1];
        if (!phone) {
            console.error('\x1b[31mErreur : Option --phone <numéro> requise.\x1b[0m');
            process.exit(1);
        }
        const contact = await crmService.createContact({
            phone,
            name: opts.name,
            email: opts.email,
            address: opts.address,
            segmentId: opts['segment-id'] || opts['segment'],
            listId: opts['list-id'] || opts['list'],
            status: opts.status
        });
        printJsonOrError(isJson, { success: true, contact });
        return;
    }

    if (subCommand === 'update') {
        const id = args[1];
        if (!id) {
            console.error('\x1b[31mErreur : Identifiant de contact requis.\x1b[0m');
            process.exit(1);
        }
        const contact = await crmService.updateContact(id, {
            name: opts.name,
            phone: opts.phone,
            email: opts.email,
            address: opts.address,
            segmentId: opts['segment-id'] || opts['segment'],
            listId: opts['list-id'] || opts['list'],
            status: opts.status
        });
        printJsonOrError(isJson, { success: true, contact });
        return;
    }

    if (subCommand === 'delete') {
        const id = args[1];
        if (!id) {
            console.error('\x1b[31mErreur : Identifiant de contact requis.\x1b[0m');
            process.exit(1);
        }
        await crmService.deleteContact(id);
        printJsonOrError(isJson, { success: true, id });
        return;
    }

    if (subCommand === 'assign') {
        const segmentId = opts['segment-id'] || opts['segment'];
        const nonNamed = args.slice(1).filter(a => !a.startsWith('--'));
        const contactIds = nonNamed.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (contactIds.length === 0) {
            console.error('\x1b[31mErreur : Au moins un ID de contact doit être spécifié.\x1b[0m');
            process.exit(1);
        }
        const result = await crmService.assignContactsToSegment(contactIds, segmentId ? parseInt(segmentId, 10) : null);
        printJsonOrError(isJson, { success: true, ...result });
        return;
    }

    console.error(`\x1b[31mSous-commande contacts inconnue : '${subCommand}'.\x1b[0m`);
    process.exit(1);
}

module.exports = { handleContacts };
