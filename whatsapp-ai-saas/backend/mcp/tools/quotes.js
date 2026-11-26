/**
 * Outils MCP — Devis et export PDF.
 *
 * Extrait de wacopiloteMcpServer.js (constat R9 de l’audit du 29/09/2026),
 * à l’identique : définitions et corps des handlers sont ceux de l’ancien
 * `switch`, seuls les chemins require ont gagné un niveau.
 */

const db = require('../../db');

const definitions = [
        {
            name: 'list_quotes',
            description: 'Lister les devis enregistrés.',
            inputSchema: { type: 'object', properties: {}, required: [] }
        },
        {
            name: 'get_quote',
            description: 'Récupérer un devis par son identifiant.',
            inputSchema: {
                type: 'object',
                properties: { id: { type: 'number', description: 'Identifiant du devis' } },
                required: ['id']
            }
        },
        {
            name: 'create_quote',
            description: "Créer un nouveau devis. 'items' est un tableau de { description, qty, price }.",
            inputSchema: {
                type: 'object',
                properties: {
                    clientName: { type: 'string', description: 'Nom du client' },
                    items: { type: 'array', items: { type: 'object' }, description: 'Lignes du devis' },
                    taxRate: { type: 'number', description: 'Taux de TVA en % (défaut: 0)' },
                    currency: { type: 'string', description: "Devise (défaut: 'XOF')" },
                    notes: { type: 'string', description: 'Notes ou conditions de paiement' }
                },
                required: ['items']
            }
        },
        {
            name: 'update_quote',
            description: 'Mettre à jour un devis existant (fusion des champs fournis).',
            inputSchema: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'Identifiant du devis' },
                    clientName: { type: 'string', description: 'Nom du client' },
                    items: { type: 'array', items: { type: 'object' }, description: 'Lignes du devis' },
                    status: { type: 'string', description: "Statut ('draft', 'pending', 'paid', 'overdue')" }
                },
                required: ['id']
            }
        },
        {
            name: 'export_quote_pdf',
            description: 'Exporter un devis en PDF sur disque (rendu autonome via Chromium headless, aucune dépendance à l\'application Electron).',
            inputSchema: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'Identifiant du devis' },
                    outPath: { type: 'string', description: 'Chemin de fichier de sortie (.pdf)' }
                },
                required: ['id', 'outPath']
            }
        }
];

const handlers = {
    list_quotes: async () => {
        await db.initDB();
        const invoiceService = require('../../services/invoiceService');
        const quotes = await invoiceService.listInvoices();
        return { quotes, count: quotes.length };
    },

    get_quote: async (args) => {
        const { id } = args || {};
        if (!id) throw new Error("L'argument 'id' est obligatoire.");
        await db.initDB();
        const invoiceService = require('../../services/invoiceService');
        return { quote: await invoiceService.getInvoice(id) };
    },

    create_quote: async (args) => {
        const { clientName, items, taxRate, currency, notes } = args || {};
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error("L'argument 'items' est obligatoire.");
        }
        await db.initDB();
        const invoiceService = require('../../services/invoiceService');
        return { quote: await invoiceService.createInvoice({ clientName, items, taxRate, currency, notes }) };
    },

    update_quote: async (args) => {
        const { id, ...patch } = args || {};
        if (!id) throw new Error("L'argument 'id' est obligatoire.");
        await db.initDB();
        const invoiceService = require('../../services/invoiceService');
        const existing = await invoiceService.getInvoice(id);
        return { quote: await invoiceService.updateInvoice(id, { ...existing, ...patch }) };
    },

    export_quote_pdf: async (args) => {
        const { id, outPath } = args || {};
        if (!id || !outPath) throw new Error("Les arguments 'id' et 'outPath' sont obligatoires.");
        await db.initDB();
        const invoiceService = require('../../services/invoiceService');
        const result = await invoiceService.renderPdf(id, outPath);
        return { outPath: result.outPath };
    }
};

module.exports = { definitions, handlers };
